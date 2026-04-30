"use client";

import { useCallback, useState } from "react";
import clsx from "clsx";
import { Copy, Check, Pencil } from "lucide-react";
import { ImagePreviewLightbox } from "./ImagePreviewLightbox";

interface UserBubbleProps {
  content: string;
  imageUrls?: string[];
  copied: boolean;
  onCopy: () => void;
  onEdit?: (text: string) => void;
}

/** 多图时宫内直接展示的格子数；第 4 格叠「+N」表示其余张数 */
const MULTI_GRID_SLOTS = 4;

function UserBubbleAttachments({
  urls,
  onOpenPreview,
}: {
  urls: string[];
  onOpenPreview: (i: number) => void;
}) {
  const n = urls.length;
  if (n === 0) return null;

  if (n === 1) {
    const u = urls[0];
    return (
      <div className="-mx-1 -mt-0.5 mb-0 flex min-w-0 justify-end">
        <button
          type="button"
          onClick={() => onOpenPreview(0)}
          className={clsx(
            "group/img relative block min-h-0 min-w-0 w-full max-w-[min(100%,18.5rem)] overflow-hidden rounded-2xl",
            "bg-white/80 text-left shadow-sm ring-1 ring-black/[0.06] transition-[box-shadow,ring-color]",
            "hover:ring-black/12 hover:shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-300/80"
          )}
          aria-label="查看大图"
          title="查看大图"
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- 动态 OSS 签名 URL */}
          <img
            src={u}
            alt=""
            className="ml-auto block max-h-[13rem] w-auto max-w-full object-contain object-right"
            loading="lazy"
            draggable={false}
          />
          <span className="pointer-events-none absolute inset-0 rounded-2xl bg-black/0 transition-colors group-hover/img:bg-black/[0.03]" />
        </button>
      </div>
    );
  }

  const folded = n > MULTI_GRID_SLOTS;
  const slotCount = folded ? MULTI_GRID_SLOTS : n;
  /** 第 4 格仍展示第 4 张缩略图，+N = 其后未在格内展示的剩余张数（n − 前 4 张） */
  const plusOverlayCount = folded ? n - MULTI_GRID_SLOTS : 0;

  return (
    <div className="-mx-1 -mt-0.5 mb-0 flex min-w-0 justify-end">
      <div className="no-scrollbar flex max-w-full flex-nowrap justify-end gap-2 overflow-x-auto pb-0.5">
        {Array.from({ length: slotCount }, (_, slot) => {
          const showPlusBadge = folded && slot === MULTI_GRID_SLOTS - 1;
          const u = urls[slot];

          return (
            <button
              key={`${slot}-${u.slice(0, 48)}`}
              type="button"
              onClick={() =>
                showPlusBadge ? onOpenPreview(MULTI_GRID_SLOTS - 1) : onOpenPreview(slot)
              }
              className={clsx(
                "group/img relative h-[3.625rem] w-[3.625rem] shrink-0 overflow-hidden rounded-xl sm:h-16 sm:w-16",
                "bg-white/80 shadow-sm ring-1 ring-black/[0.06] transition-[box-shadow,ring-color]",
                "hover:ring-black/12 hover:shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-300/80"
              )}
              aria-label={
                showPlusBadge && plusOverlayCount > 0
                  ? `查看图片，还有 ${plusOverlayCount} 张`
                  : `查看第 ${slot + 1} 张`
              }
              title={showPlusBadge ? `共 ${n} 张，点击查看` : "查看大图"}
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- 动态 OSS 签名 URL */}
              <img
                src={u}
                alt=""
                className="h-full w-full object-cover"
                loading="lazy"
                draggable={false}
              />
              {showPlusBadge && plusOverlayCount > 0 ? (
                <span className="absolute inset-0 flex items-center justify-center bg-black/52 text-[15px] font-semibold tabular-nums text-white backdrop-blur-[1px] sm:text-base">
                  +{plusOverlayCount}
                </span>
              ) : (
                <span className="pointer-events-none absolute inset-0 bg-black/0 transition-colors group-hover/img:bg-black/[0.05]" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function UserBubble({ content, imageUrls, copied, onCopy, onEdit }: UserBubbleProps) {
  const hasImages = Boolean(imageUrls && imageUrls.length > 0);
  const text = content?.trim() ?? "";
  const hasText = Boolean(text);

  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  const closeLightbox = useCallback(() => setLightboxIndex(null), []);

  return (
    <div
      className={clsx(
        "flex w-full max-w-3xl lg:max-w-4xl xl:max-w-5xl mx-auto py-4 px-4 sm:px-5 md:px-6 lg:px-8",
        "justify-end"
      )}
    >
      {hasImages && imageUrls ? (
        <ImagePreviewLightbox
          urls={imageUrls}
          index={lightboxIndex}
          onClose={closeLightbox}
          onIndexChange={setLightboxIndex}
        />
      ) : null}

      <div className="flex min-w-0 max-w-[88%] flex-row-reverse items-start gap-2 group sm:max-w-[min(76%,34rem)] md:max-w-[min(70%,36rem)]">
        <div
          className={clsx(
            "min-w-0 max-w-full text-[15px] leading-relaxed break-words [overflow-wrap:anywhere]",
            "bg-[#f4f4f4] text-[#1a1a1a] rounded-3xl rounded-tr-sm px-4 py-3 sm:px-5 sm:py-3.5"
          )}
        >
          {hasImages && imageUrls ? (
            <UserBubbleAttachments urls={imageUrls} onOpenPreview={setLightboxIndex} />
          ) : null}

          {hasText ? (
            <div
              className={clsx(
                hasImages && "mt-3 border-t border-black/[0.07] pt-3",
                hasImages && "text-[14.5px] leading-[1.55] sm:text-[15px] sm:leading-relaxed"
              )}
            >
              {text}
            </div>
          ) : null}
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
