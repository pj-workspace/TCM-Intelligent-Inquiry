"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import type { WheelEvent, RefObject } from "react";
import type { BrainstormStep, EdgeFadeState } from "@/types/brainstorm";
import {
  getEdgeFadeState,
  INTERNAL_LOCK_THRESHOLD,
  INTERNAL_SCROLL_THRESHOLD,
} from "@/lib/brainstorm-utils";

interface UseBrainstormScrollOptions {
  steps: BrainstormStep[];
  isOpen: boolean;
}

interface UseBrainstormScrollReturn {
  scrollRef: RefObject<HTMLDivElement | null>;
  edgeFade: EdgeFadeState;
  onScroll: () => void;
  onWheel: (e: WheelEvent<HTMLDivElement>) => void;
}

export function useBrainstormScroll({
  steps,
  isOpen,
}: UseBrainstormScrollOptions): UseBrainstormScrollReturn {
  const scrollRef = useRef<HTMLDivElement>(null);
  const autoFollowRef = useRef(true);
  const lastScrollTopRef = useRef(0);
  /** 用于检测「刚从收起变为展开」，此时应强制滚到底 */
  const wasOpenRef = useRef(false);
  const [edgeFade, setEdgeFade] = useState<EdgeFadeState>({
    top: false,
    bottom: false,
  });

  const scrollToEnd = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
    lastScrollTopRef.current = el.scrollTop;
    setEdgeFade(getEdgeFadeState(el));
  }, []);

  const onScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const currentTop = el.scrollTop;
    const prevTop = lastScrollTopRef.current;
    const distance = el.scrollHeight - el.scrollTop - el.clientHeight;
    const userScrolledUp = currentTop < prevTop - 2;
    const atBottom = distance <= INTERNAL_LOCK_THRESHOLD;
    if (userScrolledUp) {
      autoFollowRef.current = false;
    } else if (atBottom) {
      autoFollowRef.current = true;
    }
    lastScrollTopRef.current = currentTop;
    const nextFade = getEdgeFadeState(el);
    setEdgeFade((prev) =>
      prev.top === nextFade.top && prev.bottom === nextFade.bottom
        ? prev
        : nextFade
    );
  }, []);

  const onWheel = useCallback((e: WheelEvent<HTMLDivElement>) => {
    const el = scrollRef.current;
    if (!el) return;
    const atTop = el.scrollTop === 0;
    const atBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 1;
    if ((atTop && e.deltaY < 0) || (atBottom && e.deltaY > 0)) return;
    e.stopPropagation();
  }, []);

  // 刚从收起展开：强制跟到底（展开瞬间 scrollTop=0 时 distance 很大，旧逻辑不会滚）
  useLayoutEffect(() => {
    if (!isOpen) {
      wasOpenRef.current = false;
      return;
    }
    const justOpened = !wasOpenRef.current;
    wasOpenRef.current = true;
    if (!justOpened) return;
    autoFollowRef.current = true;
    scrollToEnd();
    let cancelled = false;
    const raf1 = requestAnimationFrame(() => {
      if (cancelled) return;
      scrollToEnd();
      requestAnimationFrame(() => {
        if (cancelled) return;
        scrollToEnd();
      });
    });
    const t = window.setTimeout(() => {
      if (!cancelled) scrollToEnd();
    }, 280);
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf1);
      window.clearTimeout(t);
    };
  }, [isOpen, scrollToEnd]);

  // 外层头脑风暴滚动区：内容变化时，若开启跟滚或已在底部附近则滚到底
  useEffect(() => {
    if (!isOpen) return;
    const el = scrollRef.current;
    if (!el) return;
    const distance = el.scrollHeight - el.scrollTop - el.clientHeight;
    if (autoFollowRef.current || distance <= INTERNAL_SCROLL_THRESHOLD) {
      if (distance <= INTERNAL_SCROLL_THRESHOLD) {
        autoFollowRef.current = true;
      }
      el.scrollTop = el.scrollHeight;
      lastScrollTopRef.current = el.scrollTop;
    }
    setEdgeFade(getEdgeFadeState(el));
  }, [steps, isOpen, scrollToEnd]);

  useEffect(() => {
    if (!isOpen) return;
    const el = scrollRef.current;
    if (!el) return;
    setEdgeFade(getEdgeFadeState(el));
  }, [isOpen]);

  return { scrollRef, edgeFade, onScroll, onWheel };
}
