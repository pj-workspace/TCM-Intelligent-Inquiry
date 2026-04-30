"use client";

import Link from "next/link";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import {
  Folder,
  LogIn,
  MoreVertical,
  PanelLeftClose,
  Plus,
  Search,
  Settings,
  Share2,
  Pin,
  Pencil,
  Download,
  Trash2,
  Loader2,
  CheckSquare,
} from "lucide-react";
import clsx from "clsx";
import { useAuth } from "@/contexts/auth-context";
import type { ConversationFolder, ServerConversation } from "@/types/chat";
import { SidebarBatchBar, SidebarBatchRowCheck } from "./SidebarBatchBar";

export type SidebarConversation = ServerConversation;

export type SidebarFilter = "__ungrouped__" | string;

type SidebarProps = {
  folders: ConversationFolder[];
  conversationsFull: ServerConversation[];
  /** 已按置顶与当前筛选处理后的列表 */
  displayedConversations: ServerConversation[];
  activeId: string | null;
  /** 当前列表范围：未分组 或 某分组 id */
  sidebarFilter: SidebarFilter;
  onSidebarFilterChange: (f: SidebarFilter) => void;
  onNewChat: () => void;
  onSelect: (id: string) => void;
  onDelete?: (id: string) => void;
  onRenameRequest: (id: string, currentTitle: string) => void;
  onExportConversation: (id: string, title: string) => void;
  onTogglePin: (id: string) => void;
  onMoveToGroup: (conversationId: string, groupId: string | null) => void;
  onCreateFolder: () => void;
  /** 分组行 ⋮ */
  onRenameFolder?: (groupId: string, currentName: string) => void;
  onDeleteFolder?: (groupId: string) => void;
  pinnedIds: string[];
  batchMode: boolean;
  onToggleBatchMode: () => void;
  selectedIds: Set<string>;
  onToggleSelect: (id: string) => void;
  onSelectAllDisplayed: () => void;
  onClearBatchSelection?: () => void;
  /** 批量删除（已选≥1） */
  onBulkDelete?: () => void;
  bulkDeletePending?: boolean;
  streamBusy?: boolean;
  isGeneratingTitle?: boolean;
  collapsed?: boolean;
  onToggle?: () => void;
  onOpenSearch?: () => void;
  movePendingId?: string | null;
};

export function Sidebar({
  folders,
  conversationsFull,
  displayedConversations,
  activeId,
  sidebarFilter,
  onSidebarFilterChange,
  onNewChat,
  onSelect,
  onDelete,
  onRenameRequest,
  onExportConversation,
  onTogglePin,
  onMoveToGroup,
  onCreateFolder,
  onRenameFolder,
  onDeleteFolder,
  pinnedIds,
  batchMode,
  onToggleBatchMode,
  selectedIds,
  onToggleSelect,
  onSelectAllDisplayed,
  onClearBatchSelection,
  onBulkDelete,
  bulkDeletePending,
  streamBusy = false,
  isGeneratingTitle,
  collapsed = false,
  onToggle,
  onOpenSearch,
  movePendingId,
}: SidebarProps) {
  const { loading, token } = useAuth();

  const showPendingNewChatSkeleton = Boolean(
    token && streamBusy && activeId == null
  );

  const sortedFolders = [...folders].sort((a, b) => {
    if (a.sort_order !== b.sort_order) return a.sort_order - b.sort_order;
    return 0;
  });

  return (
    <div
      style={{ width: collapsed ? 0 : 276 }}
      className="transition-[width] duration-300 ease-in-out h-full bg-[#f9f9f8] border-r border-[#e5e5e5] flex-col flex-shrink-0 overflow-hidden hidden md:flex"
    >
      <div className="w-[276px] h-full flex flex-col">
        <div className="flex items-center gap-0.5 px-2 pt-2 pb-1">
          <button
            type="button"
            onClick={onToggle}
            title="收起侧栏"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-200/70 hover:text-gray-700 active:scale-95 transition-colors"
          >
            <PanelLeftClose className="w-[1.05rem] h-[1.05rem]" />
          </button>
          <button
            type="button"
            onClick={onNewChat}
            title="新建会话"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-200/70 hover:text-gray-700 active:scale-95 transition-colors"
          >
            <Plus className="w-[1.05rem] h-[1.05rem]" />
          </button>
          <button
            type="button"
            onClick={onOpenSearch}
            title="搜索对话"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-200/70 hover:text-gray-700 active:scale-95 transition-colors"
          >
            <Search className="w-[1.05rem] h-[1.05rem]" />
          </button>
        </div>

        <div className="no-scrollbar flex-1 overflow-y-auto px-2 py-2 min-h-0 flex flex-col gap-3">
          {/* 分组 */}
          <div>
            <div className="flex items-center justify-between px-2 mb-1.5">
              <span className="text-xs font-semibold text-gray-400">分组</span>
              <button
                type="button"
                title="新建分组"
                onClick={onCreateFolder}
                className="p-1 rounded-md text-gray-400 hover:bg-gray-200/80 hover:text-gray-700"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="space-y-0.5">
              {sortedFolders.map((g) => (
                <div
                  key={g.id}
                  className={clsx(
                    "group/gf relative flex min-h-[2.25rem] items-center rounded-lg px-2 py-1.5 text-sm transition-colors",
                    sidebarFilter === g.id
                      ? "bg-white shadow-sm border border-[#e5e5e5] text-gray-900 font-medium"
                      : "text-gray-600 hover:bg-gray-100/80 border border-transparent"
                  )}
                >
                  <button
                    type="button"
                    title={
                      sidebarFilter === g.id && activeId
                        ? "再次点击返回分组管理"
                        : `${g.name}`
                    }
                    className="flex min-w-0 flex-1 items-center gap-2 text-left"
                    onClick={() => onSidebarFilterChange(g.id)}
                  >
                    <Folder className="w-3.5 h-3.5 shrink-0 opacity-70" />
                    <span className="truncate">{g.name}</span>
                  </button>
                  {(onRenameFolder || onDeleteFolder) && (
                    <DropdownMenu.Root>
                      <DropdownMenu.Trigger asChild>
                        <button
                          type="button"
                          className="opacity-0 group-hover/gf:opacity-100 p-1 rounded text-gray-400 hover:text-gray-700 hover:bg-gray-200/60"
                          aria-label="分组操作"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <MoreVertical className="w-3.5 h-3.5" />
                        </button>
                      </DropdownMenu.Trigger>
                      <DropdownMenu.Portal>
                        <DropdownMenu.Content
                          className="ui-radix-floating z-[300] min-w-[9rem] rounded-lg border border-[#e5e5e5] bg-white py-1 text-sm shadow-lg"
                          align="end"
                          sideOffset={4}
                        >
                          {onRenameFolder && (
                            <DropdownMenu.Item
                              className="flex cursor-pointer items-center gap-2 px-3 py-2 outline-none hover:bg-gray-50"
                              onSelect={() => onRenameFolder(g.id, g.name)}
                            >
                              <Pencil className="w-3.5 h-3.5" /> 重命名分组
                            </DropdownMenu.Item>
                          )}
                          {onDeleteFolder && (
                            <DropdownMenu.Item
                              className="flex cursor-pointer items-center gap-2 px-3 py-2 text-red-600 outline-none hover:bg-red-50"
                              onSelect={() => onDeleteFolder(g.id)}
                            >
                              <Trash2 className="w-3.5 h-3.5" /> 删除分组
                            </DropdownMenu.Item>
                          )}
                        </DropdownMenu.Content>
                      </DropdownMenu.Portal>
                    </DropdownMenu.Root>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* 聊天：仅未分组会话列表；分组内会话在分组区与主区工作台打开 */}
          <div className="flex-1 flex flex-col min-h-0">
            <div className="flex items-center justify-between px-2 mb-1.5 gap-2">
              <span
                className={clsx(
                  "text-xs font-semibold",
                  batchMode ? "text-orange-800/95" : "text-gray-400"
                )}
              >
                {batchMode ? "批量管理" : "聊天"}
              </span>
              <button
                type="button"
                title={batchMode ? "完成批量操作" : "进入批量选择"}
                aria-pressed={batchMode}
                onClick={onToggleBatchMode}
                className={clsx(
                  "shrink-0 rounded-lg p-1.5 transition-colors",
                  batchMode
                    ? "bg-white px-2 text-[11px] font-medium text-orange-900 shadow-sm ring-1 ring-orange-200/80 hover:bg-orange-50/80"
                    : "text-gray-400 hover:bg-gray-200/80 hover:text-gray-700"
                )}
              >
                {batchMode ? (
                  "完成"
                ) : (
                  <CheckSquare className="w-3.5 h-3.5" aria-hidden />
                )}
              </button>
            </div>

            {batchMode && (
              <SidebarBatchBar
                totalCount={displayedConversations.length}
                selectedCount={selectedIds.size}
                onSelectAll={onSelectAllDisplayed}
                onClearSelection={onClearBatchSelection ?? (() => undefined)}
                onBulkDelete={onBulkDelete}
                bulkDeletePending={bulkDeletePending}
              />
            )}

            {loading ? (
              <div className="px-2 space-y-2">
                <div className="h-4 w-48 rounded bg-gray-100 animate-pulse" />
                <div className="h-4 w-36 rounded bg-gray-100/80 animate-pulse" />
              </div>
            ) : conversationsFull.length === 0 && !showPendingNewChatSkeleton ? (
              <p className="px-2 text-sm text-gray-400 leading-relaxed">暂无会话。</p>
            ) : (
              <div className="space-y-0.5 flex-1 min-h-0">
                {showPendingNewChatSkeleton && (
                  <div
                    className="relative w-full flex min-h-[2.75rem] items-stretch px-3 py-2.5 text-sm rounded-xl bg-white shadow-sm border border-[#e5e5e5] pointer-events-none"
                    aria-busy
                  >
                    <div className="flex flex-1 items-center min-w-0">
                      <div className="skeleton-text-shimmer h-4 w-2/3 rounded-md" />
                    </div>
                  </div>
                )}
                {displayedConversations.map((c) => {
                  const isActive = activeId === c.id;
                  const titleEmpty = !(c.title && c.title.trim());
                  const isGenerating =
                    isActive &&
                    (Boolean(isGeneratingTitle) || (streamBusy && titleEmpty));

                  const isPinned = pinnedIds.includes(c.id);

                  return (
                    <div
                      key={c.id}
                      className={clsx(
                        "group relative w-full flex min-h-[2.65rem] items-center px-2 py-2 text-sm rounded-xl transition-colors",
                        isActive
                          ? "bg-white shadow-sm border border-[#e5e5e5] text-gray-900 font-medium"
                          : "text-gray-600 hover:bg-gray-100/85 border border-transparent",
                        batchMode && selectedIds.has(c.id) && "ring-1 ring-orange-300 bg-orange-50/50"
                      )}
                      onClick={
                        isGenerating
                          ? undefined
                          : batchMode
                            ? () => onToggleSelect(c.id)
                            : () => onSelect(c.id)
                      }
                      onKeyDown={(e) => {
                        if (!batchMode || isGenerating) return;
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          onToggleSelect(c.id);
                        }
                      }}
                      role={batchMode ? "checkbox" : "button"}
                      aria-checked={batchMode ? selectedIds.has(c.id) : undefined}
                      aria-label={
                        batchMode
                          ? `${selectedIds.has(c.id) ? "取消选择" : "选择"}会话：${c.title?.trim() || "新会话"}`
                          : undefined
                      }
                      tabIndex={0}
                    >
                      {batchMode && <SidebarBatchRowCheck selected={selectedIds.has(c.id)} />}
                      <div className="flex min-w-0 flex-1 items-center gap-1 pr-1 min-h-0">
                        {isPinned && !batchMode && (
                          <Pin className="w-3 h-3 shrink-0 text-orange-600/70" aria-hidden />
                        )}
                        <div className="min-w-0 flex-1">
                          {isGenerating ? (
                            <div className="skeleton-text-shimmer h-4 w-3/4 rounded-md" />
                          ) : (
                            <span
                              className={clsx(
                                "block truncate leading-snug",
                                isActive && "sidebar-conv-title-sweep font-medium"
                              )}
                            >
                              {c.title || "新会话"}
                            </span>
                          )}
                        </div>
                      </div>
                      {!batchMode && onDelete && !isGenerating && (
                        <div className="flex shrink-0 items-center">
                          <DropdownMenu.Root>
                            <DropdownMenu.Trigger asChild>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                }}
                                className={clsx(
                                  "shrink-0 p-1.5 rounded-md text-gray-400 hover:text-gray-700 hover:bg-gray-200/60 transition-opacity",
                                  "opacity-0 group-hover:opacity-100 group-focus-within:opacity-100",
                                  isActive && "opacity-100"
                                )}
                                aria-label="会话操作"
                              >
                                <MoreVertical className="w-3.5 h-3.5" />
                              </button>
                            </DropdownMenu.Trigger>
                          <DropdownMenu.Portal>
                            <DropdownMenu.Content
                              className="ui-radix-floating z-[300] min-w-[13rem] rounded-lg border border-[#e5e5e5] bg-white py-1 text-sm shadow-lg"
                              align="end"
                              sideOffset={4}
                              onCloseAutoFocus={(e) => e.preventDefault()}
                            >
                              <DropdownMenu.Item
                                className="flex cursor-pointer items-center gap-2 px-3 py-2 outline-none hover:bg-gray-50"
                                onSelect={(e) => {
                                  e.preventDefault();
                                  onToggleBatchMode();
                                }}
                              >
                                <CheckSquare className="w-3.5 h-3.5" /> 批量操作
                              </DropdownMenu.Item>
                              <DropdownMenu.Sub>
                                <DropdownMenu.SubTrigger className="flex cursor-default select-none items-center justify-between gap-2 px-3 py-2 outline-none hover:bg-gray-50 data-[state=open]:bg-gray-50 rounded-none">
                                  <span className="flex items-center gap-2">
                                    <Folder className="w-3.5 h-3.5" /> 移动到分组
                                  </span>
                                  <span className="text-gray-400 text-xs">›</span>
                                </DropdownMenu.SubTrigger>
                                <DropdownMenu.Portal>
                                  <DropdownMenu.SubContent
                                    className="ui-radix-floating z-[301] max-h-[min(60vh,16rem)] min-w-[10rem] overflow-y-auto rounded-lg border border-[#e5e5e5] bg-white py-1 text-sm shadow-lg"
                                    sideOffset={4}
                                  >
                                    <DropdownMenu.Item
                                      className="px-3 py-2 cursor-pointer outline-none hover:bg-gray-50"
                                      disabled={movePendingId === c.id}
                                      onSelect={() => void onMoveToGroup(c.id, null)}
                                    >
                                      移出分组
                                    </DropdownMenu.Item>
                                    {folders.map((gf) => (
                                      <DropdownMenu.Item
                                        key={gf.id}
                                        className="px-3 py-2 cursor-pointer outline-none hover:bg-gray-50"
                                        disabled={movePendingId === c.id || c.group_id === gf.id}
                                        onSelect={() => void onMoveToGroup(c.id, gf.id)}
                                      >
                                        {gf.name}
                                      </DropdownMenu.Item>
                                    ))}
                                  </DropdownMenu.SubContent>
                                </DropdownMenu.Portal>
                              </DropdownMenu.Sub>
                              <DropdownMenu.Item
                                className="flex cursor-pointer items-center gap-2 px-3 py-2 outline-none hover:bg-gray-50"
                                onSelect={() =>
                                  onRenameRequest(c.id, c.title || "新会话")
                                }
                              >
                                <Pencil className="w-3.5 h-3.5" /> 编辑名称
                              </DropdownMenu.Item>
                              <DropdownMenu.Item
                                className="flex cursor-pointer items-center gap-2 px-3 py-2 outline-none opacity-45 pointer-events-none"
                                disabled
                              >
                                <Share2 className="w-3.5 h-3.5" /> 分享
                              </DropdownMenu.Item>
                              <DropdownMenu.Item
                                className="flex cursor-pointer items-center gap-2 px-3 py-2 outline-none hover:bg-gray-50"
                                onSelect={() => onTogglePin(c.id)}
                              >
                                <Pin className="w-3.5 h-3.5" />{" "}
                                {isPinned ? "取消置顶" : "置顶"}
                              </DropdownMenu.Item>
                              <DropdownMenu.Item
                                className="flex cursor-pointer items-center gap-2 px-3 py-2 outline-none hover:bg-gray-50"
                                onSelect={() =>
                                  void onExportConversation(c.id, c.title || "新会话")
                                }
                              >
                                <Download className="w-3.5 h-3.5" /> 导出会话
                              </DropdownMenu.Item>
                              <DropdownMenu.Separator className="my-1 h-px bg-gray-100" />
                              <DropdownMenu.Item
                                className="flex cursor-pointer items-center gap-2 px-3 py-2 text-red-600 outline-none hover:bg-red-50"
                                onSelect={() => onDelete(c.id)}
                              >
                                <Trash2 className="w-3.5 h-3.5" /> 删除会话
                              </DropdownMenu.Item>
                              {movePendingId === c.id && (
                                <div className="flex items-center gap-2 px-3 py-1.5 text-xs text-gray-500">
                                  <Loader2 className="w-3.5 h-3.5 animate-spin" />{" "}
                                  更新中…
                                </div>
                              )}
                            </DropdownMenu.Content>
                          </DropdownMenu.Portal>
                        </DropdownMenu.Root>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <div className="p-4 border-t border-[#e5e5e5] space-y-2">
          {loading ? (
            <div className="h-10 w-full rounded-lg bg-gray-200/60 animate-pulse" aria-hidden />
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
    </div>
  );
}
