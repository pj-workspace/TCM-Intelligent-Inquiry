"use client";

import Link from "next/link";
import { Plus, Edit2, Trash2, Download, MoreVertical, LogOut, PanelLeftOpen } from "lucide-react";
import type { ServerConversation } from "@/types/chat";

type ChatHeaderProps = {
  token: string | null;
  authLoading: boolean;
  hasStarted: boolean;
  conversationId: string | null;
  serverConversations: ServerConversation[];
  sidebarCollapsed: boolean;
  isGeneratingTitle: boolean;
  isEditingTitle: boolean;
  editTitleValue: string;
  headerMenuOpen: boolean;
  headerMenuRef: React.RefObject<HTMLDivElement | null>;
  showMobileTitleSkeleton: boolean;
  onToggleSidebar: () => void;
  onNewChat: () => void;
  onSetHeaderMenuOpen: (open: boolean) => void;
  onEditTitle: () => void;
  onExportHistory: () => void;
  onDeleteConversation: () => void;
  onEditTitleChange: (value: string) => void;
  onEditTitleBlur: () => void;
  onEditTitleKeyDown: (e: React.KeyboardEvent) => void;
  onLogout: () => void;
};

export function ChatHeader({
  token,
  authLoading,
  hasStarted,
  conversationId,
  serverConversations,
  sidebarCollapsed,
  isGeneratingTitle,
  isEditingTitle,
  editTitleValue,
  headerMenuOpen,
  headerMenuRef,
  showMobileTitleSkeleton,
  onToggleSidebar,
  onNewChat,
  onSetHeaderMenuOpen,
  onEditTitle,
  onExportHistory,
  onDeleteConversation,
  onEditTitleChange,
  onEditTitleBlur,
  onEditTitleKeyDown,
  onLogout,
}: ChatHeaderProps) {
  const currentTitle = serverConversations.find((c) => c.id === conversationId)?.title;

  return (
    <header className="flex-shrink-0 h-14 flex items-center justify-between px-4 md:px-6 border-b border-[#e5e5e5] bg-white/80 backdrop-blur-sm z-10">
      <div className="flex items-center gap-1 min-w-0 flex-1 md:flex-initial">
        {/* 移动端品牌名 */}
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

        {/* 侧栏收起时：展开 + 新建 图标组（仅 md+） */}
        {sidebarCollapsed && (
          <div className="hidden md:flex items-center gap-0.5 shrink-0">
            <button
              type="button"
              onClick={onToggleSidebar}
              title="展开侧栏"
              className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition-colors"
            >
              <PanelLeftOpen className="w-[1.05rem] h-[1.05rem]" />
            </button>
            <button
              type="button"
              onClick={onNewChat}
              title="新建会话"
              className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition-colors"
            >
              <Plus className="w-[1.05rem] h-[1.05rem]" />
            </button>
            <div className="h-4 w-px bg-gray-200 mx-1 shrink-0" />
          </div>
        )}

        {/* 会话标题（md+） */}
        {hasStarted && conversationId && (
          <div className="hidden md:block font-medium text-sm text-gray-800 truncate min-h-[1.25rem] max-w-[28rem]">
            {isEditingTitle ? (
              <input
                autoFocus
                className="border border-gray-300 rounded px-2 py-1 text-sm outline-none focus:border-orange-400 w-full"
                value={editTitleValue}
                onChange={(e) => onEditTitleChange(e.target.value)}
                onBlur={onEditTitleBlur}
                onKeyDown={onEditTitleKeyDown}
              />
            ) : isGeneratingTitle ? (
              <span className="block text-transparent select-none" aria-hidden>
                &nbsp;
              </span>
            ) : (
              <span
                key={currentTitle || "会话记录"}
                className="block truncate font-medium sidebar-conv-title-sweep"
              >
                {currentTitle || "会话记录"}
              </span>
            )}
          </div>
        )}
      </div>

      <div className="flex items-center gap-1 md:gap-3">
        {hasStarted && conversationId && (
          <div className="relative" ref={headerMenuRef}>
            <button
              onClick={() => onSetHeaderMenuOpen(!headerMenuOpen)}
              className="p-1.5 rounded-md hover:bg-gray-100 hover:text-gray-900 text-gray-600 active:scale-95 transition-colors"
            >
              <MoreVertical className="w-5 h-5" />
            </button>
            {headerMenuOpen && (
              <div className="absolute right-0 top-full mt-1 w-36 bg-white rounded-lg shadow-lg border border-[#e5e5e5] py-1 z-50">
                <button
                  onClick={onEditTitle}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 active:bg-gray-100/80"
                >
                  <Edit2 className="w-4 h-4" /> 编辑标题
                </button>
                <button
                  onClick={onExportHistory}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 active:bg-gray-100/80"
                >
                  <Download className="w-4 h-4" /> 导出会话
                </button>
                <div className="my-1 border-t border-gray-100" />
                <button
                  onClick={onDeleteConversation}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 active:bg-red-100/60"
                >
                  <Trash2 className="w-4 h-4" /> 删除会话
                </button>
              </div>
            )}
          </div>
        )}

        {/* 移动端新建会话按钮 */}
        <button
          type="button"
          onClick={onNewChat}
          className="p-2 md:hidden text-gray-600 hover:bg-gray-100 hover:text-gray-800 active:scale-95 rounded-md transition-colors"
        >
          <Plus className="w-5 h-5" />
        </button>

        {/* 用户菜单 */}
        {authLoading ? (
          <div className="h-8 w-8 md:h-9 md:w-9 rounded-full bg-gray-200/70 animate-pulse" aria-hidden />
        ) : token ? (
          <div className="relative group">
            <button
              type="button"
              className="flex items-center justify-center w-8 h-8 md:w-9 md:h-9 rounded-full bg-white border border-[#e5e5e5] shadow-sm hover:bg-gray-50 hover:border-gray-300 active:scale-95 transition-colors"
              aria-label="账户"
            >
              <span className="w-6 h-6 md:w-7 md:h-7 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center text-xs font-bold">
                P
              </span>
            </button>
            <div className="absolute right-0 top-full mt-2 w-32 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50">
              <div className="bg-white rounded-lg shadow-lg border border-[#e5e5e5] py-1">
                <button
                  onClick={onLogout}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 active:bg-red-100/50 transition-colors"
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
  );
}
