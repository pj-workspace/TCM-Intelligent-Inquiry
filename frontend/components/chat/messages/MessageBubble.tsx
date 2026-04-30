"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { markdownToPlainText } from "@/lib/markdown-utils";
import { UserBubble } from "./UserBubble";
import { AssistantBubble } from "./AssistantBubble";

export { markdownToPlainText };

interface MessageBubbleProps {
  role: "user" | "assistant";
  content: string;
  /** 用户多模态气泡 */
  userImageUrls?: string[];
  /** 助手消息：后端 SSE meta.chatModel */
  modelName?: string;
  assistantActionsDisabled?: boolean;
  onAssistantRegenerate?: () => void;
  /** 仅最后一条助手：追问骨架 */
  followUpsLoading?: boolean;
  /** 仅最后一条助手：追问文案 */
  followUpItems?: string[];
  /** 点击追问填入输入框 */
  onFollowUpClick?: (text: string) => void;
  /** 用户消息：将内容与附图一并恢复到输入栏 */
  onUserEdit?: (text: string, imageUrls?: string[]) => void;
  noTopPad?: boolean;
  /** 助手：下一条是头脑风暴时收紧下边距 */
  noBottomPad?: boolean;
  /** 助手消息：用户主动终止输出后为 true */
  interrupted?: boolean;
}

export function MessageBubble({
  role,
  content,
  userImageUrls,
  modelName,
  assistantActionsDisabled,
  onAssistantRegenerate,
  followUpsLoading,
  followUpItems,
  onFollowUpClick,
  onUserEdit,
  noTopPad,
  noBottomPad,
  interrupted,
}: MessageBubbleProps) {
  const isUser = role === "user";
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const [ttsPlaying, setTtsPlaying] = useState(false);
  const ttsPlayingRef = useRef(false);
  const [copied, setCopied] = useState(false);

  const plain = markdownToPlainText(content);

  const handleCopy = useCallback(async () => {
    try {
      let text = isUser ? content : plain;
      if (isUser && userImageUrls?.length) {
        const extra = userImageUrls.join("\n");
        text = content?.trim() ? `${content}\n\n${extra}` : extra;
      }
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  }, [content, isUser, plain, userImageUrls]);

  const toggleReadAloud = useCallback(() => {
    if (typeof window === "undefined" || !window.speechSynthesis) return;
    const text = plain || content;
    if (!text.trim()) return;

    if (ttsPlayingRef.current) {
      window.speechSynthesis.cancel();
      ttsPlayingRef.current = false;
      setTtsPlaying(false);
      return;
    }

    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "zh-CN";
    u.onend = () => {
      ttsPlayingRef.current = false;
      setTtsPlaying(false);
    };
    u.onerror = () => {
      ttsPlayingRef.current = false;
      setTtsPlaying(false);
    };
    window.speechSynthesis.speak(u);
    ttsPlayingRef.current = true;
    setTtsPlaying(true);
  }, [plain, content]);

  useEffect(() => {
    const t = window.setInterval(() => {
      if (
        ttsPlayingRef.current &&
        !window.speechSynthesis.speaking &&
        !window.speechSynthesis.pending
      ) {
        ttsPlayingRef.current = false;
        setTtsPlaying(false);
      }
    }, 400);
    return () => window.clearInterval(t);
  }, []);

  useEffect(() => {
    if (!menuOpen) return;
    const close = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [menuOpen]);

  if (isUser) {
    return (
      <UserBubble
        content={content}
        imageUrls={userImageUrls}
        copied={copied}
        onCopy={() => void handleCopy()}
        onEdit={onUserEdit}
      />
    );
  }

  return (
    <AssistantBubble
      content={content}
      modelName={modelName}
      assistantActionsDisabled={assistantActionsDisabled}
      onAssistantRegenerate={onAssistantRegenerate}
      followUpsLoading={followUpsLoading}
      followUpItems={followUpItems}
      onFollowUpClick={onFollowUpClick}
      noTopPad={noTopPad}
      noBottomPad={noBottomPad}
      interrupted={interrupted}
      copied={copied}
      onCopy={() => void handleCopy()}
      ttsPlaying={ttsPlaying}
      onToggleTts={toggleReadAloud}
      menuOpen={menuOpen}
      onMenuToggle={() => setMenuOpen((o) => !o)}
      menuRef={menuRef}
    />
  );
}
