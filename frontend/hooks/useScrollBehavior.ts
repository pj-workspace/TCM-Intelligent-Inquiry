"use client";

import { useRef, useState, useCallback, useEffect } from "react";

/** 生成中：距底部小于该值则恢复自动跟随（略宽松，避免正文开始时跟丢） */
const BOTTOM_SCROLL_THRESHOLD = 200;
/** 空闲时：距底部小于该值视为在底部，用于隐藏「回到底部」、滚动事件里恢复跟随 */
const BOTTOM_LOCK_THRESHOLD = 72;

export function useScrollBehavior(hasStarted: boolean) {
  const scrollViewportRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const autoFollowMainRef = useRef(true);
  const isNearBottomRef = useRef(true);
  const lastMainScrollTopRef = useRef(0);
  const [showScrollToBottom, setShowScrollToBottom] = useState(false);

  const updateScrollState = useCallback(() => {
    const el = scrollViewportRef.current;
    if (!el) return;
    const currentTop = el.scrollTop;
    const prevTop = lastMainScrollTopRef.current;
    const distance = el.scrollHeight - el.scrollTop - el.clientHeight;
    const userScrolledUp = currentTop < prevTop - 2;
    const atBottom = distance <= BOTTOM_LOCK_THRESHOLD;
    const isNearBottom = distance <= BOTTOM_SCROLL_THRESHOLD;
    // 内容高度骤降（如头脑风暴收起）时 scrollTop 会被钳位变小，并非用户上滑
    if (userScrolledUp && distance > BOTTOM_LOCK_THRESHOLD) {
      autoFollowMainRef.current = false;
    } else if (atBottom) {
      autoFollowMainRef.current = true;
    }
    lastMainScrollTopRef.current = currentTop;
    isNearBottomRef.current = isNearBottom;
    setShowScrollToBottom(hasStarted && !atBottom);
  }, [hasStarted]);

  const scrollToBottom = useCallback(
    (smooth: boolean) => {
      const el = scrollViewportRef.current;
      if (!el) {
        messagesEndRef.current?.scrollIntoView({
          behavior: smooth ? "smooth" : "auto",
          block: "end",
        });
        return;
      }
      el.scrollTo({ top: el.scrollHeight, behavior: smooth ? "smooth" : "auto" });
      requestAnimationFrame(updateScrollState);
    },
    [updateScrollState]
  );

  const resetScrollState = useCallback(() => {
    setShowScrollToBottom(false);
    autoFollowMainRef.current = true;
    isNearBottomRef.current = true;
    lastMainScrollTopRef.current = 0;
  }, []);

  useEffect(() => {
    updateScrollState();
  }, [hasStarted, updateScrollState]);

  return {
    scrollViewportRef,
    messagesEndRef,
    autoFollowMainRef,
    isNearBottomRef,
    showScrollToBottom,
    updateScrollState,
    scrollToBottom,
    resetScrollState,
  };
}
