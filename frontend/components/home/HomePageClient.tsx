"use client";

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowDown } from "lucide-react";
import {
  BrainstormPanel,
  ChatHeader,
  ChatInputBar,
  ClaudeStar,
  ConversationSearchModal,
  GroupWorkspace,
  MessageBubble,
  Sidebar,
} from "@/components/chat";
import type { SidebarFilter } from "@/components/chat/sidebar/Sidebar";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useAuth } from "@/contexts/auth-context";
import { API_BASE } from "@/lib/api";
import { downloadConversationMarkdown } from "@/lib/conversation-export";
import { conversationToMarkdown, sanitizeDownloadBasename } from "@/lib/chatUtils";
import { useScrollBehavior } from "@/hooks/useScrollBehavior";
import { useChat } from "@/hooks/useChat";
import type { ChatMessage, ServerConversation } from "@/types/chat";
import { uiModalBackdrop, uiModalPanel } from "@/lib/ui-motion";
import { WelcomeHero } from "./WelcomeHero";

const messageTransition = { type: "spring" as const, stiffness: 200, damping: 28, mass: 0.6 };
const PENDING_CHAT_DRAFT_KEY = "tcm_pending_chat_draft";

export function HomePageClient() {
  const { token, loading: authLoading, logout } = useAuth();
  const [input, setInput] = useState("");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [headerMenuOpen, setHeaderMenuOpen] = useState(false);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editTitleValue, setEditTitleValue] = useState("");

  const [sidebarFilter, setSidebarFilter] = useState<SidebarFilter>("__ungrouped__");
  const [sidebarBatchMode, setSidebarBatchMode] = useState(false);
  const [sidebarSelectedIds, setSidebarSelectedIds] = useState<Set<string>>(() => new Set());

  const [renameConvModal, setRenameConvModal] = useState<{ id: string; draft: string } | null>(
    null
  );
  const [newGroupModalOpen, setNewGroupModalOpen] = useState(false);
  const [newGroupNameDraft, setNewGroupNameDraft] = useState("");
  const [renameFolderModal, setRenameFolderModal] = useState<{ id: string; draft: string } | null>(
    null
  );
  const [bulkDeleteConfirmOpen, setBulkDeleteConfirmOpen] = useState(false);
  const [deleteFolderConfirm, setDeleteFolderConfirm] = useState<{ id: string; name: string } | null>(
    null
  );

  const headerMenuRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const hasStartedRef = useRef(false);

  const {
    scrollViewportRef,
    messagesEndRef,
    autoFollowMainRef,
    showScrollToBottom,
    updateScrollState,
    scrollToBottom,
    resetScrollState,
  } = useScrollBehavior(hasStartedRef);

  const getPreferredGroupForNewConversation = useCallback((): string | null => {
    if (sidebarFilter === "__ungrouped__") return null;
    return sidebarFilter;
  }, [sidebarFilter]);

  const chat = useChat({
    autoFollowMainRef,
    onNewChatScrollReset: resetScrollState,
    getPreferredGroupForNewConversation,
  });

  const {
    messages,
    setMessages,
    hasStarted,
    genState,
    conversationId,
    serverConversations,
    conversationFolders,
    pinnedIds,
    isGeneratingTitle,
    lastAssistantMessageId,
    followUpSuggestions,
    deleteTargetId,
    deletePending,
    bulkDeletePending,
    movePendingId,
    deepThinkEnabled,
    setDeepThinkEnabled,
    webSearchEnabled,
    setWebSearchEnabled,
    webSearchMode,
    setWebSearchMode,
    chatModelOptions,
    selectedChatModelId,
    setSelectedChatModelId,
    pendingImageUrls,
    attachmentUploadBusy,
    attachmentUploadSkeletonCount,
    attachmentUploadSlotProgress,
    pushImageAttachments,
    removePendingImageUrlAt,
    applyComposerAttachmentsFromUserMessage,
    fetchAiImageQuickPrompts,
    handleStop,
    handleRegenerateAssistant,
    handleNewChat,
    handleSelectConversation,
    openDeleteDialog,
    closeDeleteDialog,
    confirmDeleteConversation,
    refreshServerConversations,
    moveConversationToGroup,
    createFolder,
    renameFolder,
    deleteFolder,
    togglePinConversation,
    deleteConversationsBulk,
  } = chat;

  hasStartedRef.current = hasStarted;

  const followUpLayoutKey = useMemo(
    () =>
      `${followUpSuggestions?.messageId ?? ""}:${
        followUpSuggestions?.items?.length ?? 0
      }`,
    [followUpSuggestions?.messageId, followUpSuggestions?.items?.length],
  );

  const inputBarModelCaps = useMemo(() => {
    const noListOrUnknownModel = {
      attachmentDisabled: true,
      deepThinkDisabledByModel: false,
      webSearchDisabledByModel: false,
    };
    if (chatModelOptions.length === 0) return noListOrUnknownModel;
    const effectiveId =
      selectedChatModelId.trim() ||
      chatModelOptions.find((o) => o.default)?.id ||
      chatModelOptions[0]?.id ||
      "";
    const row = chatModelOptions.find((x) => x.id === effectiveId);
    if (!row) return noListOrUnknownModel;
    const input = row.capabilities?.input;
    const hasImage = Array.isArray(input) && input.includes("image");
    const tools = row.capabilities?.supports_tool_calling !== false;
    const deep = row.capabilities?.supports_deep_think !== false;
    return {
      attachmentDisabled: !hasImage,
      deepThinkDisabledByModel: !deep,
      webSearchDisabledByModel: !tools,
    };
  }, [chatModelOptions, selectedChatModelId]);

  const attachmentDisabledReason = useMemo(() => {
    if (!inputBarModelCaps.attachmentDisabled) return undefined;
    if (chatModelOptions.length === 0) {
      return "未获取到可选模型列表，无法上传图片（请检查接口与网络后刷新）";
    }
    return "当前模型不支持图片，请切换到带「图片」能力的多模态模型";
  }, [inputBarModelCaps.attachmentDisabled, chatModelOptions.length]);

  const scopedConversations = useMemo(() => {
    if (!token) return [];
    return serverConversations.filter((c) => {
      if (sidebarFilter === "__ungrouped__") return !c.group_id;
      return c.group_id === sidebarFilter;
    });
  }, [token, serverConversations, sidebarFilter]);

  /** 侧栏「聊天」区始终只列出未分组会话；分组会话仅在分组工作台内展示 */
  const displayedSidebarConversations = useMemo(() => {
    if (!token) return [];
    const ungrouped = serverConversations.filter((c) => !c.group_id);
    const pinIdsOrdered = pinnedIds.filter((pid) =>
      ungrouped.some((c) => c.id === pid)
    );
    const pinSet = new Set(pinIdsOrdered);
    const pinnedOrdered: ServerConversation[] = pinIdsOrdered
      .map((id) => ungrouped.find((c) => c.id === id))
      .filter((c): c is ServerConversation => c != null);
    const rest = ungrouped.filter((c) => !pinSet.has(c.id));
    return [...pinnedOrdered, ...rest];
  }, [token, serverConversations, pinnedIds]);

  const conversationGroupTrail = useMemo(() => {
    if (!conversationId || !token) return null;
    const c = serverConversations.find((x) => x.id === conversationId);
    if (!c?.group_id) return null;
    const gn =
      conversationFolders.find((f) => f.id === c.group_id)?.name?.trim() || "分组";
    return { groupName: gn };
  }, [conversationId, token, serverConversations, conversationFolders]);

  const viewingGroupLanding = useMemo(() => {
    if (!token || sidebarFilter === "__ungrouped__") return false;
    if (!conversationId) return true;
    const conv = serverConversations.find((c) => c.id === conversationId);
    return conv?.group_id !== sidebarFilter;
  }, [token, sidebarFilter, conversationId, serverConversations]);

  const selectedGroupFolderName =
    conversationFolders.find((f) => f.id === sidebarFilter)?.name?.trim() || "分组";

  const activeConvInSidebarGroup =
    !!conversationId &&
    sidebarFilter !== "__ungrouped__" &&
    serverConversations.find((c) => c.id === conversationId)?.group_id === sidebarFilter;

  const showBackToGroupWorkspace = Boolean(token) && activeConvInSidebarGroup;

  const selectConversationSyncSidebar = useCallback(
    async (id: string) => {
      await handleSelectConversation(id);
      const list = await refreshServerConversations();
      const row = list?.find((c) => c.id === id);
      if (row?.group_id) setSidebarFilter(row.group_id);
      else setSidebarFilter("__ungrouped__");
    },
    [handleSelectConversation, refreshServerConversations]
  );

  /**
   * 再次点击同一分组文件夹：关掉当前会话，回到该分组管理页；
   * 切换到其它文件夹或「未分组」仍只更新筛选。
   */
  const handleSidebarFilterChange = useCallback(
    (f: SidebarFilter) => {
      if (f !== "__ungrouped__" && f === sidebarFilter && conversationId) {
        handleNewChat();
        return;
      }
      setSidebarFilter(f);
    },
    [sidebarFilter, conversationId, handleNewChat]
  );

  /** 顶部「返回分组」：与再次点侧栏文件夹相同 */
  const handleBackToGroupWorkspace = useCallback(() => {
    handleNewChat();
  }, [handleNewChat]);

  /** 切换到某分组视图时：若当前打开的是其他分组的会话，则清空并开始该分组工作台 */
  useEffect(() => {
    if (sidebarFilter === "__ungrouped__") return;
    const cid = conversationId;
    if (!cid) return;
    const conv = serverConversations.find((c) => c.id === cid);
    if (!conv || conv.group_id !== sidebarFilter) {
      handleNewChat();
    }
  }, [sidebarFilter, conversationId, serverConversations, handleNewChat]);

  const handleClearSidebarSelection = useCallback(() => {
    setSidebarSelectedIds(new Set());
  }, []);

  const handleToggleSidebarBatchMode = useCallback(() => {
    setSidebarBatchMode((prev) => {
      if (prev) {
        setSidebarSelectedIds(new Set());
        return false;
      }
      return true;
    });
  }, []);

  const handleToggleSidebarSelect = useCallback((id: string) => {
    setSidebarSelectedIds((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }, []);

  const handleSelectAllDisplayed = useCallback(() => {
    setSidebarSelectedIds(new Set(displayedSidebarConversations.map((c) => c.id)));
  }, [displayedSidebarConversations]);

  const runBulkDelete = useCallback(async () => {
    const ids = Array.from(sidebarSelectedIds);
    if (ids.length === 0) {
      setBulkDeleteConfirmOpen(false);
      return;
    }
    await deleteConversationsBulk(ids);
    setBulkDeleteConfirmOpen(false);
    setSidebarSelectedIds(new Set());
    setSidebarBatchMode(false);
  }, [sidebarSelectedIds, deleteConversationsBulk]);

  const handleSaveSidebarRename = useCallback(async () => {
    const m = renameConvModal;
    if (!m || !token || !m.draft.trim()) {
      setRenameConvModal(null);
      return;
    }
    try {
      await fetch(`${API_BASE}/api/chat/conversations/${m.id}/title`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ title: m.draft.trim() }),
      });
      await refreshServerConversations();
    } catch (e) {
      console.error(e);
    }
    setRenameConvModal(null);
  }, [renameConvModal, token, refreshServerConversations]);

  const submitNewGroup = useCallback(async () => {
    if (!newGroupNameDraft.trim()) {
      setNewGroupModalOpen(false);
      return;
    }
    const row = await createFolder(newGroupNameDraft);
    setNewGroupModalOpen(false);
    setNewGroupNameDraft("");
    if (row) setSidebarFilter(row.id);
  }, [newGroupNameDraft, createFolder]);

  const submitRenameFolder = useCallback(async () => {
    const m = renameFolderModal;
    if (!m?.draft.trim()) {
      setRenameFolderModal(null);
      return;
    }
    await renameFolder(m.id, m.draft);
    setRenameFolderModal(null);
  }, [renameFolderModal, renameFolder]);

  const confirmDeleteFolder = useCallback(async () => {
    const t = deleteFolderConfirm;
    if (!t) return;
    await deleteFolder(t.id);
    if (sidebarFilter === t.id) setSidebarFilter("__ungrouped__");
    setDeleteFolderConfirm(null);
  }, [deleteFolderConfirm, deleteFolder, sidebarFilter]);

  const handleExportSidebarConversation = useCallback(
    async (id: string, title: string) => {
      if (!token) return;
      try {
        await downloadConversationMarkdown(token, id, title);
      } catch (e) {
        console.error(e);
      }
    },
    [token]
  );

  // 监听消息与追问占位变化，延迟一帧滚底以配合布局完成后高度，减弱「整块上闪」观感
  useEffect(() => {
    if (!hasStarted) return;
    if (!autoFollowMainRef.current) return;
    let rafHandle2 = 0;
    const raf1 = requestAnimationFrame(() => {
      rafHandle2 = requestAnimationFrame(() => {
        scrollToBottom(false);
      });
    });
    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(rafHandle2);
    };
  }, [
    messages,
    genState,
    hasStarted,
    scrollToBottom,
    autoFollowMainRef,
    followUpLayoutKey,
  ]);

  // 从 sessionStorage 恢复未发送的草稿（首屏回填一次）
  useEffect(() => {
    try {
      const draft = sessionStorage.getItem(PENDING_CHAT_DRAFT_KEY);
      if (draft != null && draft !== "") {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- 首屏回填草稿
        setInput(draft);
        sessionStorage.removeItem(PENDING_CHAT_DRAFT_KEY);
      }
    } catch {
      /* ignore */
    }
  }, []);

  // 切换会话时退出标题编辑
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 随 conversationId 同步编辑态
    setIsEditingTitle(false);
  }, [conversationId]);

  // 点击 Header 外部时关闭菜单
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

  const handleSend = useCallback(async () => {
    await chat.handleSend(input, setInput);
  }, [chat, input]);

  /** 附图快捷话术：直接使用文案发送，并附带当前 pending 图片（由 useChat.handleSend 清空列表） */
  const handleSendImageQuickPrompt = useCallback(
    async (prompt: string) => {
      await chat.handleSend(prompt, setInput);
    },
    [chat],
  );

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void handleSend();
    }
  };

  const handleExportHistory = () => {
    setHeaderMenuOpen(false);
    if (!messages.length) return;
    const title =
      serverConversations.find((c) => c.id === conversationId)?.title || "会话记录";
    const md = conversationToMarkdown(title, messages);
    const blob = new Blob([md], {
      type: "text/markdown;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${sanitizeDownloadBasename(title)}.md`;
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

  /** 侧栏在 md 以下隐藏，移动端用顶栏骨架表示「会话标题加载中」 */
  const showMobileTitleSkeleton =
    Boolean(token) &&
    !viewingGroupLanding &&
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

      <ConfirmDialog
        open={bulkDeleteConfirmOpen}
        title="批量删除"
        description={`确定删除已选中的 ${sidebarSelectedIds.size} 条会话？删除后无法恢复。`}
        confirmLabel="删除"
        cancelLabel="取消"
        danger
        pending={bulkDeletePending}
        onConfirm={() => void runBulkDelete()}
        onCancel={() => {
          if (bulkDeletePending) return;
          setBulkDeleteConfirmOpen(false);
        }}
      />

      <ConfirmDialog
        open={deleteFolderConfirm !== null}
        title="删除分组"
        description={
          deleteFolderConfirm
            ? `确定删除分组「${deleteFolderConfirm.name}」？会话将移回未分组。`
            : ""
        }
        confirmLabel="删除"
        cancelLabel="取消"
        danger
        pending={false}
        onConfirm={() => void confirmDeleteFolder()}
        onCancel={() => setDeleteFolderConfirm(null)}
      />

      {/* 侧栏「编辑会话名称」 */}
      <AnimatePresence>
        {renameConvModal && (
          <motion.div
            key="rename-conv"
            className="fixed inset-0 z-[300] flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
            onClick={(e) => e.target === e.currentTarget && setRenameConvModal(null)}
            {...uiModalBackdrop}
          >
            <motion.div
              className="w-full max-w-md rounded-2xl border border-[#e5e5e5] bg-white p-6 shadow-lg"
              onClick={(e) => e.stopPropagation()}
              {...uiModalPanel}
            >
              <h2 className="text-lg font-semibold text-gray-900">编辑会话名称</h2>
              <input
                autoFocus
                className="mt-4 w-full rounded-xl border border-[#e5e5e5] px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-orange-200"
                value={renameConvModal.draft}
                onChange={(e) =>
                  setRenameConvModal((m) => (m ? { ...m, draft: e.target.value } : m))
                }
                onKeyDown={(e) => {
                  if (e.key === "Enter") void handleSaveSidebarRename();
                  if (e.key === "Escape") setRenameConvModal(null);
                }}
              />
              <div className="mt-6 flex justify-end gap-2">
                <button
                  type="button"
                  className="rounded-xl border border-[#e5e5e5] px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                  onClick={() => setRenameConvModal(null)}
                >
                  取消
                </button>
                <button
                  type="button"
                  className="rounded-xl bg-[#1a1a1a] px-4 py-2 text-sm font-medium text-white hover:bg-gray-800"
                  onClick={() => void handleSaveSidebarRename()}
                >
                  保存
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 新建分组 */}
      <AnimatePresence>
        {newGroupModalOpen && (
          <motion.div
            key="new-group"
            className="fixed inset-0 z-[300] flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
            onClick={(e) => e.target === e.currentTarget && setNewGroupModalOpen(false)}
            {...uiModalBackdrop}
          >
            <motion.div
              className="w-full max-w-md rounded-2xl border border-[#e5e5e5] bg-white p-6 shadow-lg"
              onClick={(e) => e.stopPropagation()}
              {...uiModalPanel}
            >
              <h2 className="text-lg font-semibold text-gray-900">新建分组</h2>
              <input
                autoFocus
                className="mt-4 w-full rounded-xl border border-[#e5e5e5] px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-orange-200"
                placeholder="分组名称"
                value={newGroupNameDraft}
                onChange={(e) => setNewGroupNameDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void submitNewGroup();
                  if (e.key === "Escape") setNewGroupModalOpen(false);
                }}
              />
              <div className="mt-6 flex justify-end gap-2">
                <button
                  type="button"
                  className="rounded-xl border border-[#e5e5e5] px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                  onClick={() => setNewGroupModalOpen(false)}
                >
                  取消
                </button>
                <button
                  type="button"
                  className="rounded-xl bg-[#1a1a1a] px-4 py-2 text-sm font-medium text-white hover:bg-gray-800"
                  onClick={() => void submitNewGroup()}
                >
                  创建
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 重命名分组 */}
      <AnimatePresence>
        {renameFolderModal && (
          <motion.div
            key={`rename-folder-${renameFolderModal.id}`}
            className="fixed inset-0 z-[300] flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
            onClick={(e) => e.target === e.currentTarget && setRenameFolderModal(null)}
            {...uiModalBackdrop}
          >
            <motion.div
              className="w-full max-w-md rounded-2xl border border-[#e5e5e5] bg-white p-6 shadow-lg"
              onClick={(e) => e.stopPropagation()}
              {...uiModalPanel}
            >
              <h2 className="text-lg font-semibold text-gray-900">重命名分组</h2>
              <input
                autoFocus
                className="mt-4 w-full rounded-xl border border-[#e5e5e5] px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-orange-200"
                value={renameFolderModal.draft}
                onChange={(e) =>
                  setRenameFolderModal((m) => (m ? { ...m, draft: e.target.value } : m))
                }
                onKeyDown={(e) => {
                  if (e.key === "Enter") void submitRenameFolder();
                  if (e.key === "Escape") setRenameFolderModal(null);
                }}
              />
              <div className="mt-6 flex justify-end gap-2">
                <button
                  type="button"
                  className="rounded-xl border border-[#e5e5e5] px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                  onClick={() => setRenameFolderModal(null)}
                >
                  取消
                </button>
                <button
                  type="button"
                  className="rounded-xl bg-[#1a1a1a] px-4 py-2 text-sm font-medium text-white hover:bg-gray-800"
                  onClick={() => void submitRenameFolder()}
                >
                  保存
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <Sidebar
        folders={conversationFolders}
        conversationsFull={token ? serverConversations : []}
        displayedConversations={displayedSidebarConversations}
        activeId={conversationId}
        sidebarFilter={sidebarFilter}
        onSidebarFilterChange={handleSidebarFilterChange}
        onNewChat={handleNewChat}
        onSelect={selectConversationSyncSidebar}
        onDelete={openDeleteDialog}
        onRenameRequest={(id, currentTitle) =>
          setRenameConvModal({ id, draft: currentTitle || "" })
        }
        onExportConversation={handleExportSidebarConversation}
        onTogglePin={togglePinConversation}
        onMoveToGroup={moveConversationToGroup}
        onCreateFolder={() => {
          setNewGroupNameDraft("");
          setNewGroupModalOpen(true);
        }}
        onRenameFolder={(groupId, currentName) =>
          setRenameFolderModal({ id: groupId, draft: currentName })
        }
        onDeleteFolder={(groupId) => {
          const name = conversationFolders.find((f) => f.id === groupId)?.name ?? "分组";
          setDeleteFolderConfirm({ id: groupId, name });
        }}
        pinnedIds={pinnedIds}
        batchMode={sidebarBatchMode}
        onToggleBatchMode={handleToggleSidebarBatchMode}
        selectedIds={sidebarSelectedIds}
        onToggleSelect={handleToggleSidebarSelect}
        onSelectAllDisplayed={handleSelectAllDisplayed}
        onClearBatchSelection={handleClearSidebarSelection}
        onBulkDelete={() => setBulkDeleteConfirmOpen(true)}
        bulkDeletePending={bulkDeletePending}
        streamBusy={genState !== "idle"}
        isGeneratingTitle={isGeneratingTitle}
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed((v) => !v)}
        onOpenSearch={() => setSearchOpen(true)}
        movePendingId={movePendingId}
      />

      <ConversationSearchModal
        open={searchOpen}
        conversations={token ? serverConversations : []}
        onClose={() => setSearchOpen(false)}
        onSelect={(id) => {
          void selectConversationSyncSidebar(id);
          setSearchOpen(false);
        }}
        onNewChat={() => {
          handleNewChat();
          setSearchOpen(false);
        }}
      />

      <main className="flex-1 flex flex-col relative min-w-0">
        <ChatHeader
          token={token}
          authLoading={authLoading}
          groupWorkspaceTitle={viewingGroupLanding ? selectedGroupFolderName : null}
          hasStarted={hasStarted}
          conversationId={conversationId}
          serverConversations={serverConversations}
          sidebarCollapsed={sidebarCollapsed}
          isGeneratingTitle={isGeneratingTitle}
          isEditingTitle={isEditingTitle}
          editTitleValue={editTitleValue}
          headerMenuOpen={headerMenuOpen}
          headerMenuRef={headerMenuRef}
          showMobileTitleSkeleton={showMobileTitleSkeleton}
          showBackToGroupWorkspace={Boolean(
            showBackToGroupWorkspace && !conversationGroupTrail
          )}
          onBackToGroupWorkspace={handleBackToGroupWorkspace}
          conversationGroupTrail={
            conversationGroupTrail
              ? { ...conversationGroupTrail, onGroupClick: handleBackToGroupWorkspace }
              : null
          }
          onToggleSidebar={() => setSidebarCollapsed(false)}
          onNewChat={handleNewChat}
          onSetHeaderMenuOpen={setHeaderMenuOpen}
          onEditTitle={() => {
            setIsEditingTitle(true);
            setEditTitleValue(
              serverConversations.find((c) => c.id === conversationId)?.title || ""
            );
            setHeaderMenuOpen(false);
          }}
          onExportHistory={handleExportHistory}
          onDeleteConversation={() => {
            setHeaderMenuOpen(false);
            if (conversationId) openDeleteDialog(conversationId);
          }}
          onEditTitleChange={setEditTitleValue}
          onEditTitleBlur={handleSaveTitle}
          onEditTitleKeyDown={(e) => {
            if (e.key === "Enter") void handleSaveTitle();
            else if (e.key === "Escape") setIsEditingTitle(false);
          }}
          onLogout={logout}
        />

        <div className="flex flex-1 flex-col relative min-h-0 overflow-hidden">
          {!viewingGroupLanding ? (
            <>
              <div
                ref={scrollViewportRef}
                onScroll={updateScrollState}
                className={`chat-scroll-area no-scrollbar flex-1 overflow-y-auto ${
                  !viewingGroupLanding
                    ? [
                        !hasStarted ? "flex min-h-0 flex-col" : "",
                        "pb-[clamp(6.25rem,10vh,8.75rem)] md:pb-[clamp(6.5rem,10.25vh,9rem)]",
                      ].join(" ")
                    : ""
                }`}
              >
                {!hasStarted && !viewingGroupLanding && <WelcomeHero />}
                <AnimatePresence>
                  {hasStarted && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.3 }}
                  className="pt-8 pb-4 md:pb-5"
                >
                  {messages.map((msg, idx) => {
                    const prevMsg = messages[idx - 1];
                    const nextMsg = messages[idx + 1];
                    if (msg.type === "message") {
                      const afterTrace = prevMsg?.type === "trace";
                      const beforeTrace =
                        msg.role === "assistant" && nextMsg?.type === "trace";
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
                            userImageUrls={
                              msg.type === "message" && msg.role === "user"
                                ? (msg as ChatMessage).imageUrls
                                : undefined
                            }
                            modelName={msg.modelName}
                            noTopPad={afterTrace && msg.role === "assistant"}
                            noBottomPad={beforeTrace}
                            interrupted={msg.interrupted}
                            assistantToolbarReserve={
                              msg.role === "assistant" &&
                              msg.id === lastAssistantMessageId
                            }
                            assistantActionsDisabled={genState !== "idle"}
                            followUpItems={
                              msg.role === "assistant" &&
                              msg.id === lastAssistantMessageId &&
                              followUpSuggestions?.messageId === msg.id
                                ? followUpSuggestions.items
                                : undefined
                            }
                            onFollowUpClick={
                              msg.role === "assistant" && msg.id === lastAssistantMessageId
                                ? (text) => {
                                    setInput(text);
                                    requestAnimationFrame(() => inputRef.current?.focus());
                                  }
                                : undefined
                            }
                            onAssistantRegenerate={
                              msg.role === "assistant" && msg.id === lastAssistantMessageId
                                ? () => handleRegenerateAssistant(msg.id)
                                : undefined
                            }
                            onUserEdit={
                              msg.role === "user"
                                ? (text, imageUrls) => {
                                    applyComposerAttachmentsFromUserMessage(imageUrls);
                                    setInput(text);
                                    requestAnimationFrame(() => inputRef.current?.focus());
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
                            compactTopAfterAssistant={
                              prevMsg?.type === "message" && prevMsg.role === "assistant"
                            }
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
                    {genState === "waiting" && (
                      <motion.div
                        initial={{ opacity: 0, height: 0, scale: 0.5 }}
                        animate={{ opacity: 1, height: "auto", scale: 1 }}
                        exit={{ opacity: 0, height: 0, scale: 0.5, transition: { duration: 0 } }}
                        transition={{ duration: 0.15, ease: "easeOut" }}
                        className="w-full max-w-3xl lg:max-w-4xl xl:max-w-5xl mx-auto px-4 sm:px-5 md:px-6 lg:px-8 flex justify-start overflow-hidden"
                        style={{ transformOrigin: "left center" }}
                      >
                        <div className="py-3">
                          <ClaudeStar />
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* 与固定输入区留窄缝即可；过大则追问与输入框之间整块留白 */}
                  <div
                    ref={messagesEndRef}
                    className="min-h-[min(8.25vh,4rem)] shrink-0 md:min-h-[min(7.5vh,4.25rem)]"
                    aria-hidden
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <AnimatePresence>
            {showScrollToBottom && hasStarted && !viewingGroupLanding && (
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
                className="absolute left-1/2 z-20 flex -translate-x-1/2 items-center gap-2 rounded-full border border-[#e5e5e5] bg-white/92 px-3.5 py-2 text-sm text-gray-700 shadow-[0_8px_24px_rgba(0,0,0,0.08)] backdrop-blur bottom-32 md:bottom-36 hover:bg-gray-50 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-300"
              >
                <ArrowDown className="h-4 w-4" />
                <span>回到底部</span>
              </motion.button>
            )}
          </AnimatePresence>
            </>
          ) : (
            <GroupWorkspace
              groupName={selectedGroupFolderName}
              conversationsInGroup={scopedConversations}
              onOpenConversation={(id) => void selectConversationSyncSidebar(id)}
            />
          )}

          <ChatInputBar
            input={input}
            hasStarted={hasStarted || viewingGroupLanding}
            genState={genState}
            deepThinkEnabled={deepThinkEnabled}
            webSearchEnabled={webSearchEnabled}
            webSearchMode={webSearchMode}
            inputRef={inputRef}
            onInputChange={setInput}
            onKeyDown={handleKeyDown}
            onSend={() => void handleSend()}
            onStop={handleStop}
            onToggleDeepThink={() => setDeepThinkEnabled((v) => !v)}
            onToggleWebSearch={() => setWebSearchEnabled((v) => !v)}
            onSetWebSearchMode={(mode) => {
              setWebSearchEnabled(true);
              setWebSearchMode(mode);
            }}
            modelOptions={chatModelOptions}
            selectedModelId={selectedChatModelId}
            onSelectModel={setSelectedChatModelId}
            attachmentDisabled={inputBarModelCaps.attachmentDisabled}
            attachmentDisabledReason={attachmentDisabledReason}
            deepThinkDisabledByModel={inputBarModelCaps.deepThinkDisabledByModel}
            webSearchDisabledByModel={inputBarModelCaps.webSearchDisabledByModel}
            pendingImageUrls={pendingImageUrls}
            onRemovePendingImage={removePendingImageUrlAt}
            onImageFilesSelected={(files) => void pushImageAttachments(files)}
            attachmentUploadBusy={attachmentUploadBusy}
            attachmentUploadSkeletonCount={attachmentUploadSkeletonCount}
            attachmentUploadSlotProgress={attachmentUploadSlotProgress}
            onSendWithImagePrompt={handleSendImageQuickPrompt}
            fetchAiImageQuickPrompts={fetchAiImageQuickPrompts}
            placeholder={
              viewingGroupLanding ? "在这里提问，新建对话" : undefined
            }
          />
        </div>
      </main>
    </div>
  );
}
