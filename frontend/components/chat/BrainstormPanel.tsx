"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import clsx from "clsx";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, Loader2 } from "lucide-react";

import { displayToolNameZh } from "@/lib/tool-labels";

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
      /** 工具入参摘要（SSE tool-call 或历史消息） */
      inputPreview?: string;
      /** 工具返回摘要（SSE tool-result 或历史消息） */
      outputPreview?: string;
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

type WebResultItem = {
  title: string;
  url?: string;
  summary?: string;
};


function toolActionLabel(toolName: string): string {
  if (toolName === "searx_web_search") return "联网搜索";
  if (toolName === "search_tcm_knowledge") return "检索知识库";
  if (toolName === "formula_lookup") return "查询方剂";
  if (toolName === "recommend_formulas") return "推荐方剂";
  return displayToolNameZh(toolName);
}

function runningToolLabel(toolName: string): string {
  const action = toolActionLabel(toolName);
  return action.startsWith("正在") ? `${action}...` : `正在${action}...`;
}

function toolFailureLabel(toolName: string): string {
  return `${toolActionLabel(toolName)}失败(>﹏<)`;
}

function parseWebResults(raw?: string): WebResultItem[] {
  if (!raw) return [];
  return raw
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block) => {
      const lines = block.split("\n").map((line) => line.trim()).filter(Boolean);
      const titleLine = lines[0] ?? "";
      const title = titleLine
        .replace(/^\[\d+\](\s*\[[^\]]*\])?\s*/, "")
        .trim();
      const urlIdx = lines.findIndex((line) => /^https?:\/\//i.test(line));
      return {
        title: title || "(无标题)",
        url: urlIdx >= 0 ? lines[urlIdx] : undefined,
        summary:
          urlIdx >= 0
            ? lines.slice(urlIdx + 1).join(" ")
            : lines.slice(1).join(" "),
      };
    })
    .filter((item) => item.title || item.url)
    .slice(0, 10);
}

function parseSummaryBlocks(raw?: string): string[] {
  if (!raw) return [];
  const blocks = raw.split(/\n{2,}/).map((block) => block.trim()).filter(Boolean);
  const source = blocks.length > 0 ? blocks : [raw.trim()];
  return source.slice(0, 5).map((block) => {
    const cleaned = block
      .replace(/^\[\d+\]\s*/, "")
      .replace(/^（[^）]+）\s*/, "")
      .replace(/\s+/g, " ")
      .trim();
    return cleaned.length > 150 ? `${cleaned.slice(0, 149)}…` : cleaned;
  });
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
  /** 用于检测「刚从收起变为展开」，此时应强制滚到底（不能依赖 distance≤阈值） */
  const wasOpenRef = useRef(false);
  const [brainstormEdgeFade, setBrainstormEdgeFade] = useState<EdgeFadeState>({
    top: false,
    bottom: false,
  });
  const [toolIoExpanded, setToolIoExpanded] = useState<Record<string, boolean>>({});

  const toggleToolIo = useCallback((stepId: string) => {
    setToolIoExpanded((prev) => ({ ...prev, [stepId]: !prev[stepId] }));
  }, []);

  const isOpen = !collapsed;

  const traceHeadline = (() => {
    if (!isStreaming) {
      return durationSec != null
        ? `头脑风暴结束 · ${formatDurationSec(durationSec)}`
        : "头脑风暴结束";
    }
    for (let i = steps.length - 1; i >= 0; i--) {
      const step = steps[i];
      if (step.type === "tool" && step.status === "running") {
        return runningToolLabel(step.toolName);
      }
    }
    return "头脑风暴中...";
  })();

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

  const scrollBrainstormToEnd = useCallback(() => {
    const el = brainstormScrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
    lastBrainstormScrollTopRef.current = el.scrollTop;
    setBrainstormEdgeFade(getEdgeFadeState(el));
  }, []);

  // 刚从收起展开：强制跟到底（展开瞬间 scrollTop=0 时 distance 很大，旧逻辑不会滚）
  useLayoutEffect(() => {
    if (!isOpen) {
      wasOpenRef.current = false;
      return;
    }
    const justOpened = !wasOpenRef.current;
    wasOpenRef.current = true;
    if (!justOpened) return;
    autoFollowBrainstormRef.current = true;
    scrollBrainstormToEnd();
    let cancelled = false;
    const raf1 = requestAnimationFrame(() => {
      if (cancelled) return;
      scrollBrainstormToEnd();
      requestAnimationFrame(() => {
        if (cancelled) return;
        scrollBrainstormToEnd();
      });
    });
    const t = window.setTimeout(() => {
      if (!cancelled) scrollBrainstormToEnd();
    }, 280);
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf1);
      window.clearTimeout(t);
    };
  }, [isOpen, scrollBrainstormToEnd]);

  // 外层头脑风暴滚动区：内容变化时，若开启跟滚或已在底部附近则滚到底
  useEffect(() => {
    if (!isOpen) return;
    const el = brainstormScrollRef.current;
    if (!el) return;
    const distance = el.scrollHeight - el.scrollTop - el.clientHeight;
    if (
      autoFollowBrainstormRef.current ||
      distance <= INTERNAL_SCROLL_THRESHOLD
    ) {
      if (distance <= INTERNAL_SCROLL_THRESHOLD) {
        autoFollowBrainstormRef.current = true;
      }
      el.scrollTop = el.scrollHeight;
      lastBrainstormScrollTopRef.current = el.scrollTop;
    }
    setBrainstormEdgeFade(getEdgeFadeState(el));
  }, [steps, isOpen, scrollBrainstormToEnd]);

  useEffect(() => {
    if (!isOpen) return;
    const el = brainstormScrollRef.current;
    if (!el) return;
    setBrainstormEdgeFade(getEdgeFadeState(el));
  }, [isOpen]);

  return (
    <div className="flex w-full max-w-3xl lg:max-w-4xl xl:max-w-5xl justify-start px-4 pt-1.5 pb-2 sm:px-5 md:mx-auto md:px-6 lg:px-8">
      <div className="w-full max-w-full">
        <button
          type="button"
          onClick={onToggle}
          className="relative isolate flex w-fit max-w-full cursor-pointer items-center gap-1.5 overflow-hidden text-left transition-opacity hover:opacity-70 focus-visible:outline-none"
          aria-expanded={isOpen}
        >
          <motion.span
            animate={{ rotate: isOpen ? 0 : -90 }}
            transition={{ duration: 0.18, ease: "easeInOut" }}
            className="relative z-0 shrink-0 text-gray-400"
          >
            <ChevronDown className="h-3.5 w-3.5" />
          </motion.span>
          <AnimatePresence mode="wait" initial={false}>
            <motion.span
              key={traceHeadline}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="relative z-0 truncate text-[13px] font-medium text-gray-500"
            >
              {traceHeadline}
            </motion.span>
          </AnimatePresence>
          {isStreaming && (
            <span
              aria-hidden
              className="brainstorm-sweep pointer-events-none absolute inset-0 z-[1] rounded-2xl mix-blend-soft-light"
            />
          )}
        </button>

        {/* ── 展开内容 ────────────────────────────────── */}
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
                  onWheel={(e) => {
                    const el = brainstormScrollRef.current;
                    if (!el) return;
                    const atTop = el.scrollTop === 0;
                    const atBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 1;
                    if ((atTop && e.deltaY < 0) || (atBottom && e.deltaY > 0)) return;
                    e.stopPropagation();
                  }}
                  className="brainstorm-scroll-area no-scrollbar max-h-[min(28rem,58vh)] overflow-y-auto px-4 pb-4 pr-3 [scrollbar-width:none] [-ms-overflow-style:none]"
                >
                  {/* 步骤列表 */}
                  <div className="relative flex flex-col pl-5">
                    {/* 时间轴竖线 */}
                    <span
                      aria-hidden
                      className="pointer-events-none absolute left-[0.55rem] top-1 bottom-1 w-px rounded-full bg-gradient-to-b from-[#f1ebe1] via-[#e6ddd0] to-[#f3ede5] opacity-60"
                    />

                    {steps.map((step, idx) => {
                      const isFirst = idx === 0;
                      if (step.type === "thinking") {
                        const active = step.durationSec == null;
                        return (
                          <div
                            key={step.id}
                            className={clsx(
                              "relative pl-3",
                              isFirst ? "mt-2" : "mt-3"
                            )}
                          >
                            <p className="whitespace-pre-wrap text-[13px] italic leading-relaxed text-gray-500">
                              {step.content}
                              {active && (
                                <span className="ml-1 inline-block h-3.5 w-1 animate-pulse bg-gray-400 align-middle" />
                              )}
                            </p>
                          </div>
                        );
                      }

                      /* 工具行：默认一行，成功后可展开看规整结果；失败不暴露后台错误 */
                      const failed = step.status === "error";
                      const webResults =
                        step.toolName === "searx_web_search" && !failed
                          ? parseWebResults(step.outputPreview)
                          : [];
                      const summaries =
                        step.toolName !== "searx_web_search" && !failed
                          ? parseSummaryBlocks(step.outputPreview)
                          : [];
                      const canExpand =
                        step.status === "success" &&
                        !failed &&
                        (webResults.length > 0 || summaries.length > 0);
                      const expanded = !!toolIoExpanded[step.id];

                      const toolLine =
                        step.status === "running"
                          ? runningToolLabel(step.toolName)
                          : failed
                          ? toolFailureLabel(step.toolName)
                          : step.toolName === "searx_web_search"
                          ? `找到了 ${webResults.length} 篇相关资料`
                          : step.toolName === "formula_lookup"
                          ? `找到了 ${summaries.length > 0 ? summaries.length : 1} 处方剂`
                          : `知识库检索成功`;

                      const lineClass = clsx(
                        "relative flex w-fit max-w-full items-center gap-1.5 rounded-md px-1 py-0.5 text-left text-[13px] transition-colors",
                        failed ? "text-gray-400 cursor-default" : "text-[#5b78ad]",
                        canExpand && "cursor-pointer hover:bg-[#5b78ad]/[0.07]",
                        !canExpand && !failed && "cursor-default"
                      );

                      const lineInner = (
                        <>
                          {step.status === "running" && (
                            <Loader2 className="h-3 w-3 shrink-0 animate-spin text-[#5b78ad]/60" />
                          )}
                          <span className="min-w-0 truncate">
                            {toolLine}
                          </span>
                          {canExpand ? (
                            <ChevronDown
                              aria-hidden
                              className={clsx(
                                "h-3 w-3 shrink-0 text-[#5b78ad]/50 transition-transform duration-200",
                                expanded && "rotate-180"
                              )}
                            />
                          ) : null}
                        </>
                      );

                      return (
                        <div
                          key={step.id}
                          className={clsx(
                            "relative pl-3",
                            isFirst ? "mt-2" : "mt-2.5"
                          )}
                        >
                          {canExpand ? (
                            <button
                              type="button"
                              className={lineClass}
                              aria-expanded={expanded}
                              title={step.toolName}
                              onClick={() => toggleToolIo(step.id)}
                            >
                              {lineInner}
                            </button>
                          ) : (
                            <div className={lineClass} title={step.toolName}>
                              {lineInner}
                            </div>
                          )}

                          <AnimatePresence initial={false}>
                            {canExpand && expanded && (
                              <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: "auto", opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                transition={{ duration: 0.22, ease: "easeInOut" }}
                                className="overflow-hidden"
                              >
                                <div className="mt-1.5 max-h-64 overflow-y-auto pl-1 pr-2 text-[13px] leading-relaxed text-gray-500">
                                  {webResults.length > 0 ? (
                                    <ol className="space-y-1.5">
                                      {webResults.map((item, itemIdx) => (
                                        <li
                                          key={`${item.title}-${itemIdx}`}
                                          className="flex gap-2"
                                        >
                                          <span className="shrink-0 tabular-nums text-gray-400">
                                            {itemIdx + 1}.
                                          </span>
                                          {item.url ? (
                                            <a
                                              href={item.url}
                                              target="_blank"
                                              rel="noreferrer"
                                              className="min-w-0 text-gray-600 underline-offset-4 hover:text-[#5b78ad] hover:underline"
                                            >
                                              {item.title} ↗
                                            </a>
                                          ) : (
                                            <span>{item.title}</span>
                                          )}
                                        </li>
                                      ))}
                                    </ol>
                                  ) : (
                                    <div className="space-y-2">
                                      {summaries.map((summary, summaryIdx) => (
                                        <p
                                          key={`${summary}-${summaryIdx}`}
                                          className="border-l border-[#e2d8ca] pl-3 text-gray-500"
                                        >
                                          {summary}
                                        </p>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      );
                    })}
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
