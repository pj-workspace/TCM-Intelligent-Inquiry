"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowDown } from "lucide-react";
import { Sidebar } from "@/components/chat/Sidebar";
import { ConversationSearchModal } from "@/components/chat/ConversationSearchModal";
import { MessageBubble, markdownToPlainText } from "@/components/chat/MessageBubble";
import { BrainstormPanel } from "@/components/chat/BrainstormPanel";
import { ClaudeStar } from "@/components/chat/ClaudeStar";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { ChatHeader } from "@/components/chat/ChatHeader";
import { ChatInputBar } from "@/components/chat/ChatInputBar";
import { useAuth } from "@/contexts/auth-context";
import { API_BASE } from "@/lib/api";
import { useScrollBehavior } from "@/hooks/useScrollBehavior";
import { useChat } from "@/hooks/useChat";

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

  const headerMenuRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const {
    scrollViewportRef,
    messagesEndRef,
    autoFollowMainRef,
    showScrollToBottom,
    updateScrollState,
    scrollToBottom,
    resetScrollState,
  } = useScrollBehavior(false);

  const chat = useChat({
    autoFollowMainRef,
    onNewChatScrollReset: resetScrollState,
  });

  const {
    messages,
    setMessages,
    hasStarted,
    genState,
    conversationId,
    serverConversations,
    isGeneratingTitle,
    lastAssistantMessageId,
    deleteTargetId,
    deletePending,
    deepThinkEnabled,
    setDeepThinkEnabled,
    webSearchEnabled,
    setWebSearchEnabled,
    webSearchMode,
    setWebSearchMode,
    handleStop,
    handleRegenerateAssistant,
    handleNewChat,
    handleSelectConversation,
    openDeleteDialog,
    closeDeleteDialog,
    confirmDeleteConversation,
  } = chat;

  // 监听 messages / genState 变化，自动跟随滚动
  useEffect(() => {
    if (!hasStarted) return;
    if (!autoFollowMainRef.current) return;
    scrollToBottom(false);
  }, [messages, genState, hasStarted, scrollToBottom, autoFollowMainRef]);

  // 从 sessionStorage 恢复未发送的草稿
  useEffect(() => {
    try {
      const draft = sessionStorage.getItem(PENDING_CHAT_DRAFT_KEY);
      if (draft != null && draft !== "") {
        setInput(draft);
        sessionStorage.removeItem(PENDING_CHAT_DRAFT_KEY);
      }
    } catch {
      /* ignore */
    }
  }, []);

  // 切换会话时退出标题编辑
  useEffect(() => {
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
    let text = `${title}\n\n`;
    for (const msg of messages) {
      if (msg.type === "message") {
        const role = msg.role === "user" ? "用户" : "TCM AI";
        text += `[${role}]:\n${markdownToPlainText(msg.content || "")}\n\n`;
      }
    }
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${title}.txt`;
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
      await chat.refreshServerConversations();
    } catch (e) {
      console.error(e);
    }
    setIsEditingTitle(false);
  };

  /** 侧栏在 md 以下隐藏，移动端用顶栏骨架表示「会话标题加载中」 */
  const showMobileTitleSkeleton =
    Boolean(token) &&
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

      <Sidebar
        conversations={token ? serverConversations : []}
        activeId={conversationId}
        onNewChat={handleNewChat}
        onSelect={handleSelectConversation}
        onDelete={openDeleteDialog}
        streamBusy={genState !== "idle"}
        isGeneratingTitle={isGeneratingTitle}
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed((v) => !v)}
        onOpenSearch={() => setSearchOpen(true)}
      />

      <ConversationSearchModal
        open={searchOpen}
        conversations={token ? serverConversations : []}
        onClose={() => setSearchOpen(false)}
        onSelect={(id) => {
          void handleSelectConversation(id);
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

        <div className="flex-1 flex flex-col relative overflow-hidden">
          <div
            ref={scrollViewportRef}
            onScroll={updateScrollState}
            className="chat-scroll-area no-scrollbar flex-1 overflow-y-auto"
          >
            <AnimatePresence>
              {hasStarted && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.3 }}
                  className="pt-8"
                >
                  {messages.map((msg, idx) => {
                    const prevMsg = messages[idx - 1];
                    if (msg.type === "message") {
                      const afterTrace = prevMsg?.type === "trace";
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
                            modelName={msg.modelName}
                            noTopPad={afterTrace && msg.role === "assistant"}
                            interrupted={msg.interrupted}
                            assistantActionsDisabled={genState !== "idle"}
                            onAssistantRegenerate={
                              msg.role === "assistant" && msg.id === lastAssistantMessageId
                                ? () => handleRegenerateAssistant(msg.id)
                                : undefined
                            }
                            onUserEdit={
                              msg.role === "user"
                                ? (text) => {
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

                  <div ref={messagesEndRef} className="h-50 shrink-0" />
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <AnimatePresence>
            {showScrollToBottom && hasStarted && (
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

          <ChatInputBar
            input={input}
            hasStarted={hasStarted}
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
          />
        </div>
      </main>
    </div>
  );
}
