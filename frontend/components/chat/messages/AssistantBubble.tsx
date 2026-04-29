"use client";

import type { RefObject } from "react";
import clsx from "clsx";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  Copy,
  Check,
  MoreVertical,
  RefreshCw,
  Volume2,
  Square,
  FileDown,
  Sparkles,
} from "lucide-react";
import {
  assistantMarkdownComponents,
  preprocessAssistantMarkdown,
  exportAssistantAsPdf,
} from "@/lib/markdown-utils";

interface AssistantBubbleProps {
  content: string;
  modelName?: string;
  assistantActionsDisabled?: boolean;
  onAssistantRegenerate?: () => void;
  noTopPad?: boolean;
  interrupted?: boolean;
  copied: boolean;
  onCopy: () => void;
  ttsPlaying: boolean;
  onToggleTts: () => void;
  menuOpen: boolean;
  onMenuToggle: () => void;
  menuRef: RefObject<HTMLDivElement | null>;
}

export function AssistantBubble({
  content,
  modelName,
  assistantActionsDisabled,
  onAssistantRegenerate,
  noTopPad,
  interrupted,
  copied,
  onCopy,
  ttsPlaying,
  onToggleTts,
  menuOpen,
  onMenuToggle,
  menuRef,
}: AssistantBubbleProps) {
  return (
    <div
      className={clsx(
        "flex w-full max-w-3xl lg:max-w-4xl xl:max-w-5xl mx-auto px-4 sm:px-5 md:px-6 lg:px-8 justify-start",
        noTopPad ? "pt-0 pb-4" : "py-4"
      )}
    >
      <div className="flex min-w-0 w-full max-w-full flex-col items-start gap-2">
        <div className="text-[15px] leading-relaxed bg-transparent text-[#1a1a1a] ai-content w-full min-w-0 md:max-w-[68ch] lg:max-w-[80ch] xl:max-w-[96ch]">
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={assistantMarkdownComponents}
          >
            {preprocessAssistantMarkdown(
              content + (interrupted ? "\n\n> *输出已被终止*" : "")
            )}
          </ReactMarkdown>
        </div>

        {!assistantActionsDisabled && (
          <div className="flex flex-wrap items-center gap-0.5 mt-1">
            <button
              type="button"
              disabled={!onAssistantRegenerate}
              onClick={onAssistantRegenerate}
              className="p-1.5 rounded-lg text-gray-500 hover:text-gray-800 hover:bg-black/5 disabled:opacity-40 disabled:pointer-events-none transition-colors"
              title="重新生成"
              aria-label="重新生成"
            >
              <RefreshCw className="w-4 h-4" strokeWidth={1.75} />
            </button>
            <button
              type="button"
              onClick={onCopy}
              className="p-1.5 rounded-lg text-gray-500 hover:text-gray-800 hover:bg-black/5 transition-colors"
              title={copied ? "已复制" : "复制"}
              aria-label={copied ? "已复制" : "复制"}
            >
              {copied ? (
                <Check className="w-4 h-4 text-green-600" strokeWidth={1.75} />
              ) : (
                <Copy className="w-4 h-4" strokeWidth={1.75} />
              )}
            </button>
            <button
              type="button"
              onClick={onToggleTts}
              className={clsx(
                "p-1.5 rounded-lg transition-colors",
                ttsPlaying
                  ? "text-orange-600 bg-orange-50 hover:bg-orange-100"
                  : "text-gray-500 hover:text-gray-800 hover:bg-black/5"
              )}
              title={ttsPlaying ? "停止朗读" : "朗读"}
              aria-label={ttsPlaying ? "停止朗读" : "朗读"}
              aria-pressed={ttsPlaying}
            >
              {ttsPlaying ? (
                <Square className="w-4 h-4" strokeWidth={1.75} />
              ) : (
                <Volume2 className="w-4 h-4" strokeWidth={1.75} />
              )}
            </button>

            <div className="relative" ref={menuRef}>
              <button
                type="button"
                onClick={onMenuToggle}
                className="p-1.5 rounded-lg text-gray-500 hover:text-gray-800 hover:bg-black/5 transition-colors"
                title="更多"
                aria-expanded={menuOpen}
                aria-label="更多选项"
              >
                <MoreVertical className="w-4 h-4" strokeWidth={1.75} />
              </button>
              {menuOpen && (
                <div
                  className="absolute left-0 bottom-full mb-1 z-50 min-w-[220px] rounded-xl border border-[#e8e8e8] bg-white py-1 shadow-lg text-sm"
                  role="menu"
                >
                  <button
                    type="button"
                    role="menuitem"
                    className="w-full flex items-center gap-2 px-3 py-2.5 text-left text-gray-700 transition-colors hover:bg-gray-50 active:bg-gray-100/80"
                    onClick={() => {
                      onMenuToggle();
                      exportAssistantAsPdf("TCM AI 回复", content);
                    }}
                  >
                    <FileDown className="w-4 h-4 shrink-0 opacity-70" />
                    导出为 PDF
                  </button>
                  <div className="my-1 h-px bg-[#eee]" />
                  <div className="flex items-start gap-2 px-3 py-2.5 text-gray-500">
                    <Sparkles className="w-4 h-4 shrink-0 mt-0.5 opacity-70" />
                    <div>
                      <div className="text-xs text-gray-400 mb-0.5">模型</div>
                      <div className="text-[13px] text-gray-800 font-medium leading-snug break-all">
                        {modelName?.trim() || "—"}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
