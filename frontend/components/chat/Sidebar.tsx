"use client";

import Link from "next/link";
import { Plus, Settings, LogIn, Trash2 } from "lucide-react";
import clsx from "clsx";
import { useAuth } from "@/contexts/auth-context";

export type SidebarConversation = {
  id: string;
  title: string;
};

type SidebarProps = {
  conversations: SidebarConversation[];
  activeId: string | null;
  onNewChat: () => void;
  onSelect: (id: string) => void;
  onDelete?: (id: string) => void;
  /** 是否正在流式生成（与 isGeneratingTitle 解耦，避免与 SSE 同一帧批量更新导致骨架从不展示） */
  streamBusy?: boolean;
  isGeneratingTitle?: boolean;
};

export function Sidebar({
  conversations,
  activeId,
  onNewChat,
  onSelect,
  onDelete,
  streamBusy = false,
  isGeneratingTitle,
}: SidebarProps) {
  const { loading, token } = useAuth();

  /**
   * meta 未到前：activeId 为空、列表可能仍为空，仅靠 isGeneratingTitle 可能与流式事件同一批次提交，界面从不刷出骨架。
   * 用 streamBusy（genState !== idle）+ 无会话 id 作为可靠信号。
   */
  const showPendingNewChatSkeleton = Boolean(
    token && streamBusy && activeId == null
  );

  return (
    <div className="w-[260px] h-full bg-[#f9f9f8] border-r border-[#e5e5e5] flex flex-col flex-shrink-0 hidden md:flex">
      <div className="p-4">
        <button
          type="button"
          onClick={onNewChat}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-[#1a1a1a] text-white rounded-xl shadow-sm hover:bg-gray-800 transition-colors text-sm font-medium"
        >
          <Plus className="w-4 h-4" />
          开启新对话
        </button>
      </div>

      <div className="no-scrollbar flex-1 overflow-y-auto px-3 py-2 min-h-0">
        <div className="text-xs font-semibold text-gray-400 mb-3 px-3">
          我的会话
        </div>
        {loading ? (
          <div className="px-3 space-y-2">
            <div className="h-4 w-48 rounded bg-gray-100 animate-pulse" />
            <div className="h-4 w-36 rounded bg-gray-100/80 animate-pulse" />
          </div>
        ) : conversations.length === 0 && !showPendingNewChatSkeleton ? (
          <p className="px-3 text-sm text-gray-400 leading-relaxed">
            暂无会话历史，快来聊聊吧～
          </p>
        ) : (
          <div className="space-y-0.5">
            {showPendingNewChatSkeleton && (
              <div
                className="relative w-full flex min-h-[2.75rem] items-center px-3 py-2.5 text-sm rounded-xl bg-white shadow-sm border border-[#e5e5e5] pointer-events-none"
                aria-busy
                aria-label="正在生成会话标题"
              >
                <div className="flex min-w-0 flex-1 items-center pr-2">
                  <div className="skeleton-text-shimmer h-4 w-2/3 rounded-md" />
                </div>
              </div>
            )}
            {conversations.map((c) => {
              const isActive = activeId === c.id;
              const titleEmpty = !(c.title && c.title.trim());
              const isGenerating =
                isActive &&
                (Boolean(isGeneratingTitle) ||
                  (streamBusy && titleEmpty));

              return (
                <div
                  key={c.id}
                  className={clsx(
                    "group relative w-full flex min-h-[2.75rem] items-center px-3 py-2.5 text-sm rounded-xl transition-colors",
                    isActive
                      ? "bg-white shadow-sm border border-[#e5e5e5] text-gray-900 font-medium"
                      : "text-gray-600 hover:bg-gray-100/80 border border-transparent",
                    isGenerating ? "cursor-default" : "cursor-pointer"
                  )}
                  onClick={isGenerating ? undefined : () => onSelect(c.id)}
                  role={isGenerating ? "presentation" : undefined}
                >
                  <div className="flex min-w-0 flex-1 items-center pr-6">
                    {isGenerating ? (
                      <div className="skeleton-text-shimmer h-4 w-3/4 rounded-md" />
                    ) : isActive ? (
                      <span
                        key={c.title || "empty"}
                        className="block min-w-0 truncate font-medium sidebar-conv-title-sweep"
                      >
                        {c.title || "新会话"}
                      </span>
                    ) : (
                      <span className="block min-w-0 truncate">
                        {c.title || "新会话"}
                      </span>
                    )}
                  </div>
                  {onDelete && !isGenerating && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDelete(c.id);
                      }}
                      className={clsx(
                        "absolute right-2 p-1.5 rounded-md text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors opacity-0 group-hover:opacity-100",
                        isActive && "opacity-100"
                      )}
                      title="删除会话"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="p-4 border-t border-[#e5e5e5] space-y-2">
        {loading ? (
          <div
            className="h-10 w-full rounded-lg bg-gray-200/60 animate-pulse"
            aria-hidden
          />
        ) : !token ? (
          <Link
            href="/login"
            className="flex w-full items-center justify-center gap-2 px-3 py-2.5 text-sm font-medium text-white bg-[#1a1a1a] rounded-lg hover:bg-gray-800 transition-colors"
          >
            <LogIn className="w-4 h-4" />
            登录 / 注册
          </Link>
        ) : null}
        <Link
          href="/settings"
          className="w-full flex items-center gap-3 px-2 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-md transition-colors text-left"
        >
          <Settings className="w-4 h-4 text-gray-500" />
          <span>设置</span>
        </Link>
      </div>
    </div>
  );
}
