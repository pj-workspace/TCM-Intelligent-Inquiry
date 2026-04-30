"use client";

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/auth-context";
import { API_BASE, apiHeaders, apiJsonHeaders } from "@/lib/api";
import {
  toolIoToPreview,
  groupMessagesIntoTraces,
  mapApiRowToMessage,
  sumThinkingDurations,
} from "@/lib/chatUtils";
import { toast } from "sonner";
import { uploadOssChatImageWithProgress } from "@/lib/ossUpload";
import { CHAT_PENDING_ATTACHMENT_MAX, CHAT_IMAGE_MIN_EDGE_PX } from "@/lib/chatAttachmentConstants";
import { measureImageMinEdgePx, imageMinEdgeOkForChatVl } from "@/lib/chatImageDimensions";
import type {
  ChatMessage,
  Message,
  TraceMessage,
  ApiMessageRow,
  GenerationState,
  ServerConversation,
  ToolStep,
  ConversationFolder,
} from "@/types/chat";
import type { ModelOption } from "@/types/models";

const PINNED_IDS_KEY = "tcm_pinned_conversation_ids";

const PENDING_CHAT_DRAFT_KEY = "tcm_pending_chat_draft";

const QWEN_CHAT_MODEL_LS_KEY = "tcm_qwen_chat_model";

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * abort() + body stream 在读时中止时，不一定是 `Error/DOMException` 且 `.name=== "AbortError"`；
 * Next/部分浏览器会直接报 network / stream premature close。
 */
function isLikelyUserAbort(err: unknown, signal: AbortSignal): boolean {
  if (signal.aborted) return true;
  if (
    typeof DOMException !== "undefined" &&
    err instanceof DOMException &&
    err.name === "AbortError"
  ) {
    return true;
  }
  if (err instanceof Error && err.name === "AbortError") return true;
  const msg =
    typeof err === "object" &&
    err !== null &&
    "message" in err &&
    typeof (err as { message: unknown }).message === "string"
      ? (err as { message: string }).message
      : "";
  return /aborted|The operation was aborted|premature close|ERR_STREAM_/i.test(msg);
}

export function useChat(opts: {
  autoFollowMainRef: React.MutableRefObject<boolean>;
  onNewChatScrollReset: () => void;
  /** 侧栏选中文件夹且将新建会话时，传入该分组 ID */
  getPreferredGroupForNewConversation?: () => string | null;
}) {
  const { autoFollowMainRef, onNewChatScrollReset, getPreferredGroupForNewConversation } =
    opts;
  const router = useRouter();
  const { token, loading: authLoading } = useAuth();

  const [messages, setMessages] = useState<Message[]>([]);
  const [hasStarted, setHasStarted] = useState(false);
  const [genState, setGenState] = useState<GenerationState>("idle");
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [serverConversations, setServerConversations] = useState<ServerConversation[]>([]);
  const [isGeneratingTitle, setIsGeneratingTitle] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [deletePending, setDeletePending] = useState(false);
  const [bulkDeletePending, setBulkDeletePending] = useState(false);
  const [movePendingId, setMovePendingId] = useState<string | null>(null);
  const [conversationFolders, setConversationFolders] = useState<ConversationFolder[]>([]);
  const [pinnedIds, setPinnedIdsState] = useState<string[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const raw = localStorage.getItem(PINNED_IDS_KEY);
      if (!raw) return [];
      const p = JSON.parse(raw) as unknown;
      return Array.isArray(p) ? p.filter((x): x is string => typeof x === "string") : [];
    } catch {
      return [];
    }
  });

  const pendingChatModelRef = useRef<string | undefined>(undefined);
  const pendingNewConversationGroupRef = useRef<string | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);
  const thinkingStepStartedAt = useRef<Record<string, number>>({});
  const traceStartedAt = useRef<Record<string, number>>({});

  // ── Feature toggles (passed in from caller via setter pattern) ─────────────
  const [deepThinkEnabled, setDeepThinkEnabled] = useState(false);
  const [webSearchEnabled, setWebSearchEnabled] = useState(false);
  const [webSearchMode, setWebSearchMode] = useState<"force" | "auto">("force");

  const [chatModelOptions, setChatModelOptions] = useState<ModelOption[]>([]);
  const [selectedChatModelId, setSelectedChatModelIdState] = useState("");

  /** 已上传待发送的图片 URL（OSS 签名） */
  const [pendingImageUrls, setPendingImageUrls] = useState<string[]>([]);
  const [attachmentUploadBusy, setAttachmentUploadBusy] = useState(false);
  /** 本次选择、正在上传的文件个数，用于骨架占位 */
  const [attachmentUploadSkeletonCount, setAttachmentUploadSkeletonCount] = useState(0);
  /** 与骨架一一对应，各文件上传进度 0~1（XHR 每次 onprogress 即时更新） */
  const [attachmentUploadSlotProgress, setAttachmentUploadSlotProgress] = useState<number[]>([]);

  const attachmentUploadSlotProgressRef = useRef<number[]>([]);

  const cancelAttachmentUploadAnimations = useCallback(() => {
    attachmentUploadSlotProgressRef.current = [];
    setAttachmentUploadSlotProgress([]);
    setAttachmentUploadBusy(false);
    setAttachmentUploadSkeletonCount(0);
  }, []);

  const setSelectedChatModelId = useCallback((id: string) => {
    setSelectedChatModelIdState(id);
    try {
      if (id.trim()) localStorage.setItem(QWEN_CHAT_MODEL_LS_KEY, id.trim());
    } catch {
      /* ignore */
    }
  }, []);

  const effectiveChatModelForRequest = useMemo(() => {
    if (chatModelOptions.length === 0) return undefined as string | undefined;
    const primary =
      chatModelOptions.find((o) => o.default)?.id ??
      chatModelOptions[0]?.id ??
      "";
    const sid = selectedChatModelId.trim();
    return sid || primary;
  }, [chatModelOptions, selectedChatModelId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch(`${API_BASE}/api/chat/model-options`);
        if (!r.ok) throw new Error(String(r.status));
        const raw = (await r.json()) as unknown;
        if (!Array.isArray(raw)) throw new Error("invalid shape");
        const data = raw as ModelOption[];
        if (cancelled) return;
        setChatModelOptions(data);
        if (data.length === 0) {
          setSelectedChatModelIdState("");
          return;
        }
        const primaryId = data.find((o) => o.default === true)?.id ?? data[0]?.id ?? "";
        let pick = primaryId;
        try {
          const ls = localStorage.getItem(QWEN_CHAT_MODEL_LS_KEY)?.trim();
          if (ls && data.some((o) => o.id === ls)) pick = ls;
          else localStorage.removeItem(QWEN_CHAT_MODEL_LS_KEY);
        } catch {
          /* ignore */
        }
        setSelectedChatModelIdState(pick);
        try {
          localStorage.setItem(QWEN_CHAT_MODEL_LS_KEY, pick);
        } catch {
          /* ignore */
        }
      } catch (e) {
        console.warn(
          "[useChat] GET /api/chat/model-options 失败，不向请求写入 chat_model，由服务端默认主模型兜底",
          e
        );
        if (!cancelled) {
          setChatModelOptions([]);
          setSelectedChatModelIdState("");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const o = chatModelOptions.find((x) => x.id === selectedChatModelId);
    if (!o || chatModelOptions.length === 0) return;
    const deepOk = o.capabilities?.supports_deep_think !== false;
    const toolOk = o.capabilities?.supports_tool_calling !== false;
    if (!deepOk) setDeepThinkEnabled(false);
    if (!toolOk) setWebSearchEnabled(false);
  }, [selectedChatModelId, chatModelOptions]);

  // ── Computed ───────────────────────────────────────────────────────────────
  const lastAssistantMessageId = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      const m = messages[i];
      if (m.type === "message" && m.role === "assistant") return m.id;
    }
    return null;
  }, [messages]);

  // ── Server-side conversation list ──────────────────────────────────────────
  const refreshServerConversations = useCallback(async (): Promise<ServerConversation[] | null> => {
    if (!token) return null;
    const h = apiHeaders(token);
    try {
      const [cr, gr] = await Promise.all([
        fetch(`${API_BASE}/api/chat/conversations`, { headers: h }),
        fetch(`${API_BASE}/api/chat/groups`, { headers: h }),
      ]);
      let listOut: ServerConversation[] | null = null;
      if (cr.ok) {
        const data = (await cr.json()) as {
          id: string;
          title: string;
          created_at?: string;
          group_id?: string | null;
        }[];
        if (Array.isArray(data)) {
          listOut = data.map((x) => ({
            id: x.id,
            title: x.title?.trim() || "未命名",
            created_at: x.created_at,
            group_id: x.group_id ?? null,
          }));
          setServerConversations(listOut);
        }
      }
      if (gr.ok) {
        const gd = (await gr.json()) as ConversationFolder[];
        if (Array.isArray(gd)) setConversationFolders(gd);
      }
      return listOut;
    } catch (err) {
      /** 后端未启动、离线、CORS 等：`fetch` 会抛 TypeError，避免未处理 rejection 和红栈 */
      if (process.env.NODE_ENV === "development") {
        console.warn(
          "[useChat] refreshServerConversations: 无法连接 API（请检查后端是否在本机端口运行，`NEXT_PUBLIC_API_BASE_URL` 是否正确）:",
          err
        );
      }
      return null;
    }
  }, [token]);

  const loadMessagesWithToken = useCallback(async (convId: string, accessToken: string) => {
    const res = await fetch(`${API_BASE}/api/chat/conversations/${convId}/messages`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) throw new Error("Failed to fetch messages");
    const data = (await res.json()) as ApiMessageRow[];
    if (!Array.isArray(data)) return;
    setMessages(groupMessagesIntoTraces(data.map(mapApiRowToMessage)));
  }, []);

  // ── Thinking / trace finalization ──────────────────────────────────────────
  const finalizeThinkingStep = useCallback((traceId: string | null, stepId: string | null) => {
    if (!traceId || !stepId) return;
    const start = thinkingStepStartedAt.current[stepId];
    if (start == null) return;
    const sec = Math.max(0, (Date.now() - start) / 1000);
    delete thinkingStepStartedAt.current[stepId];
    setMessages((prev) =>
      prev.map((m) =>
        m.type === "trace" && m.id === traceId
          ? {
              ...m,
              steps: m.steps.map((step) =>
                step.type === "thinking" && step.id === stepId
                  ? { ...step, durationSec: sec }
                  : step
              ),
            }
          : m
      )
    );
  }, []);

  const finalizeTrace = useCallback((traceId: string | null, collapsed: boolean) => {
    if (!traceId) return;
    const start = traceStartedAt.current[traceId];
    const elapsedSec = start != null ? Math.max(0, (Date.now() - start) / 1000) : undefined;
    delete traceStartedAt.current[traceId];
    setMessages((prev) =>
      prev.map((m) =>
        m.type === "trace" && m.id === traceId
          ? {
              ...m,
              status: "done",
              collapsed,
              totalDurationSec:
                elapsedSec ?? m.totalDurationSec ?? sumThinkingDurations(m.steps),
            }
          : m
      )
    );
  }, []);

  // ── SSE streaming ──────────────────────────────────────────────────────────
  const runChatStream = useCallback(
    async (
      userText: string,
      appendUserMessage: boolean,
      streamOpts?: { regenerateLastReply?: boolean; imageUrls?: string[] }
    ) => {
      if (!token) return;

      pendingChatModelRef.current = undefined;
      const abortController = new AbortController();
      abortControllerRef.current = abortController;

      if (appendUserMessage) {
        const userMsgId = Date.now().toString();
        const imgs = streamOpts?.imageUrls?.filter((u) => u.trim()) ?? [];
        setMessages((prev) => [
          ...prev,
          {
            id: userMsgId,
            role: "user",
            type: "message",
            content: userText,
            ...(imgs.length ? { imageUrls: imgs } : {}),
          },
        ]);
      }

      if (!conversationId) setIsGeneratingTitle(true);
      setGenState("waiting");

      const startTime = Date.now();
      const currentAssistantMsgId = Date.now().toString() + "-msg";
      let currentTraceId: string | null = null;
      let openThinkingStepId: string | null = null;
      let toolRunStartedAt: number | null = null;
      let hasAssistantMsg = false;

      try {
        const preferredGid =
          !conversationId ? getPreferredGroupForNewConversation?.() ?? null : null;
        pendingNewConversationGroupRef.current = preferredGid;
        const response = await fetch(`${API_BASE}/api/chat`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            message: userText,
            conversation_id: conversationId,
            regenerate_last_reply: streamOpts?.regenerateLastReply ?? false,
            agent_id: localStorage.getItem("tcm_default_agent_id") ?? undefined,
            deep_think: deepThinkEnabled,
            web_search_enabled: webSearchEnabled,
            web_search_mode: webSearchMode,
            ...(effectiveChatModelForRequest
              ? { chat_model: effectiveChatModelForRequest }
              : {}),
            ...(streamOpts?.imageUrls?.length
              ? { image_urls: streamOpts.imageUrls }
              : {}),
          }),
          signal: abortController.signal,
        });

        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

        // 强制让星星至少旋转 600ms，保证视觉上的"思考前摇"
        const elapsed = Date.now() - startTime;
        if (elapsed < 600) await delay(600 - elapsed);

        const reader = response.body?.getReader();
        const decoder = new TextDecoder("utf-8");
        let buffer = "";
        if (!reader) return;

        const ensureCurrentTraceId = () => {
          if (currentTraceId != null) return currentTraceId;
          currentTraceId = `trace-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
          traceStartedAt.current[currentTraceId] = Date.now();
          return currentTraceId;
        };

        while (true) {
          if (abortController.signal.aborted) break;
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            const dataStr = line.slice(6);
            if (dataStr === "[DONE]") continue;

            try {
              const data = JSON.parse(dataStr);

              if (data.type === "meta") {
                if (data.conversationId) {
                  setConversationId(data.conversationId);
                  localStorage.setItem("tcm_conversation_id", data.conversationId);
                  setServerConversations((prev) => {
                    if (prev.some((c) => c.id === data.conversationId)) return prev;
                    return [
                      {
                        id: data.conversationId,
                        title: "",
                        created_at: new Date().toISOString(),
                        group_id: pendingNewConversationGroupRef.current,
                      },
                      ...prev,
                    ];
                  });
                }
                if (typeof data.chatModel === "string" && data.chatModel.trim() !== "") {
                  pendingChatModelRef.current = data.chatModel.trim();
                }
              } else if (data.type === "thinking-delta") {
                const piece = data.textDelta ?? "";
                const traceId = ensureCurrentTraceId();
                if (openThinkingStepId === null) {
                  const nid = `think-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
                  openThinkingStepId = nid;
                  thinkingStepStartedAt.current[nid] = Date.now();
                  setGenState("thinking");
                  setMessages((prev) => {
                    const trace = prev.find(
                      (msg): msg is TraceMessage => msg.type === "trace" && msg.id === traceId
                    );
                    if (!trace) {
                      return [
                        ...prev,
                        {
                          id: traceId,
                          type: "trace",
                          steps: [{ id: nid, type: "thinking", content: piece }],
                          status: "streaming",
                          totalDurationSec: undefined,
                          collapsed: false,
                        },
                      ];
                    }
                    return prev.map((msg) =>
                      msg.type === "trace" && msg.id === traceId
                        ? {
                            ...msg,
                            status: "streaming",
                            steps: [...msg.steps, { id: nid, type: "thinking", content: piece }],
                          }
                        : msg
                    );
                  });
                } else {
                  setGenState("thinking");
                  const tid = openThinkingStepId;
                  setMessages((prev) =>
                    prev.map((msg) =>
                      msg.type === "trace" && msg.id === traceId
                        ? {
                            ...msg,
                            steps: msg.steps.map((step) =>
                              step.type === "thinking" && step.id === tid
                                ? { ...step, content: step.content + piece }
                                : step
                            ),
                          }
                        : msg
                    )
                  );
                }
              } else if (data.type === "tool-call") {
                const traceId = ensureCurrentTraceId();
                finalizeThinkingStep(traceId, openThinkingStepId);
                openThinkingStepId = null;
                const runKey =
                  data.runId ??
                  `run-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
                const rowId = `tool-${runKey}`;
                toolRunStartedAt = Date.now();
                setGenState("tool");
                setMessages((prev) => {
                  const toolStep: ToolStep = {
                    id: rowId,
                    type: "tool",
                    toolName:
                      typeof data.name === "string" && data.name ? data.name : "tool",
                    status: "running",
                    runId: data.runId ?? runKey,
                    inputPreview: toolIoToPreview((data as { input?: unknown }).input),
                  };
                  const trace = prev.find(
                    (msg): msg is TraceMessage => msg.type === "trace" && msg.id === traceId
                  );
                  if (!trace) {
                    return [
                      ...prev,
                      {
                        id: traceId,
                        type: "trace",
                        steps: [toolStep],
                        status: "streaming",
                        totalDurationSec: undefined,
                        collapsed: false,
                      },
                    ];
                  }
                  return prev.map((msg) =>
                    msg.type === "trace" && msg.id === traceId
                      ? { ...msg, status: "streaming", steps: [...msg.steps, toolStep] }
                      : msg
                  );
                });
              } else if (data.type === "tool-result") {
                openThinkingStepId = null;
                const rid = data.runId as string | undefined;
                const outputPreviewFromEvent =
                  typeof data.outputPreview === "string" && data.outputPreview
                    ? data.outputPreview
                    : undefined;
                const toolElapsed =
                  toolRunStartedAt != null ? Date.now() - toolRunStartedAt : 999;
                toolRunStartedAt = null;
                if (toolElapsed < 420) await delay(420 - toolElapsed);
                setMessages((prev) =>
                  prev.map((msg) => {
                    if (msg.type !== "trace" || msg.id !== currentTraceId) return msg;
                    let idx = -1;
                    if (rid != null) {
                      idx = msg.steps.findIndex(
                        (step) =>
                          step.type === "tool" && step.status === "running" && step.runId === rid
                      );
                    }
                    if (idx === -1) {
                      idx = msg.steps.findIndex(
                        (step) => step.type === "tool" && step.status === "running"
                      );
                    }
                    if (idx === -1) return msg;
                    const nextStatus =
                      (data.status as string | undefined) === "error" ? "error" : "success";
                    return {
                      ...msg,
                      steps: msg.steps.map((step, i) =>
                        i === idx && step.type === "tool"
                          ? {
                              ...step,
                              status: nextStatus,
                              outputPreview: outputPreviewFromEvent ?? step.outputPreview,
                            }
                          : step
                      ),
                    };
                  })
                );
                await delay(150);
              } else if (data.type === "text-delta") {
                finalizeThinkingStep(currentTraceId, openThinkingStepId);
                openThinkingStepId = null;
                if (currentTraceId) {
                  finalizeTrace(currentTraceId, true);
                  currentTraceId = null;
                  // 从头脑风暴切到正文时布局剧变，避免 scrollTop 钳位被误判为上滑而停止跟滚
                  autoFollowMainRef.current = true;
                }
                if (!hasAssistantMsg) {
                  hasAssistantMsg = true;
                  setGenState("typing");
                  setMessages((prev) => [
                    ...prev,
                    {
                      id: currentAssistantMsgId,
                      role: "assistant",
                      type: "message",
                      content: data.textDelta,
                      modelName: pendingChatModelRef.current,
                    },
                  ]);
                } else {
                  setGenState("typing");
                  setMessages((prev) =>
                    prev.map((msg) =>
                      msg.type === "message" && msg.id === currentAssistantMsgId
                        ? { ...msg, content: (msg.content || "") + data.textDelta }
                        : msg
                    )
                  );
                }
              } else if (data.type === "title-updated") {
                const cid =
                  typeof data.conversationId === "string" ? data.conversationId : null;
                const newTitle = typeof data.title === "string" ? data.title.trim() : "";
                // 必须用 SSE 里的 conversationId：新建会话时闭包里的 conversationId 仍为 null
                if (cid) {
                  const nextTitle = newTitle || "新会话";
                  setServerConversations((prev) => {
                    const idx = prev.findIndex((c) => c.id === cid);
                    if (idx === -1) {
                      return [
                        {
                          id: cid,
                          title: nextTitle,
                          created_at: new Date().toISOString(),
                          group_id: pendingNewConversationGroupRef.current,
                        },
                        ...prev,
                      ];
                    }
                    return prev.map((c) => (c.id === cid ? { ...c, title: nextTitle } : c));
                  });
                }
                setIsGeneratingTitle(false);
              } else if (data.type === "error") {
                console.error("Backend error:", data.message);
                finalizeThinkingStep(currentTraceId, openThinkingStepId);
                openThinkingStepId = null;
                if (currentTraceId) {
                  finalizeTrace(currentTraceId, false);
                  currentTraceId = null;
                }
                setMessages((prev) => [
                  ...prev,
                  {
                    id: Date.now().toString(),
                    role: "assistant",
                    type: "message",
                    content: `**Error:** ${data.message}`,
                  },
                ]);
              }
            } catch (e) {
              console.error("Error parsing SSE data", e);
            }
          }
        }

        finalizeThinkingStep(currentTraceId, openThinkingStepId);
        if (currentTraceId) finalizeTrace(currentTraceId, false);
        await refreshServerConversations();
        if (!abortController.signal.aborted) {
          setGenState("idle");
        }
      } catch (error) {
        // 真实网络/解析错误（用户主动中止在 finally 中收口，避免出现「伪网络错误」气泡）
        if (!isLikelyUserAbort(error, abortController.signal)) {
          console.error("Chat error:", error);
          finalizeThinkingStep(currentTraceId, openThinkingStepId);
          if (currentTraceId) finalizeTrace(currentTraceId, false);
          thinkingStepStartedAt.current = {};
          traceStartedAt.current = {};
          setMessages((prev) => [
            ...prev,
            {
              id: Date.now().toString(),
              role: "assistant",
              type: "message",
              content: "**网络错误**：无法连接到服务器，请确保后端服务已启动。",
            },
          ]);
          setGenState("idle");
        }
      } finally {
        if (abortController.signal.aborted) {
          finalizeThinkingStep(currentTraceId, openThinkingStepId);
          if (currentTraceId) finalizeTrace(currentTraceId, false);
          setMessages((prev) => {
            const lastAi = [...prev]
              .reverse()
              .find((m): m is ChatMessage => m.type === "message" && m.role === "assistant");
            if (lastAi) {
              if (lastAi.interrupted) return prev;
              return prev.map((m) =>
                m.id === lastAi.id && m.type === "message" && m.role === "assistant"
                  ? { ...m, interrupted: true }
                  : m
              );
            }
            const tail = prev[prev.length - 1];
            if (
              tail &&
              tail.type === "message" &&
              tail.role === "assistant" &&
              tail.interrupted &&
              !(tail.content || "").trim()
            ) {
              return prev;
            }
            return [
              ...prev,
              {
                id: `${Date.now()}-interrupted`,
                role: "assistant",
                type: "message",
                content: "",
                interrupted: true,
              },
            ];
          });
          setGenState("idle");
        }
        abortControllerRef.current = null;
        setIsGeneratingTitle(false);
      }
    },
    [
      token,
      conversationId,
      deepThinkEnabled,
      webSearchEnabled,
      webSearchMode,
      effectiveChatModelForRequest,
      autoFollowMainRef,
      finalizeThinkingStep,
      finalizeTrace,
      refreshServerConversations,
      getPreferredGroupForNewConversation,
    ]
  );

  // ── Public handlers ────────────────────────────────────────────────────────
  const handleSend = useCallback(
    async (input: string, setInput: (v: string) => void) => {
      if ((!input.trim() && pendingImageUrls.length === 0) || genState !== "idle") return;
      if (authLoading) return;
      if (!token) {
        try {
          sessionStorage.setItem(PENDING_CHAT_DRAFT_KEY, input);
        } catch {
          /* ignore */
        }
        router.push("/login");
        return;
      }
      const urlsSnap = [...pendingImageUrls];
      const trimmed = input.trim();
      const userText = trimmed || (urlsSnap.length > 0 ? "（附图）" : "");
      setInput("");
      setPendingImageUrls([]);
      setHasStarted(true);
      autoFollowMainRef.current = true;
      try {
        await runChatStream(userText, true, {
          ...(urlsSnap.length ? { imageUrls: urlsSnap } : {}),
        });
      } catch {
        setPendingImageUrls(urlsSnap);
        setInput(trimmed);
      }
    },
    [
      pendingImageUrls,
      genState,
      authLoading,
      token,
      router,
      autoFollowMainRef,
      runChatStream,
    ]
  );

  const pushImageAttachments = useCallback(
    async (fileList: FileList | null) => {
      if (!fileList?.length) return;
      if (!token) {
        router.push("/login");
        return;
      }
      const files = Array.from(fileList);
      const bad = files.find((f) => !f.type.startsWith("image/"));
      if (bad != null || files.length === 0) {
        toast.error("请选择图片格式（JPEG/PNG/WebP/GIF）");
        return;
      }
      const room = CHAT_PENDING_ATTACHMENT_MAX - pendingImageUrls.length;
      if (room <= 0) {
        toast.error(`最多可同时添加 ${CHAT_PENDING_ATTACHMENT_MAX} 个附件`);
        return;
      }
      if (files.length > room) {
        toast.error(
          `最多 ${CHAT_PENDING_ATTACHMENT_MAX} 个，当前还可再选 ${room} 张`
        );
        return;
      }

      setAttachmentUploadBusy(true);
      try {
        const measured = await Promise.all(
          files.map(async (file) => ({
            file,
            minEdge: await measureImageMinEdgePx(file),
          }))
        );

        const skippedTooSmall = measured.filter(
          (x) => !imageMinEdgeOkForChatVl(x.minEdge)
        ).length;

        const toUpload = measured
          .filter((x) => imageMinEdgeOkForChatVl(x.minEdge))
          .map((x) => x.file);

        if (toUpload.length === 0) {
          toast.error(
            skippedTooSmall === files.length
              ? `所选图片均小于 ${CHAT_IMAGE_MIN_EDGE_PX}×${CHAT_IMAGE_MIN_EDGE_PX} 像素（多模态要求宽、高均须大于 10px），已全部跳过。`
              : "没有可上传的图片。"
          );
          return;
        }

        const m = toUpload.length;
        const zeros = Array<number>(m).fill(0);
        attachmentUploadSlotProgressRef.current = zeros.slice();
        setAttachmentUploadSlotProgress(zeros);
        setAttachmentUploadSkeletonCount(m);

        const settled = await Promise.allSettled(
          toUpload.map((file, i) =>
            uploadOssChatImageWithProgress(token, file, (frac) => {
              const buf = attachmentUploadSlotProgressRef.current;
              if (buf.length !== m) return;
              buf[i] = frac;
              setAttachmentUploadSlotProgress((prev) => {
                if (prev.length !== m) return prev;
                const next = prev.slice();
                next[i] = frac;
                return next;
              });
            })
          )
        );

        const okUrls: string[] = [];
        const failedLines: string[] = [];
        for (let i = 0; i < settled.length; i++) {
          const r = settled[i];
          if (r.status === "fulfilled") {
            okUrls.push(r.value);
            continue;
          }
          const name = toUpload[i]?.name?.trim();
          const reason =
            r.reason instanceof Error && r.reason.message
              ? r.reason.message
              : "上传失败";
          failedLines.push(name ? `「${name}」${reason}` : reason);
        }

        if (okUrls.length > 0) {
          setPendingImageUrls((prev) => [...prev, ...okUrls]);
        }

        const hintParts: string[] = [];
        if (skippedTooSmall > 0) {
          hintParts.push(
            `已自动跳过 ${skippedTooSmall} 张尺寸过小（每张宽、高须≥${CHAT_IMAGE_MIN_EDGE_PX}px）的图片`
          );
        }
        if (failedLines.length > 0) {
          hintParts.push(
            failedLines.length === 1
              ? failedLines[0]!
              : `${failedLines.length} 张未上传成功（${failedLines[0]} 等）`
          );
        }
        if (hintParts.length > 0) {
          const text = hintParts.join("；");
          if (okUrls.length > 0) {
            toast.warning(text, { duration: 5200 });
          } else {
            toast.error(text, { duration: 6200 });
          }
        }
      } catch (err) {
        const msg =
          err instanceof Error && err.message
            ? err.message
            : "图片上传失败，请检查 OSS 配置与登录状态";
        toast.error(msg, { duration: 5200 });
      } finally {
        cancelAttachmentUploadAnimations();
      }
    },
    [
      token,
      router,
      pendingImageUrls.length,
      cancelAttachmentUploadAnimations,
    ]
  );

  const removePendingImageUrlAt = useCallback((index: number) => {
    setPendingImageUrls((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const handleStop = useCallback(() => {
    abortControllerRef.current?.abort();
  }, []);

  const handleRegenerateAssistant = useCallback(
    (assistantMsgId: string) => {
      if (genState !== "idle" || !token) return;
      const idx = messages.findIndex((m) => m.id === assistantMsgId);
      if (idx <= 0) return;
      let userIdx = -1;
      let userText: string | null = null;
      for (let i = idx - 1; i >= 0; i--) {
        const m = messages[i];
        if (m.type !== "message" || m.role !== "user") continue;
        const um = m as ChatMessage;
        const hasTxt = !!(um.content || "").trim();
        const hasPic = (um.imageUrls?.length ?? 0) > 0;
        if (!hasTxt && !hasPic) continue;
        userText = hasTxt ? um.content.trim() : "（附图）";
        userIdx = i;
        break;
      }
      if (!userText || userIdx < 0) return;
      setMessages((prev) => {
        const removed = prev.slice(userIdx + 1);
        for (const m of removed) {
          if (m.type === "trace") {
            delete traceStartedAt.current[m.id];
            for (const step of m.steps) {
              if (step.type === "thinking") delete thinkingStepStartedAt.current[step.id];
            }
          }
        }
        return prev.slice(0, userIdx + 1);
      });
      void runChatStream(userText, false, { regenerateLastReply: true });
    },
    [genState, token, messages, runChatStream]
  );

  const handleNewChat = useCallback(() => {
    localStorage.removeItem("tcm_conversation_id");
    localStorage.removeItem("tcm_anon_secret");
    setConversationId(null);
    setMessages([]);
    onNewChatScrollReset();
    thinkingStepStartedAt.current = {};
    traceStartedAt.current = {};
    setHasStarted(false);
    setGenState("idle");
    setIsGeneratingTitle(false);
    setPendingImageUrls([]);
    cancelAttachmentUploadAnimations();
    if (token) void refreshServerConversations();
  }, [
    token,
    refreshServerConversations,
    onNewChatScrollReset,
    cancelAttachmentUploadAnimations,
  ]);

  const handleSelectConversation = useCallback(
    async (id: string) => {
      if (genState !== "idle" || !token) return;
      setIsGeneratingTitle(false);
      setMessages([]);
      onNewChatScrollReset();
      setConversationId(id);
      localStorage.setItem("tcm_conversation_id", id);
      setHasStarted(true);
      try {
        await loadMessagesWithToken(id, token);
      } catch (e) {
        console.error(e);
      }
    },
    [genState, token, loadMessagesWithToken, onNewChatScrollReset]
  );

  const openDeleteDialog = useCallback(
    (id: string) => {
      if (!token) return;
      setDeleteTargetId(id);
    },
    [token]
  );

  const closeDeleteDialog = useCallback(() => {
    if (deletePending) return;
    setDeleteTargetId(null);
  }, [deletePending]);

  const confirmDeleteConversation = useCallback(async () => {
    if (!token || !deleteTargetId) return;
    const id = deleteTargetId;
    setDeletePending(true);
    try {
      const res = await fetch(`${API_BASE}/api/chat/conversations/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to delete conversation");
      setServerConversations((prev) => prev.filter((c) => c.id !== id));
      setPinnedIdsState((prev) => {
        const next = prev.filter((x) => x !== id);
        try {
          localStorage.setItem(PINNED_IDS_KEY, JSON.stringify(next));
        } catch {
          /* ignore */
        }
        return next;
      });
      if (conversationId === id) handleNewChat();
      setDeleteTargetId(null);
    } catch (e) {
      console.error(e);
    } finally {
      setDeletePending(false);
    }
  }, [token, deleteTargetId, conversationId, handleNewChat]);

  const moveConversationToGroup = useCallback(
    async (convId: string, groupId: string | null) => {
      if (!token) return;
      setMovePendingId(convId);
      try {
        const res = await fetch(`${API_BASE}/api/chat/conversations/${convId}/group`, {
          method: "PUT",
          headers: apiJsonHeaders(token),
          body: JSON.stringify({ group_id: groupId }),
        });
        if (!res.ok) return;
        setServerConversations((prev) =>
          prev.map((c) => (c.id === convId ? { ...c, group_id: groupId } : c))
        );
        await refreshServerConversations();
      } finally {
        setMovePendingId(null);
      }
    },
    [token, refreshServerConversations]
  );

  const createFolder = useCallback(
    async (name: string) => {
      if (!token?.trim()) return null;
      const res = await fetch(`${API_BASE}/api/chat/groups`, {
        method: "POST",
        headers: apiJsonHeaders(token),
        body: JSON.stringify({ name: name.trim() }),
      });
      if (!res.ok) return null;
      const row = (await res.json()) as ConversationFolder;
      await refreshServerConversations();
      return row;
    },
    [token, refreshServerConversations]
  );

  const renameFolder = useCallback(
    async (groupId: string, name: string) => {
      if (!token) return;
      const res = await fetch(`${API_BASE}/api/chat/groups/${groupId}`, {
        method: "PATCH",
        headers: apiJsonHeaders(token),
        body: JSON.stringify({ name: name.trim() }),
      });
      if (res.ok) await refreshServerConversations();
    },
    [token, refreshServerConversations]
  );

  const deleteFolder = useCallback(
    async (groupId: string) => {
      if (!token) return;
      const res = await fetch(`${API_BASE}/api/chat/groups/${groupId}`, {
        method: "DELETE",
        headers: apiHeaders(token),
      });
      if (res.ok) await refreshServerConversations();
    },
    [token, refreshServerConversations]
  );

  const togglePinConversation = useCallback((id: string) => {
    setPinnedIdsState((prev) => {
      const next = prev.includes(id)
        ? prev.filter((x) => x !== id)
        : [id, ...prev.filter((x) => x !== id)];
      try {
        localStorage.setItem(PINNED_IDS_KEY, JSON.stringify(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  const deleteConversationsBulk = useCallback(
    async (ids: string[]) => {
      if (!token || ids.length === 0) return;
      setBulkDeletePending(true);
      try {
        const h = apiHeaders(token);
        for (const id of ids) {
          await fetch(`${API_BASE}/api/chat/conversations/${id}`, {
            method: "DELETE",
            headers: h,
          });
        }
        setServerConversations((prev) => prev.filter((c) => !ids.includes(c.id)));
        setPinnedIdsState((prev) => {
          const next = prev.filter((x) => !ids.includes(x));
          try {
            localStorage.setItem(PINNED_IDS_KEY, JSON.stringify(next));
          } catch {
            /* ignore */
          }
          return next;
        });
        if (conversationId && ids.includes(conversationId)) handleNewChat();
      } catch (e) {
        console.error(e);
      } finally {
        setBulkDeletePending(false);
      }
    },
    [token, conversationId, handleNewChat]
  );

  // ── Auth effects ───────────────────────────────────────────────────────────
  useEffect(() => {
    try {
      const draft = sessionStorage.getItem(PENDING_CHAT_DRAFT_KEY);
      if (draft != null && draft !== "") {
        // We'll return this so the caller can restore it
      }
    } catch {
      /* ignore */
    }
  }, []);

  /** 已登录：拉侧边栏数据并恢复上次打开的会话 */
  useEffect(() => {
    if (authLoading || !token) return;
    let cancelled = false;
    (async () => {
      try {
        const mapped = await refreshServerConversations();
        if (cancelled) return;
        const savedId = localStorage.getItem("tcm_conversation_id");
        if (!savedId || !mapped?.some((c) => c.id === savedId)) return;
        setConversationId(savedId);
        setHasStarted(true);
        let mr: Response;
        try {
          mr = await fetch(`${API_BASE}/api/chat/conversations/${savedId}/messages`, {
            headers: { Authorization: `Bearer ${token}` },
          });
        } catch (err) {
          if (process.env.NODE_ENV === "development") {
            console.warn("[useChat] restore session messages fetch failed:", err);
          }
          return;
        }
        if (!mr.ok || cancelled) return;
        const msgs = (await mr.json()) as ApiMessageRow[];
        if (!Array.isArray(msgs) || cancelled) return;
        setMessages(groupMessagesIntoTraces(msgs.map(mapApiRowToMessage)));
      } catch (e) {
        if (process.env.NODE_ENV === "development") {
          console.warn("[useChat] init session:", e);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [authLoading, token, refreshServerConversations]);

  /** 未登录：清空服务端会话缓存与本地残留匿名状态 */
  useEffect(() => {
    if (authLoading || token) return;
    setServerConversations([]);
    setConversationFolders([]);
    localStorage.removeItem("tcm_conversation_id");
    localStorage.removeItem("tcm_anon_secret");
    setConversationId(null);
    setMessages([]);
    setHasStarted(false);
    setGenState("idle");
    setIsGeneratingTitle(false);
    setPendingImageUrls([]);
    cancelAttachmentUploadAnimations();
    thinkingStepStartedAt.current = {};
    traceStartedAt.current = {};
  }, [authLoading, token, cancelAttachmentUploadAnimations]);

  return {
    // state
    messages,
    setMessages,
    hasStarted,
    genState,
    conversationId,
    serverConversations,
    isGeneratingTitle,
    lastAssistantMessageId,
    deleteTargetId,
    deletePending,
    bulkDeletePending,
    movePendingId,
    conversationFolders,
    pinnedIds,
    // feature toggles
    deepThinkEnabled,
    setDeepThinkEnabled,
    webSearchEnabled,
    setWebSearchEnabled,
    webSearchMode,
    setWebSearchMode,
    chatModelOptions,
    selectedChatModelId,
    setSelectedChatModelId,
    pendingImageUrls,
    attachmentUploadBusy,
    attachmentUploadSkeletonCount,
    attachmentUploadSlotProgress,
    pushImageAttachments,
    removePendingImageUrlAt,
    // handlers
    handleSend,
    handleStop,
    handleRegenerateAssistant,
    handleNewChat,
    handleSelectConversation,
    refreshServerConversations,
    openDeleteDialog,
    closeDeleteDialog,
    confirmDeleteConversation,
    moveConversationToGroup,
    createFolder,
    renameFolder,
    deleteFolder,
    togglePinConversation,
    deleteConversationsBulk,
  };
}
