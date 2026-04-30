/**
 * 与其它 UI 共用：弹窗遮罩 / 卡片 / 小菜单。
 * easing 与 `app/styles/animations.css` 中 `--ui-ease-pop` 保持一致。
 */
export const UI_EASE_POP = [0.16, 1, 0.3, 1] as const;

export const uiModalBackdrop = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
  transition: { duration: 0.22, ease: UI_EASE_POP },
} as const;

export const uiModalPanel = {
  initial: { opacity: 0, scale: 0.96, y: 12 },
  animate: { opacity: 1, scale: 1, y: 0 },
  exit: { opacity: 0, scale: 0.96, y: 12 },
  transition: {
    type: "spring" as const,
    stiffness: 460,
    damping: 34,
    mass: 0.82,
  },
} as const;

/** 主按钮下方展开的小菜单（顶栏 ⋮ 等）：从略高处落下，而非自下而上 */
export const uiDropdownBelow = {
  initial: { opacity: 0, scale: 0.98, y: -8 },
  animate: { opacity: 1, scale: 1, y: 0 },
  exit: { opacity: 0, scale: 0.98, y: -4 },
  transition: { duration: 0.2, ease: UI_EASE_POP },
} as const;

/** 贴顶/贴边轻量 Popover */
export const uiMenuPopover = {
  initial: { opacity: 0, scale: 0.98, y: -6 },
  animate: { opacity: 1, scale: 1, y: 0 },
  exit: { opacity: 0, scale: 0.98, y: -6 },
  transition: { duration: 0.2, ease: UI_EASE_POP },
} as const;
