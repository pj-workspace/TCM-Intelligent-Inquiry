"use client";

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Sidebar } from "@/components/chat/Sidebar";
import { useAuth } from "@/contexts/auth-context";
import { API_BASE } from "@/lib/api";
import { MessageBubble, markdownToPlainText } from "@/components/chat/MessageBubble";
import {
  BrainstormPanel,
  type BrainstormStep,
} from "@/components/chat/BrainstormPanel";
import { ClaudeStar } from "@/components/chat/ClaudeStar";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Plus, Mic, Send, ChevronDown, PenLine, BookOpen, Leaf, Sun, LogOut, MoreVertical, Edit2, Trash2, Download, ArrowDown } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  type: "message";
  content: string;
  /** 助手消息：来自 SSE meta.chatModel */
  modelName?: string;
};

type ThinkingStep = Extract<BrainstormStep, { type: "thinking" }>;
type ToolStep = Extract<BrainstormStep, { type: "tool" }>;
type FlatMessage = ChatMessage | ThinkingStep | ToolStep;

type TraceMessage = {
  id: string;
  type: "trace";
  steps: BrainstormStep[];
  status: "streaming" | "done";
  totalDurationSec?: number;
  collapsed: boolean;
};

type Message = ChatMessage | TraceMessage;

type ApiMessageRow = {
  id: string;
  role: string;
  content: string;
  duration_sec?: number | null;
  model_name?: string | null;
};

/** 将 SSE / 历史记录中的工具入参转为可展示字符串 */
function toolIoToPreview(v: unknown): string | undefined {
  if (v === undefined || v === null) return undefined;
  if (typeof v === "string") return v;
  try {
    return JSON.stringify(v, null, 2);
  } catch {
    return String(v);
  }
}

function sumThinkingDurations(steps: BrainstormStep[]): number | undefined {
  const total = steps.reduce((sum, step) => {
    if (step.type !== "thinking") return sum;
    return sum + (step.durationSec ?? 0);
  }, 0);
  return total > 0 ? total : undefined;
}

function groupMessagesIntoTraces(items: FlatMessage[]): Message[] {
  const grouped: Message[] = [];
  let pendingSteps: BrainstormStep[] = [];

  const flushPendingSteps = (collapsed: boolean) => {
    if (!pendingSteps.length) return;
    grouped.push({
      id: `trace-${pendingSteps[0].id}`,
      type: "trace",
      steps: pendingSteps,
      status: "done",
      totalDurationSec: sumThinkingDurations(pendingSteps),
      collapsed,
    });
    pendingSteps = [];
  };

  for (const item of items) {
    if (item.type === "message") {
      if (pendingSteps.length > 0) {
        flushPendingSteps(item.role === "assistant");
      }
      grouped.push(item);
      continue;
    }
    pendingSteps.push(item);
  }

  flushPendingSteps(true);
  return grouped;
}

function mapApiRowToMessage(msg: ApiMessageRow): FlatMessage {
  if (msg.role === "thinking") {
    return {
      id: msg.id,
      type: "thinking",
      content: msg.content,
      durationSec:
        msg.duration_sec != null && msg.duration_sec >= 0
          ? msg.duration_sec
          : undefined,
    };
  }
  if (msg.role === "tool") {
    try {
      const payload = JSON.parse(msg.content) as {
        name?: string;
        runId?: string;
        outputPreview?: string;
        input?: unknown;
      };
      return {
        id: msg.id,
        type: "tool",
        toolName: typeof payload.name === "string" && payload.name ? payload.name : "tool",
        status: "success",
        runId: typeof payload.runId === "string" ? payload.runId : undefined,
        inputPreview: toolIoToPreview(payload.input),
        outputPreview:
          typeof payload.outputPreview === "string" && payload.outputPreview
            ? payload.outputPreview
            : undefined,
      };
    } catch {
      return {
        id: msg.id,
        type: "tool",
        toolName: "tool",
        status: "success",
      };
    }
  }
  return {
    id: msg.id,
    role: msg.role as "user" | "assistant",
    type: "message",
    content: msg.content,
    modelName:
      msg.role === "assistant" && msg.model_name
        ? msg.model_name
        : undefined,
  };
}

type GenerationState = 'idle' | 'waiting' | 'thinking' | 'tool' | 'typing';

const springTransition = {
  type: "spring" as const,
  stiffness: 300,
  damping: 30,
  mass: 0.8,
};

const messageTransition = {
  type: "spring" as const,
  stiffness: 200,
  damping: 28,
  mass: 0.6,
};

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
/** 生成中：距底部小于该值则恢复自动跟随（略宽松，避免正文开始时跟丢） */
const BOTTOM_SCROLL_THRESHOLD = 200;
/** 空闲时：距底部小于该值视为在底部，用于隐藏「回到底部」、滚动事件里恢复跟随 */
const BOTTOM_LOCK_THRESHOLD = 72;

/** 未登录点发送时暂存输入框，从 /login 返回首页后恢复 */
const PENDING_CHAT_DRAFT_KEY = "tcm_pending_chat_draft";

export default function Home() {
  const router = useRouter();
  const [input, setInput] = useState("");
  const [hasStarted, setHasStarted] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [genState, setGenState] = useState<GenerationState>('idle');
  const scrollViewportRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const autoFollowMainRef = useRef(true);
  const isNearBottomRef = useRef(true);
  const lastMainScrollTopRef = useRef(0);
  /** 当前流式请求在首个 text-delta 前由 meta 写入，用于助手消息展示模型名 */
  const pendingChatModelRef = useRef<string | undefined>(undefined);
  /** 流式思考 step 开始时间，用于单段时长结算 */
  const thinkingStepStartedAt = useRef<Record<string, number>>({});
  /** 整个头脑风暴 trace 的开始时间，用于总耗时结算 */
  const traceStartedAt = useRef<Record<string, number>>({});
  
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [serverConversations, setServerConversations] = useState<
    { id: string; title: string }[]
  >([]);
  const [showScrollToBottom, setShowScrollToBottom] = useState(false);
  const [isGeneratingTitle, setIsGeneratingTitle] = useState(false);
  const { token, loading: authLoading, logout } = useAuth();
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [deletePending, setDeletePending] = useState(false);

  const [headerMenuOpen, setHeaderMenuOpen] = useState(false);
  const headerMenuRef = useRef<HTMLDivElement>(null);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editTitleValue, setEditTitleValue] = useState("");

  useEffect(() => {
    setIsEditingTitle(false);
  }, [conversationId]);

  useEffect(() => {
    if (!headerMenuOpen) return;
    const close = (e: MouseEvent) => {
      if (headerMenuRef.current && !headerMenuRef.current.contains(e.target as Node)) {
        setHeaderMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [headerMenuOpen]);

  const handleExportHistory = () => {
    setHeaderMenuOpen(false);
    if (!messages.length) return;
    const title = serverConversations.find(c => c.id === conversationId)?.title || "会话记录";
    let text = `${title}\n\n`;
    for (const msg of messages) {
      if (msg.type === "message") {
        const role = msg.role === "user" ? "用户" : "TCM AI";
        text += `[${role}]:\n${markdownToPlainText(msg.content || "")}\n\n`;
      }
    }
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${title}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleSaveTitle = async () => {
    if (!conversationId || !token || !editTitleValue.trim()) {
      setIsEditingTitle(false);
      return;
    }
    try {
      await fetch(`${API_BASE}/api/chat/conversations/${conversationId}/title`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ title: editTitleValue.trim() }),
      });
      await refreshServerConversations();
    } catch (e) {
      console.error(e);
    }
    setIsEditingTitle(false);
  };

  /** 仅最后一条助手正文显示「重新生成」 */
  const lastAssistantMessageId = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      const m = messages[i];
      if (m.type === "message" && m.role === "assistant") return m.id;
    }
    return null;
  }, [messages]);

  const refreshServerConversations = useCallback(async () => {
    if (!token) return;
    const res = await fetch(`${API_BASE}/api/chat/conversations`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return;
    const data = (await res.json()) as { id: string; title: string }[];
    if (!Array.isArray(data)) return;
    setServerConversations(
      data.map((x) => ({ id: x.id, title: x.title?.trim() || "未命名" }))
    );
  }, [token]);

  const updateScrollState = useCallback(() => {
    const el = scrollViewportRef.current;
    if (!el) return;
    const currentTop = el.scrollTop;
    const prevTop = lastMainScrollTopRef.current;
    const distance = el.scrollHeight - el.scrollTop - el.clientHeight;
    const userScrolledUp = currentTop < prevTop - 2;
    const atBottom = distance <= BOTTOM_LOCK_THRESHOLD;
    const isNearBottom = distance <= BOTTOM_SCROLL_THRESHOLD;
    // 内容高度骤降（如头脑风暴收起）时 scrollTop 会被钳位变小，并非用户上滑
    if (userScrolledUp && distance > BOTTOM_LOCK_THRESHOLD) {
      autoFollowMainRef.current = false;
    } else if (atBottom) {
      autoFollowMainRef.current = true;
    }
    lastMainScrollTopRef.current = currentTop;
    isNearBottomRef.current = isNearBottom;
    setShowScrollToBottom(hasStarted && !atBottom);
  }, [hasStarted]);

  const scrollToBottom = useCallback((smooth: boolean) => {
    const el = scrollViewportRef.current;
    if (!el) {
      messagesEndRef.current?.scrollIntoView({
        behavior: smooth ? "smooth" : "auto",
        block: "end",
      });
      return;
    }
    el.scrollTo({
      top: el.scrollHeight,
      behavior: smooth ? "smooth" : "auto",
    });
    requestAnimationFrame(updateScrollState);
  }, [updateScrollState]);

  useEffect(() => {
    updateScrollState();
  }, [hasStarted, updateScrollState]);

  useEffect(() => {
    if (!hasStarted) return;
    const el = scrollViewportRef.current;
    if (el) {
      const distance = el.scrollHeight - el.scrollTop - el.clientHeight;
      const threshold =
        genState !== "idle"
          ? BOTTOM_SCROLL_THRESHOLD
          : BOTTOM_LOCK_THRESHOLD;
      if (distance <= threshold) {
        autoFollowMainRef.current = true;
      }
    }
    if (!autoFollowMainRef.current) return;
    scrollToBottom(false);
  }, [messages, genState, hasStarted, scrollToBottom]);

  useEffect(() => {
    try {
      const draft = sessionStorage.getItem(PENDING_CHAT_DRAFT_KEY);
      if (draft != null && draft !== "") {
        setInput(draft);
        sessionStorage.removeItem(PENDING_CHAT_DRAFT_KEY);
      }
    } catch {
      /* ignore */
    }
  }, []);

  /** 已登录：拉服务端会话列表并恢复上次打开的会话（依赖长度固定为 2，避免 HMR 告警） */
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
          ? data.map((x) => ({
              id: x.id,
              title: x.title?.trim() || "未命名",
            }))
          : [];
        if (cancelled) return;
        setServerConversations(mapped);
        const savedId = localStorage.getItem("tcm_conversation_id");
        if (!savedId || !mapped.some((c) => c.id === savedId)) return;

        setConversationId(savedId);
        setHasStarted(true);
        const mr = await fetch(
          `${API_BASE}/api/chat/conversations/${savedId}/messages`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
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

  /** 未登录：清空服务端会话缓存与本地残留匿名状态，避免登出后仍显示旧列表 */
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
    setShowScrollToBottom(false);
    autoFollowMainRef.current = true;
    isNearBottomRef.current = true;
    lastMainScrollTopRef.current = 0;
    thinkingStepStartedAt.current = {};
    traceStartedAt.current = {};
  }, [authLoading, token]);

  const loadMessagesWithToken = async (convId: string, accessToken: string) => {
    const res = await fetch(
      `${API_BASE}/api/chat/conversations/${convId}/messages`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );
    if (!res.ok) throw new Error("Failed to fetch messages");
    const data = (await res.json()) as ApiMessageRow[];
    if (!Array.isArray(data)) return;
    setMessages(groupMessagesIntoTraces(data.map(mapApiRowToMessage)));
  };

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
    const elapsedSec =
      start != null ? Math.max(0, (Date.now() - start) / 1000) : undefined;
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

  const handleSelectConversation = async (id: string) => {
    if (genState !== "idle" || !token) return;
    setIsGeneratingTitle(false);
    setMessages([]);
    setShowScrollToBottom(false);
    autoFollowMainRef.current = true;
    isNearBottomRef.current = true;
    lastMainScrollTopRef.current = 0;

    setConversationId(id);
    localStorage.setItem("tcm_conversation_id", id);
    setHasStarted(true);
    try {
      await loadMessagesWithToken(id, token);
    } catch (e) {
      console.error(e);
    }
  };

  const runChatStream = async (
    userText: string,
    appendUserMessage: boolean,
    opts?: { regenerateLastReply?: boolean }
  ) => {
    if (!token) return;

    pendingChatModelRef.current = undefined;

    if (appendUserMessage) {
      const userMsgId = Date.now().toString();
      setMessages((prev) => [
        ...prev,
        { id: userMsgId, role: "user", type: "message", content: userText },
      ]);
    }

    if (!conversationId) {
      setIsGeneratingTitle(true);
    }

    setGenState("waiting");
    const startTime = Date.now();

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
          regenerate_last_reply: opts?.regenerateLastReply ?? false,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      // 强制让星星至少旋转 600ms，保证视觉上的“思考前摇”
      const elapsed = Date.now() - startTime;
      if (elapsed < 600) {
        await delay(600 - elapsed);
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder('utf-8');
      let buffer = '';

      if (!reader) return;

      const currentAssistantMsgId = Date.now().toString() + "-msg";
      let currentTraceId: string | null = null;
      let openThinkingStepId: string | null = null;
      let toolRunStartedAt: number | null = null;

      let hasAssistantMsg = false;

      const ensureCurrentTraceId = () => {
        if (currentTraceId != null) return currentTraceId;
        currentTraceId = `trace-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
        traceStartedAt.current[currentTraceId] = Date.now();
        return currentTraceId;
      };

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const dataStr = line.slice(6);
            if (dataStr === '[DONE]') continue;

            try {
              const data = JSON.parse(dataStr);
              
              if (data.type === "meta") {
                if (data.conversationId) {
                  setConversationId(data.conversationId);
                  localStorage.setItem("tcm_conversation_id", data.conversationId);
                  setServerConversations(prev => {
                    if (prev.some(c => c.id === data.conversationId)) return prev;
                    return [{ id: data.conversationId, title: "" }, ...prev];
                  });
                }
                if (
                  typeof data.chatModel === "string" &&
                  data.chatModel.trim() !== ""
                ) {
                  pendingChatModelRef.current = data.chatModel.trim();
                }
              }
              else if (data.type === 'thinking-delta') {
                const piece = data.textDelta ?? "";
                const traceId = ensureCurrentTraceId();
                if (openThinkingStepId === null) {
                  const nid = `think-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
                  openThinkingStepId = nid;
                  thinkingStepStartedAt.current[nid] = Date.now();
                  setGenState('thinking');
                  setMessages((prev) => {
                    const trace = prev.find(
                      (msg): msg is TraceMessage =>
                        msg.type === "trace" && msg.id === traceId
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
                          collapsed: true,
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
                  setGenState('thinking');
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
              } 
              else if (data.type === 'tool-call') {
                const traceId = ensureCurrentTraceId();
                finalizeThinkingStep(traceId, openThinkingStepId);
                openThinkingStepId = null;
                const runKey = data.runId ?? `run-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
                const rowId = `tool-${runKey}`;
                toolRunStartedAt = Date.now();
                setGenState('tool');
                setMessages((prev) => {
                  const toolStep: ToolStep = {
                    id: rowId,
                    type: "tool",
                    toolName:
                      typeof data.name === "string" && data.name
                        ? data.name
                        : "tool",
                    status: "running",
                    runId: data.runId ?? runKey,
                    inputPreview: toolIoToPreview(
                      (data as { input?: unknown }).input
                    ),
                  };
                  const trace = prev.find(
                    (msg): msg is TraceMessage =>
                      msg.type === "trace" && msg.id === traceId
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
                        collapsed: true,
                      },
                    ];
                  }
                  return prev.map((msg) =>
                    msg.type === "trace" && msg.id === traceId
                      ? {
                          ...msg,
                          status: "streaming",
                          steps: [...msg.steps, toolStep],
                        }
                      : msg
                  );
                });
              } 
              else if (data.type === 'tool-result') {
                openThinkingStepId = null;
                const rid = data.runId as string | undefined;
                const outputPreviewFromEvent =
                  typeof data.outputPreview === "string" && data.outputPreview
                    ? data.outputPreview
                    : undefined;
                const elapsed = toolRunStartedAt != null ? Date.now() - toolRunStartedAt : 999;
                toolRunStartedAt = null;
                if (elapsed < 420) await delay(420 - elapsed);
                setMessages((prev) => {
                  return prev.map((msg) => {
                    if (msg.type !== "trace" || msg.id !== currentTraceId) return msg;
                    let idx = -1;
                    if (rid != null) {
                      idx = msg.steps.findIndex(
                        (step) =>
                          step.type === "tool" &&
                          step.status === "running" &&
                          step.runId === rid
                      );
                    }
                    if (idx === -1) {
                      idx = msg.steps.findIndex(
                        (step) => step.type === "tool" && step.status === "running"
                      );
                    }
                    if (idx === -1) return msg;
                    return {
                      ...msg,
                      steps: msg.steps.map((step, i) =>
                        i === idx && step.type === "tool"
                          ? {
                              ...step,
                              status: "success" as const,
                              outputPreview:
                                outputPreviewFromEvent ?? step.outputPreview,
                            }
                          : step
                      ),
                    };
                  });
                });
                await delay(150);
              } 
              else if (data.type === 'text-delta') {
                finalizeThinkingStep(currentTraceId, openThinkingStepId);
                openThinkingStepId = null;
                if (currentTraceId) {
                  finalizeTrace(currentTraceId, true);
                  currentTraceId = null;
                }
                // 从头脑风暴切到正文时布局剧变，避免 scrollTop 钳位被误判为上滑而停止跟滚
                autoFollowMainRef.current = true;
                if (!hasAssistantMsg) {
                  hasAssistantMsg = true;
                  setGenState('typing');
                  setMessages((prev) => [
                    ...prev,
                    {
                      id: currentAssistantMsgId,
                      role: 'assistant',
                      type: 'message',
                      content: data.textDelta,
                      modelName: pendingChatModelRef.current,
                    },
                  ]);
                } else {
                  setGenState('typing');
                  setMessages((prev) =>
                    prev.map((msg) =>
                      msg.id === currentAssistantMsgId
                        ? { ...msg, content: (msg.content || "") + data.textDelta }
                        : msg
                    )
                  );
                }
              } 
              else if (data.type === "title-updated") {
                const cid =
                  typeof data.conversationId === "string"
                    ? data.conversationId
                    : null;
                const newTitle =
                  typeof data.title === "string" ? data.title.trim() : "";
                // 必须用 SSE 里的 conversationId：新建会话时闭包里的 conversationId 仍为 null，无法用来匹配列表项
                if (cid) {
                  const nextTitle = newTitle || "新会话";
                  setServerConversations((prev) => {
                    const idx = prev.findIndex((c) => c.id === cid);
                    if (idx === -1) {
                      return [{ id: cid, title: nextTitle }, ...prev];
                    }
                    return prev.map((c) =>
                      c.id === cid ? { ...c, title: nextTitle } : c
                    );
                  });
                }
                setIsGeneratingTitle(false);
              }
              else if (data.type === 'error') {
                 console.error("Backend error:", data.message);
                 finalizeThinkingStep(currentTraceId, openThinkingStepId);
                 openThinkingStepId = null;
                 if (currentTraceId) {
                   finalizeTrace(currentTraceId, false);
                   currentTraceId = null;
                 }
                 setMessages(prev => [...prev, { id: Date.now().toString(), role: "assistant", type: "message", content: `**Error:** ${data.message}` }]);
              }
            } catch (e) {
              console.error("Error parsing SSE data", e);
            }
          }
        }
      }
      finalizeThinkingStep(currentTraceId, openThinkingStepId);
      if (currentTraceId) {
        finalizeTrace(currentTraceId, false);
      }
      await refreshServerConversations();
      setGenState('idle');
    } catch (error) {
      console.error('Chat error:', error);
      finalizeThinkingStep(currentTraceId, openThinkingStepId);
      if (currentTraceId) {
        finalizeTrace(currentTraceId, false);
      }
      thinkingStepStartedAt.current = {};
      traceStartedAt.current = {};
      setMessages(prev => [...prev, { id: Date.now().toString(), role: "assistant", type: "message", content: "**网络错误**：无法连接到服务器，请确保后端服务已启动。" }]);
      setGenState('idle');
    } finally {
      setIsGeneratingTitle(false);
    }
  };

  const handleSend = async () => {
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
  };

  const handleRegenerateAssistant = (assistantMsgId: string) => {
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
            if (step.type === "thinking") {
              delete thinkingStepStartedAt.current[step.id];
            }
          }
        }
      }
      return prev.slice(0, userIdx + 1);
    });
    void runChatStream(userText, false, { regenerateLastReply: true });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void handleSend();
    }
  };

  const handleNewChat = () => {
    localStorage.removeItem("tcm_conversation_id");
    localStorage.removeItem("tcm_anon_secret");
    setConversationId(null);
    setMessages([]);
    setShowScrollToBottom(false);
    autoFollowMainRef.current = true;
    isNearBottomRef.current = true;
    lastMainScrollTopRef.current = 0;
    thinkingStepStartedAt.current = {};
    traceStartedAt.current = {};
    setHasStarted(false);
    setGenState("idle");
    setIsGeneratingTitle(false);
    if (token) {
      void refreshServerConversations();
    }
  };

  const closeDeleteDialog = useCallback(() => {
    if (deletePending) return;
    setDeleteTargetId(null);
  }, [deletePending]);

  const openDeleteDialog = (id: string) => {
    if (!token) return;
    setDeleteTargetId(id);
  };

  const confirmDeleteConversation = async () => {
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

      if (conversationId === id) {
        handleNewChat();
      }
      setDeleteTargetId(null);
    } catch (e) {
      console.error(e);
    } finally {
      setDeletePending(false);
    }
  };

  /** 侧栏在 md 以下隐藏，移动端用顶栏骨架表示「会话标题加载中」 */
  const showMobileTitleSkeleton =
    Boolean(token) &&
    hasStarted &&
    genState !== "idle" &&
    (!conversationId ||
      !(serverConversations.find((c) => c.id === conversationId)?.title ?? "").trim());

  return (
    <div className="flex h-screen w-full overflow-hidden bg-[#fdfdfc]">
      <ConfirmDialog
        open={deleteTargetId !== null}
        title="删除会话"
        description="确定删除该会话？删除后无法恢复。"
        confirmLabel="删除"
        cancelLabel="取消"
        danger
        pending={deletePending}
        onConfirm={() => void confirmDeleteConversation()}
        onCancel={closeDeleteDialog}
      />
      <Sidebar
        conversations={token ? serverConversations : []}
        activeId={conversationId}
        onNewChat={handleNewChat}
        onSelect={handleSelectConversation}
        onDelete={openDeleteDialog}
        streamBusy={genState !== "idle"}
        isGeneratingTitle={isGeneratingTitle}
      />

      <main className="flex-1 flex flex-col relative min-w-0">
        {/* 统一的顶部 Header */}
        <header className="flex-shrink-0 h-14 flex items-center justify-between px-4 md:px-6 border-b border-[#e5e5e5] bg-white/80 backdrop-blur-sm z-10">
          <div className="flex items-center gap-2 max-w-[60%] min-w-0 flex-1 md:flex-initial">
            <div className="font-semibold text-sm shrink-0 md:hidden">TCM AI</div>
            {showMobileTitleSkeleton && (
              <div
                className="md:hidden flex-1 min-w-0 max-w-[15rem] flex items-center"
                aria-busy
                aria-label="正在加载会话标题"
              >
                <div className="skeleton-text-shimmer h-4 w-32 rounded-md" />
              </div>
            )}
            {hasStarted && conversationId && (
               <div className="hidden md:block font-medium text-sm text-gray-800 truncate min-h-[1.25rem]">
                 {isEditingTitle ? (
                   <input 
                     autoFocus
                     className="border border-gray-300 rounded px-2 py-1 text-sm outline-none focus:border-orange-400 w-full"
                     value={editTitleValue}
                     onChange={e => setEditTitleValue(e.target.value)}
                     onBlur={handleSaveTitle}
                     onKeyDown={e => { if (e.key === 'Enter') handleSaveTitle(); else if (e.key === 'Escape') setIsEditingTitle(false); }}
                   />
                 ) : isGeneratingTitle ? (
                   <span className="block text-transparent select-none" aria-hidden>
                     &nbsp;
                   </span>
                 ) : (
                   <span
                     key={
                       serverConversations.find((c) => c.id === conversationId)
                         ?.title || "会话记录"
                     }
                     className="block truncate font-medium sidebar-conv-title-sweep"
                   >
                     {serverConversations.find(c => c.id === conversationId)?.title || "会话记录"}
                   </span>
                 )}
               </div>
            )}
          </div>
          
          <div className="flex items-center gap-1 md:gap-3">
            {hasStarted && conversationId && (
               <div className="relative" ref={headerMenuRef}>
                 <button 
                   onClick={() => setHeaderMenuOpen(!headerMenuOpen)}
                   className="p-1.5 rounded-md hover:bg-gray-100 text-gray-600 transition-colors"
                 >
                   <MoreVertical className="w-5 h-5" />
                 </button>
                 {headerMenuOpen && (
                   <div className="absolute right-0 top-full mt-1 w-36 bg-white rounded-lg shadow-lg border border-[#e5e5e5] py-1 z-50">
                     <button 
                       onClick={() => {
                         setIsEditingTitle(true);
                         setEditTitleValue(serverConversations.find(c => c.id === conversationId)?.title || "");
                         setHeaderMenuOpen(false);
                       }}
                       className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                     >
                       <Edit2 className="w-4 h-4" /> 编辑标题
                     </button>
                     <button 
                       onClick={handleExportHistory}
                       className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                     >
                       <Download className="w-4 h-4" /> 导出会话
                     </button>
                     <div className="my-1 border-t border-gray-100"></div>
                     <button 
                       onClick={() => {
                         setHeaderMenuOpen(false);
                         openDeleteDialog(conversationId);
                       }}
                       className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50"
                     >
                       <Trash2 className="w-4 h-4" /> 删除会话
                     </button>
                   </div>
                 )}
               </div>
            )}

            {/* 移动端新建会话按钮 */}
            <button type="button" onClick={handleNewChat} className="p-2 md:hidden text-gray-600 hover:bg-gray-100 rounded-md">
              <Plus className="w-5 h-5" />
            </button>

            {/* 用户菜单 */}
            {authLoading ? (
              <div className="h-8 w-8 md:h-9 md:w-9 rounded-full bg-gray-200/70 animate-pulse" aria-hidden />
            ) : token ? (
              <div className="relative group">
                <button
                  type="button"
                  className="flex items-center justify-center w-8 h-8 md:w-9 md:h-9 rounded-full bg-white border border-[#e5e5e5] shadow-sm hover:bg-gray-50 transition-colors"
                  aria-label="账户"
                >
                  <span className="w-6 h-6 md:w-7 md:h-7 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center text-xs font-bold">
                    P
                  </span>
                </button>
                <div className="absolute right-0 top-full mt-2 w-32 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50">
                  <div className="bg-white rounded-lg shadow-lg border border-[#e5e5e5] py-1">
                    <button
                      onClick={logout}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
                    >
                      <LogOut className="w-4 h-4" />
                      退出登录
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <Link
                href="/login"
                className="text-sm text-gray-600 px-2 py-1 md:px-3 md:py-1.5 rounded-md hover:bg-gray-100"
              >
                登录
              </Link>
            )}
          </div>
        </header>

        <div className="flex-1 flex flex-col relative overflow-hidden">
          
          <div
            ref={scrollViewportRef}
            onScroll={updateScrollState}
            className="chat-scroll-area no-scrollbar flex-1 overflow-y-auto"
          >
            <AnimatePresence>
              {hasStarted && (
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.3 }}
                  className="pt-8"
                >
                  {messages.map((msg) => {
                    if (msg.type === "message") {
                      return (
                        <motion.div
                          key={msg.id}
                          initial={{ opacity: 0, y: 20, scale: 0.98 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          transition={messageTransition}
                        >
                          <MessageBubble
                            role={msg.role!}
                            content={msg.content!}
                            modelName={msg.modelName}
                            assistantActionsDisabled={genState !== "idle"}
                            onAssistantRegenerate={
                              msg.role === "assistant" &&
                              msg.id === lastAssistantMessageId
                                ? () => handleRegenerateAssistant(msg.id)
                                : undefined
                            }
                            onUserEdit={
                              msg.role === "user"
                                ? (text) => {
                                    setInput(text);
                                    requestAnimationFrame(() =>
                                      inputRef.current?.focus()
                                    );
                                  }
                                : undefined
                            }
                          />
                        </motion.div>
                      );
                    }
                    if (msg.type === "trace") {
                      return (
                        <motion.div
                          key={msg.id}
                          initial={{ opacity: 0, y: 15 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={messageTransition}
                        >
                          <BrainstormPanel
                            steps={msg.steps}
                            isStreaming={msg.status === "streaming"}
                            durationSec={msg.totalDurationSec}
                            collapsed={msg.collapsed}
                            onToggle={() =>
                              setMessages((prev) =>
                                prev.map((item) =>
                                  item.type === "trace" && item.id === msg.id
                                    ? { ...item, collapsed: !item.collapsed }
                                    : item
                                )
                              )
                            }
                          />
                        </motion.div>
                      );
                    }
                    return null;
                  })}
                  
                  <AnimatePresence>
                    {genState === 'waiting' && (
                      <motion.div 
                        initial={{ opacity: 0, height: 0, scale: 0.5 }}
                        animate={{ opacity: 1, height: "auto", scale: 1 }}
                        exit={{ opacity: 0, height: 0, scale: 0.5, transition: { duration: 0 } }}
                        transition={{ duration: 0.15, ease: "easeOut" }}
                        className="w-full max-w-3xl mx-auto px-4 md:px-0 flex justify-start overflow-hidden"
                        style={{ transformOrigin: "left center" }}
                      >
                        <div className="py-3">
                          <ClaudeStar />
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <div ref={messagesEndRef} className="h-[40vh] min-h-[240px] shrink-0" />
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <AnimatePresence>
            {showScrollToBottom && hasStarted && (
              <motion.button
                type="button"
                initial={{ opacity: 0, y: 10, scale: 0.92 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 10, scale: 0.92 }}
                transition={{ duration: 0.18, ease: "easeOut" }}
                onClick={() => {
                  autoFollowMainRef.current = true;
                  scrollToBottom(true);
                }}
                className="absolute left-1/2 z-20 flex -translate-x-1/2 items-center gap-2 rounded-full border border-[#e5e5e5] bg-white/92 px-3.5 py-2 text-sm text-gray-700 shadow-[0_8px_24px_rgba(0,0,0,0.08)] backdrop-blur bottom-32 md:bottom-36 hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-300"
              >
                <ArrowDown className="h-4 w-4" />
                <span>回到底部</span>
              </motion.button>
            )}
          </AnimatePresence>

          <motion.div 
            layout
            transition={springTransition}
            className={`absolute left-0 right-0 px-4 md:px-8 flex flex-col items-center z-10 ${
              hasStarted 
                ? "bottom-0 pb-6 pt-4 bg-gradient-to-t from-[#fdfdfc] via-[#fdfdfc] to-transparent" 
                : "bottom-[45%]"
            }`}
          >
            <AnimatePresence mode="popLayout">
              {!hasStarted && (
                <motion.div 
                  layout
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.96 }}
                  transition={{ duration: 0.15, ease: "easeOut" }}
                  className="mb-8 flex items-center gap-3 text-3xl md:text-4xl font-serif text-[#1a1a1a]"
                >
                  <Sun className="w-8 h-8 text-orange-500" />
                  <span>需要中医咨询吗？</span>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="w-full max-w-3xl relative">
              <motion.div 
                layout
                transition={springTransition}
                className="relative flex flex-col w-full bg-white rounded-2xl border border-[#e5e5e5] shadow-[0_2px_10px_rgba(0,0,0,0.02)] focus-within:border-gray-300 focus-within:shadow-[0_4px_20px_rgba(0,0,0,0.05)] transition-shadow overflow-hidden"
              >
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="描述您的症状，或询问中医知识..."
                  className="no-scrollbar w-full max-h-[200px] min-h-[60px] overflow-y-auto py-4 px-4 bg-transparent resize-none outline-none text-[16px] text-gray-800 placeholder:text-gray-400"
                  rows={1}
                />
                
                <motion.div layout="position" className="flex items-center justify-between px-3 pb-3 pt-1">
                  <button className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
                    <Plus className="w-5 h-5" />
                  </button>
                  
                  <div className="flex items-center gap-2">
                    <button className="flex items-center gap-1.5 px-2.5 py-1.5 text-sm font-medium text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">
                      TCM Pro 1.0
                      <ChevronDown className="w-3.5 h-3.5" />
                    </button>
                    
                    <button
                      type="button"
                      onClick={() => void handleSend()}
                      disabled={genState !== "idle"}
                      className={`p-1.5 rounded-lg transition-all duration-200 flex items-center justify-center ${
                        input.trim() && genState === "idle"
                          ? "bg-black text-white hover:bg-gray-800 scale-105"
                          : "bg-transparent text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                      }`}
                    >
                      {input.trim() ? <Send className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                    </button>
                  </div>
                </motion.div>
              </motion.div>

              <AnimatePresence mode="popLayout">
                {!hasStarted && (
                  <motion.div 
                    layout
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.96 }}
                    transition={{ duration: 0.15, ease: "easeOut" }}
                    className="flex flex-wrap items-center justify-center gap-2 mt-6"
                  >
                    <motion.button
                      type="button"
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() =>
                        setInput("我最近总是失眠多梦，该怎么调理？")
                      }
                      className="flex items-center gap-2 px-4 py-2 bg-white border border-[#e5e5e5] rounded-full text-sm text-gray-600 hover:bg-gray-50 transition-colors shadow-sm"
                    >
                      <PenLine className="w-4 h-4 text-blue-500" />
                      症状自查
                    </motion.button>
                    <motion.button
                      type="button"
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() =>
                        setInput("六味地黄丸的功效和禁忌是什么？")
                      }
                      className="flex items-center gap-2 px-4 py-2 bg-white border border-[#e5e5e5] rounded-full text-sm text-gray-600 hover:bg-gray-50 transition-colors shadow-sm"
                    >
                      <BookOpen className="w-4 h-4 text-green-500" />
                      方剂查询
                    </motion.button>
                    <motion.button
                      type="button"
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() =>
                        setInput("春季养肝有什么好的食疗建议？")
                      }
                      className="flex items-center gap-2 px-4 py-2 bg-white border border-[#e5e5e5] rounded-full text-sm text-gray-600 hover:bg-gray-50 transition-colors shadow-sm"
                    >
                      <Leaf className="w-4 h-4 text-orange-500" />
                      节气养生
                    </motion.button>
                  </motion.div>
                )}
              </AnimatePresence>
              
              <AnimatePresence>
                {hasStarted && (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3, duration: 0.4 }}
                    className="text-center mt-3 text-xs text-gray-400 font-medium"
                  >
                    AI 可能会产生误导性信息，请结合实际情况判断。
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        </div>
      </main>
    </div>
  );
}
