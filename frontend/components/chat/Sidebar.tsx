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
};

export function Sidebar({
  conversations,
  activeId,
  onNewChat,
  onSelect,
  onDelete,
}: SidebarProps) {
  const { loading, token } = useAuth();

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

      <div className="flex-1 overflow-y-auto px-3 py-2 min-h-0">
        <div className="text-xs font-semibold text-gray-400 mb-3 px-3">
          我的会话
        </div>
        {conversations.length === 0 ? (
          loading ? (
            <div className="px-3 space-y-2">
              <div className="h-4 w-48 rounded bg-gray-100 animate-pulse" />
              <div className="h-4 w-36 rounded bg-gray-100/80 animate-pulse" />
            </div>
          ) : (
            <p className="px-3 text-sm text-gray-400 leading-relaxed">
              暂无会话历史，快来聊聊吧～
            </p>
          )
        ) : (
          <div className="space-y-0.5">
            {conversations.map((c) => {
              const isActive = activeId === c.id;
              return (
                <div
                  key={c.id}
                  className={clsx(
                    "group relative w-full flex items-center px-3 py-2.5 text-sm rounded-xl transition-colors cursor-pointer",
                    isActive
                      ? "bg-white shadow-sm border border-[#e5e5e5] text-gray-900 font-medium"
                      : "text-gray-600 hover:bg-gray-100/80 border border-transparent"
                  )}
                  onClick={() => onSelect(c.id)}
                >
                  <span className="truncate pr-6">{c.title}</span>
                  {onDelete && (
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
        <button
          type="button"
          className="w-full flex items-center gap-3 px-2 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-md transition-colors text-left"
        >
          <Settings className="w-4 h-4 text-gray-500" />
          <span>设置</span>
        </button>
      </div>
    </div>
  );
}
