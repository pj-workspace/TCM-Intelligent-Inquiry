"use client";

import clsx from "clsx";
import { Copy, Check, Pencil } from "lucide-react";

interface UserBubbleProps {
  content: string;
  copied: boolean;
  onCopy: () => void;
  onEdit?: (text: string) => void;
}

export function UserBubble({ content, copied, onCopy, onEdit }: UserBubbleProps) {
  return (
    <div
      className={clsx(
        "flex w-full max-w-3xl lg:max-w-4xl xl:max-w-5xl mx-auto py-4 px-4 sm:px-5 md:px-6 lg:px-8",
        "justify-end"
      )}
    >
      <div className="flex min-w-0 max-w-[88%] flex-row-reverse items-start gap-2 group sm:max-w-[min(76%,34rem)] md:max-w-[min(70%,35rem)]">
        <div
          className={clsx(
            "text-[15px] leading-relaxed break-words [overflow-wrap:anywhere]",
            "bg-[#f4f4f4] text-[#1a1a1a] rounded-2xl rounded-tr-sm px-5 py-3.5"
          )}
        >
          {content}
        </div>
        <div
          className="flex flex-row items-center gap-0.5 pt-1 opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition-opacity duration-150 shrink-0"
          aria-hidden
        >
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
            onClick={() => onEdit?.(content)}
            className="p-1.5 rounded-lg text-gray-500 hover:text-gray-800 hover:bg-black/5 transition-colors"
            title="填入输入框编辑"
            aria-label="填入输入框编辑"
          >
            <Pencil className="w-4 h-4" strokeWidth={1.75} />
          </button>
        </div>
      </div>
    </div>
  );
}
