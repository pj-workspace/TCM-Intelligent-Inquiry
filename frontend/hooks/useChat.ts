"use client";

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/auth-context";
import { API_BASE } from "@/lib/api";
import {
  toolIoToPreview,
  groupMessagesIntoTraces,
  mapApiRowToMessage,
  sumThinkingDurations,
} from "@/lib/chatUtils";
import type {
  Message,
  TraceMessage,
  ApiMessageRow,
  GenerationState,
  ServerConversation,
  ToolStep,
} from "@/types/chat";

const PENDING_CHAT_DRAFT_KEY = "tcm_pending_chat_draft";

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export function useChat(opts: {
  autoFollowMainRef: React.MutableRefObject<boolean>;
  onNewChatScrollReset: () => void;
}) {
  const { autoFollowMainRef, onNewChatScrollReset } = opts;
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

  const pendingChatModelRef = useRef<string | undefined>(undefined);
  const abortControllerRef = useRef<AbortController | null>(null);
  const thinkingStepStartedAt = useRef<Record<string, number>>({});
  const traceStartedAt = useRef<Record<string, number>>({});

  // ── Feature toggles (passed in from caller via setter pattern) ─────────────
  const [deepThinkEnabled, setDeepThinkEnabled] = useState(false);
  const [webSearchEnabled, setWebSearchEnabled] = useState(false);
  const [webSearchMode, setWebSearchMode] = useState<"force" | "auto">("force");

  // ── Computed ───────────────────────────────────────────────────────────────
  const lastAssistantMessageId = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      const m = messages[i];
      if (m.type === "message" && m.role === "assistant") return m.id;
    }
    return null;
  }, [messages]);

  // ── Server-side conversation list ──────────────────────────────────────────
  const refreshServerConversations = useCallback(async () => {
    if (!token) return;
    const res = await fetch(`${API_BASE}/api/chat/conversations`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return;
    const data = (await res.json()) as { id: string; title: string; created_at?: string }[];
    if (!Array.isArray(data)) return;
    setServerConversations(
      data.map((x) => ({ id: x.id, title: x.title?.trim() || "未命名", created_at: x.created_at }))
    );
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
      streamOpts?: { regenerateLastReply?: boolean }
    ) => {
      if (!token) return;

      pendingChatModelRef.current = undefined;
      const abortController = new AbortController();
      abortControllerRef.current = abortController;

      if (appendUserMessage) {
        const userMsgId = Date.now().toString();
        setMessages((prev) => [
          ...prev,
          { id: userMsgId, role: "user", type: "message", content: userText },
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
                      { id: data.conversationId, title: "", created_at: new Date().toISOString() },
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
                        { id: cid, title: nextTitle, created_at: new Date().toISOString() },
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
        setGenState("idle");
      } catch (error) {
        // 用户主动终止：不显示错误，仅标记最后一条助手消息为已中断
        if (error instanceof Error && error.name === "AbortError") {
          finalizeThinkingStep(currentTraceId, openThinkingStepId);
          if (currentTraceId) finalizeTrace(currentTraceId, false);
          setMessages((prev) => {
            const lastAi = [...prev]
              .reverse()
              .find((m) => m.type === "message" && m.role === "assistant");
            if (lastAi) {
              return prev.map((m) =>
                m.id === lastAi.id && m.type === "message" && m.role === "assistant"
                  ? { ...m, interrupted: true }
                  : m
              );
            }
            return [
              ...prev,
              {
                id: Date.now().toString() + "-interrupted",
                role: "assistant" as const,
                type: "message" as const,
                content: "",
                interrupted: true,
              },
            ];
          });
          setGenState("idle");
          return;
        }
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
      } finally {
        abortControllerRef.current = null;
        setIsGeneratingTitle(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      token,
      conversationId,
      deepThinkEnabled,
      webSearchEnabled,
      webSearchMode,
      autoFollowMainRef,
      finalizeThinkingStep,
      finalizeTrace,
      refreshServerConversations,
    ]
  );

  // ── Public handlers ────────────────────────────────────────────────────────
  const handleSend = useCallback(
    async (input: string, setInput: (v: string) => void) => {
      if (!input.trim() || genState !== "idle") return;
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
      const userText = input.trim();
      setInput("");
      setHasStarted(true);
      autoFollowMainRef.current = true;
      await runChatStream(userText, true);
    },
    [genState, authLoading, token, router, autoFollowMainRef, runChatStream]
  );

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
        if (m.type === "message" && m.role === "user" && m.content) {
          userText = m.content;
          userIdx = i;
          break;
        }
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
    if (token) void refreshServerConversations();
  }, [token, refreshServerConversations, onNewChatScrollReset]);

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
      if (conversationId === id) handleNewChat();
      setDeleteTargetId(null);
    } catch (e) {
      console.error(e);
    } finally {
      setDeletePending(false);
    }
  }, [token, deleteTargetId, conversationId, handleNewChat]);

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

  /** 已登录：拉服务端会话列表并恢复上次打开的会话 */
  useEffect(() => {
    if (authLoading || !token) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/api/chat/conversations`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok || cancelled) return;
        const data = (await res.json()) as { id: string; title: string }[];
        const mapped = Array.isArray(data)
          ? data.map((x) => ({ id: x.id, title: x.title?.trim() || "未命名" }))
          : [];
        if (cancelled) return;
        setServerConversations(mapped);
        const savedId = localStorage.getItem("tcm_conversation_id");
        if (!savedId || !mapped.some((c) => c.id === savedId)) return;
        setConversationId(savedId);
        setHasStarted(true);
        const mr = await fetch(`${API_BASE}/api/chat/conversations/${savedId}/messages`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!mr.ok || cancelled) return;
        const msgs = (await mr.json()) as ApiMessageRow[];
        if (!Array.isArray(msgs) || cancelled) return;
        setMessages(groupMessagesIntoTraces(msgs.map(mapApiRowToMessage)));
      } catch (e) {
        console.error(e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [authLoading, token]);

  /** 未登录：清空服务端会话缓存与本地残留匿名状态 */
  useEffect(() => {
    if (authLoading || token) return;
    setServerConversations([]);
    localStorage.removeItem("tcm_conversation_id");
    localStorage.removeItem("tcm_anon_secret");
    setConversationId(null);
    setMessages([]);
    setHasStarted(false);
    setGenState("idle");
    setIsGeneratingTitle(false);
    thinkingStepStartedAt.current = {};
    traceStartedAt.current = {};
  }, [authLoading, token]);

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
    // feature toggles
    deepThinkEnabled,
    setDeepThinkEnabled,
    webSearchEnabled,
    setWebSearchEnabled,
    webSearchMode,
    setWebSearchMode,
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
  };
}
