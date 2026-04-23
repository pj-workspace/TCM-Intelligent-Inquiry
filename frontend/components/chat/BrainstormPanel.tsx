"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import clsx from "clsx";
import { motion, AnimatePresence } from "framer-motion";
import {
  BrainCircuit,
  Check,
  ChevronDown,
  Loader2,
  Sparkles,
  Wrench,
} from "lucide-react";

export type BrainstormStep =
  | {
      id: string;
      type: "thinking";
      content: string;
      durationSec?: number;
    }
  | {
      id: string;
      type: "tool";
      toolName: string;
      runId?: string;
      status: "running" | "success" | "error";
    };

interface BrainstormPanelProps {
  steps: BrainstormStep[];
  isStreaming: boolean;
  durationSec?: number;
  collapsed?: boolean;
  onToggle?: () => void;
}

const INTERNAL_SCROLL_THRESHOLD = 72;
const INTERNAL_LOCK_THRESHOLD = 8;
type EdgeFadeState = { top: boolean; bottom: boolean };

function formatDurationSec(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) return "0s";
  if (sec < 10) return `${Math.round(sec * 10) / 10}s`;
  return `${Math.round(sec)}s`;
}

function getEdgeFadeState(el: HTMLDivElement | null): EdgeFadeState {
  if (!el) return { top: false, bottom: false };
  const maxScrollTop = Math.max(0, el.scrollHeight - el.clientHeight);
  if (maxScrollTop <= 2) return { top: false, bottom: false };
  return {
    top: el.scrollTop > 6,
    bottom: el.scrollTop < maxScrollTop - 6,
  };
}

export function BrainstormPanel({
  steps,
  isStreaming,
  durationSec,
  collapsed = false,
  onToggle,
}: BrainstormPanelProps) {
  const brainstormScrollRef = useRef<HTMLDivElement>(null);
  const autoFollowBrainstormRef = useRef(true);
  const lastBrainstormScrollTopRef = useRef(0);
  const thinkingScrollRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const thinkingAutoFollowRef = useRef<Record<string, boolean>>({});
  const thinkingLastScrollTopRef = useRef<Record<string, number>>({});
  const prevPanelCollapsedRef = useRef<boolean | null>(null);
  const prevActiveThinkingIdRef = useRef<string | null>(null);
  const autoCollapsedThinkingDoneRef = useRef<Set<string>>(new Set());
  const [brainstormEdgeFade, setBrainstormEdgeFade] = useState<EdgeFadeState>({
    top: false,
    bottom: false,
  });
  const [thinkingEdgeFades, setThinkingEdgeFades] = useState<
    Record<string, EdgeFadeState>
  >({});
  const [collapsedThinkingIds, setCollapsedThinkingIds] = useState<
    Record<string, boolean>
  >({});

  const isThinkingCollapsed = useCallback((id: string) => {
    return collapsedThinkingIds[id] ?? true;
  }, [collapsedThinkingIds]);
  const finishedThinkingCount = useMemo(
    () =>
      steps.filter(
        (step) => step.type === "thinking" && typeof step.durationSec === "number"
      ).length,
    [steps]
  );

  const title = isStreaming ? "头脑风暴中" : "头脑风暴";
  const isOpen = !collapsed;
  const activeThinkingStep = useMemo(() => {
    for (let i = steps.length - 1; i >= 0; i--) {
      const step = steps[i];
      if (step.type === "thinking" && step.durationSec == null) {
        return step;
      }
    }
    return null;
  }, [steps]);

  const updateBrainstormScrollState = useCallback(() => {
    const el = brainstormScrollRef.current;
    if (!el) return;
    const currentTop = el.scrollTop;
    const prevTop = lastBrainstormScrollTopRef.current;
    const distance = el.scrollHeight - el.scrollTop - el.clientHeight;
    const userScrolledUp = currentTop < prevTop - 2;
    const atBottom = distance <= INTERNAL_LOCK_THRESHOLD;
    if (userScrolledUp) {
      autoFollowBrainstormRef.current = false;
    } else if (atBottom) {
      autoFollowBrainstormRef.current = true;
    }
    lastBrainstormScrollTopRef.current = currentTop;
    const nextFade = getEdgeFadeState(el);
    setBrainstormEdgeFade((prev) =>
      prev.top === nextFade.top && prev.bottom === nextFade.bottom
        ? prev
        : nextFade
    );
  }, []);

  const updateThinkingScrollState = useCallback((id: string) => {
    const el = thinkingScrollRefs.current[id];
    if (!el) return;
    const currentTop = el.scrollTop;
    const prevTop = thinkingLastScrollTopRef.current[id] ?? 0;
    const distance = el.scrollHeight - el.scrollTop - el.clientHeight;
    const userScrolledUp = currentTop < prevTop - 2;
    const atBottom = distance <= INTERNAL_LOCK_THRESHOLD;
    if (userScrolledUp) {
      thinkingAutoFollowRef.current[id] = false;
    } else if (atBottom) {
      thinkingAutoFollowRef.current[id] = true;
    }
    thinkingLastScrollTopRef.current[id] = currentTop;
    const nextFade = getEdgeFadeState(el);
    setThinkingEdgeFades((prev) => {
      const cur = prev[id];
      if (cur?.top === nextFade.top && cur?.bottom === nextFade.bottom) {
        return prev;
      }
      return { ...prev, [id]: nextFade };
    });
  }, []);

  /** 用户展开头脑风暴时：所有思考先收起；若仍在流式输出，则只展开当前进行中的那一段 */
  useEffect(() => {
    const wasCollapsed = prevPanelCollapsedRef.current;
    prevPanelCollapsedRef.current = collapsed;
    if (wasCollapsed !== true || collapsed !== false) return;

    const next: Record<string, boolean> = {};
    for (const s of steps) {
      if (s.type === "thinking") {
        next[s.id] = true;
      }
    }
    if (isStreaming) {
      for (let i = steps.length - 1; i >= 0; i--) {
        const s = steps[i];
        if (s.type === "thinking" && s.durationSec == null) {
          next[s.id] = false;
          break;
        }
      }
    }
    queueMicrotask(() => {
      setCollapsedThinkingIds(next);
    });
  }, [collapsed, steps, isStreaming]);

  /** 某段思考刚结束（首次出现 duration）时自动收起正文，避免与用户手动展开打架 */
  useEffect(() => {
    for (const s of steps) {
      if (s.type !== "thinking" || s.durationSec == null) continue;
      if (autoCollapsedThinkingDoneRef.current.has(s.id)) continue;
      autoCollapsedThinkingDoneRef.current.add(s.id);
      queueMicrotask(() => {
        setCollapsedThinkingIds((prev) => ({ ...prev, [s.id]: true }));
      });
    }
  }, [steps]);

  /** 流式进行中：新开始的一段思考自动展开正文，便于跟随输出 */
  useEffect(() => {
    const id = activeThinkingStep?.id ?? null;
    if (!isOpen || !isStreaming || !id) {
      prevActiveThinkingIdRef.current = id;
      return;
    }
    if (prevActiveThinkingIdRef.current === id) return;
    prevActiveThinkingIdRef.current = id;
    queueMicrotask(() => {
      setCollapsedThinkingIds((prev) => ({ ...prev, [id]: false }));
    });
  }, [activeThinkingStep, isOpen, isStreaming]);

  useEffect(() => {
    if (!isOpen) return;
    const el = brainstormScrollRef.current;
    if (!el) return;
    const distance = el.scrollHeight - el.scrollTop - el.clientHeight;
    if (distance <= INTERNAL_SCROLL_THRESHOLD) {
      autoFollowBrainstormRef.current = true;
      el.scrollTop = el.scrollHeight;
      lastBrainstormScrollTopRef.current = el.scrollTop;
    }
    setBrainstormEdgeFade(getEdgeFadeState(el));
  }, [steps, isOpen]);

  useEffect(() => {
    if (
      !isOpen ||
      !activeThinkingStep ||
      isThinkingCollapsed(activeThinkingStep.id)
    ) {
      return;
    }
    const id = activeThinkingStep.id;
    const el = thinkingScrollRefs.current[id];
    if (!el) return;
    const distance = el.scrollHeight - el.scrollTop - el.clientHeight;
    const shouldFollow =
      thinkingAutoFollowRef.current[id] !== false ||
      distance <= INTERNAL_SCROLL_THRESHOLD;
    if (!shouldFollow) return;
    thinkingAutoFollowRef.current[id] = true;
    el.scrollTop = el.scrollHeight;
    thinkingLastScrollTopRef.current[id] = el.scrollTop;
    setThinkingEdgeFades((prev) => ({
      ...prev,
      [id]: getEdgeFadeState(el),
    }));
  }, [
    activeThinkingStep,
    collapsedThinkingIds,
    isOpen,
    isThinkingCollapsed,
    steps,
  ]);

  useEffect(() => {
    if (!isOpen) return;
    const el = brainstormScrollRef.current;
    if (!el) return;
    setBrainstormEdgeFade(getEdgeFadeState(el));
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const next: Record<string, EdgeFadeState> = {};
    for (const step of steps) {
      if (step.type !== "thinking" || isThinkingCollapsed(step.id)) continue;
      next[step.id] = getEdgeFadeState(thinkingScrollRefs.current[step.id] ?? null);
    }
    setThinkingEdgeFades((prev) => ({ ...prev, ...next }));
  }, [collapsedThinkingIds, isOpen, isThinkingCollapsed, steps]);

  return (
    <div className="flex gap-4 w-full max-w-3xl mx-auto py-2 px-4 md:px-0 justify-start">
      <div className="max-w-[85%] w-full rounded-2xl border border-[#ece9e3] bg-[#fbfaf7] shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
        <button
          type="button"
          onClick={onToggle}
          className="relative isolate flex w-full cursor-pointer items-center justify-between gap-3 overflow-hidden rounded-2xl px-4 py-3 text-left transition-colors hover:bg-white/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-300"
          aria-expanded={isOpen}
        >
          <span className="relative z-0 flex min-w-0 items-center gap-2.5">
            <motion.span
              animate={{ rotate: isOpen ? 0 : -90 }}
              transition={{ duration: 0.22, ease: "easeInOut" }}
              className="shrink-0 text-gray-400"
            >
              <ChevronDown className="h-4 w-4" />
            </motion.span>
            <span
              className={clsx(
                "flex h-7 w-7 shrink-0 items-center justify-center rounded-full border",
                isStreaming
                  ? "border-orange-200 bg-orange-50 text-orange-500"
                  : "border-[#e5e5e5] bg-white text-gray-500"
              )}
            >
              {isStreaming ? (
                <Sparkles className="h-3.5 w-3.5 animate-pulse" />
              ) : (
                <BrainCircuit className="h-3.5 w-3.5" />
              )}
            </span>
            <span className="min-w-0">
              <span className="block truncate text-[13px] font-medium text-gray-700">
                {title}
              </span>
              {!isStreaming && (
                <span className="block truncate text-xs text-gray-500">
                  {`共 ${steps.length} 个阶段${
                    finishedThinkingCount > 0
                      ? `，${finishedThinkingCount} 段思考`
                      : ""
                  }`}
                </span>
              )}
            </span>
          </span>

          <span className="relative z-0 shrink-0 text-right">
            <span className="block text-[13px] font-medium tabular-nums text-gray-700">
              {durationSec != null ? formatDurationSec(durationSec) : isStreaming ? "..." : ""}
            </span>
            <span className="block text-[11px] text-gray-400">
              {isStreaming ? "进行中" : durationSec != null ? "总耗时" : ""}
            </span>
          </span>
          {isStreaming && collapsed && (
            <span
              aria-hidden
              className="brainstorm-sweep pointer-events-none absolute inset-0 z-[1] rounded-2xl mix-blend-soft-light"
            />
          )}
        </button>

        <AnimatePresence initial={false}>
          {isOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.25, ease: "easeInOut" }}
              className="overflow-hidden"
            >
              <div className="scroll-fade-shell relative">
                <div
                  ref={brainstormScrollRef}
                  onScroll={updateBrainstormScrollState}
                  className="brainstorm-scroll-area no-scrollbar max-h-[min(28rem,58vh)] overflow-y-auto overscroll-contain px-4 pb-4 pr-3 [scrollbar-width:none] [-ms-overflow-style:none]"
                >
                  <div className="relative pl-5">
                    <span
                      aria-hidden
                      className="pointer-events-none absolute left-[0.55rem] top-1 bottom-1 w-px rounded-full bg-gradient-to-b from-[#f1ebe1] via-[#e6ddd0] to-[#f3ede5] opacity-70"
                    />
                    <div className="space-y-3">
                  {steps.map((step) =>
                    step.type === "thinking" ? (
                      <div key={step.id} className="relative pl-4 pt-0.5">
                        <span
                          aria-hidden
                          className={clsx(
                            "absolute left-[0.06rem] top-[0.76rem] h-1.5 w-1.5 rounded-full shadow-[0_0_0_3px_#fbfaf7]",
                            step.durationSec == null
                              ? "bg-[#d8b57a]"
                              : "bg-[#ddd4c7]"
                          )}
                        />
                        <button
                          type="button"
                          onClick={() =>
                            setCollapsedThinkingIds((prev) => {
                              const cur = prev[step.id] ?? true;
                              return { ...prev, [step.id]: !cur };
                            })
                          }
                          className={clsx(
                            "relative isolate flex w-full cursor-pointer items-center justify-between gap-3 overflow-hidden rounded-xl px-2 py-1 text-left transition-colors hover:bg-white/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-200",
                            step.durationSec == null &&
                              isThinkingCollapsed(step.id) &&
                              "bg-white/40"
                          )}
                          aria-expanded={!isThinkingCollapsed(step.id)}
                        >
                          <span className="relative z-0 flex min-w-0 items-center gap-2">
                            <motion.span
                              animate={{
                                rotate: isThinkingCollapsed(step.id) ? -90 : 0,
                              }}
                              transition={{ duration: 0.18, ease: "easeInOut" }}
                              className="shrink-0 text-gray-400"
                            >
                              <ChevronDown className="h-3.5 w-3.5" />
                            </motion.span>
                            <span className="text-[12px] font-medium text-gray-500">
                              {step.durationSec != null ? "思考过程" : "思考中..."}
                            </span>
                          </span>
                          <span className="relative z-0 text-[12px] tabular-nums text-gray-400">
                            {step.durationSec != null
                              ? formatDurationSec(step.durationSec)
                              : ""}
                          </span>
                          {step.durationSec == null &&
                            isThinkingCollapsed(step.id) && (
                              <span
                                aria-hidden
                                className="thinking-shimmer-sweep pointer-events-none absolute inset-0 z-[1] rounded-xl mix-blend-soft-light"
                              />
                            )}
                        </button>
                        <AnimatePresence initial={false}>
                          {!isThinkingCollapsed(step.id) && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: "auto", opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              transition={{ duration: 0.22, ease: "easeInOut" }}
                              className="overflow-hidden"
                            >
                              <div className="scroll-fade-shell relative mt-1">
                                <div
                                  ref={(el) => {
                                    thinkingScrollRefs.current[step.id] = el;
                                  }}
                                  onScroll={() => updateThinkingScrollState(step.id)}
                                  className="thinking-scroll-area no-scrollbar max-h-[min(10rem,24vh)] overflow-y-auto overscroll-contain rounded-xl bg-transparent px-3 py-2.5 [scrollbar-width:none] [-ms-overflow-style:none]"
                                >
                                  <div className="relative pl-4">
                                    <span
                                      aria-hidden
                                      className="absolute left-0 top-0 bottom-0 w-px rounded-full bg-gradient-to-b from-[#e7dfd3] via-[#d7cebf] to-[#ece5da]"
                                    />
                                    <p className="whitespace-pre-wrap text-[14px] italic leading-relaxed text-gray-600">
                                      {step.content}
                                      {step.durationSec == null && (
                                        <span className="ml-1 inline-block h-4 w-1.5 animate-pulse bg-gray-400 align-middle" />
                                      )}
                                    </p>
                                  </div>
                                </div>
                                <span
                                  aria-hidden
                                  className={clsx(
                                    "scroll-fade-top",
                                    thinkingEdgeFades[step.id]?.top && "is-visible"
                                  )}
                                />
                                <span
                                  aria-hidden
                                  className={clsx(
                                    "scroll-fade-bottom",
                                    thinkingEdgeFades[step.id]?.bottom && "is-visible"
                                  )}
                                />
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    ) : (
                      <div key={step.id} className="relative pl-4 pt-0.5">
                        <span
                          aria-hidden
                          className={clsx(
                            "absolute left-[0.06rem] top-[0.98rem] h-1.5 w-1.5 rounded-full shadow-[0_0_0_3px_#fbfaf7]",
                            step.status === "running"
                              ? "bg-[#d8b57a]"
                              : step.status === "success"
                              ? "bg-[#cfdbc8]"
                              : "bg-[#e7c2c2]"
                          )}
                        />
                        <div
                          className={clsx(
                            "flex items-center gap-2.5 rounded-xl border px-3.5 py-2.5 text-[13px] transition-colors",
                            step.status === "running"
                              ? "border-orange-200 bg-white text-gray-700 shadow-[0_0_0_1px_rgba(251,146,60,0.12)]"
                              : step.status === "success"
                              ? "border-[#e5e5e5] bg-white text-gray-600"
                              : "border-red-100 bg-red-50 text-red-600"
                          )}
                        >
                          {step.status === "running" ? (
                            <Loader2 className="h-4 w-4 shrink-0 animate-spin text-orange-500" />
                          ) : step.status === "success" ? (
                            <Check className="h-4 w-4 shrink-0 text-green-500" />
                          ) : (
                            <Wrench className="h-4 w-4 shrink-0 text-red-500" />
                          )}
                          <span className="flex min-w-0 flex-wrap items-center gap-1.5">
                            <span>
                              {step.status === "running"
                                ? "调用工具中"
                                : step.status === "success"
                                ? "工具调用成功"
                                : "工具调用失败"}
                            </span>
                            <span className="text-gray-300">·</span>
                            <span className="rounded-md bg-gray-100 px-1.5 py-0.5 font-mono text-xs text-gray-600">
                              {step.toolName}
                            </span>
                          </span>
                        </div>
                      </div>
                    )
                  )}
                    </div>
                  </div>
                </div>
                <span
                  aria-hidden
                  className={clsx(
                    "scroll-fade-top",
                    brainstormEdgeFade.top && "is-visible"
                  )}
                />
                <span
                  aria-hidden
                  className={clsx(
                    "scroll-fade-bottom",
                    brainstormEdgeFade.bottom && "is-visible"
                  )}
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
