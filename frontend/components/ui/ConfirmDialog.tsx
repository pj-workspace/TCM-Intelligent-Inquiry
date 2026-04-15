"use client";

import { useEffect } from "react";
import { X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export type ConfirmDialogProps = {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  /** 提交中，禁用按钮并显示「请稍候」类状态 */
  pending?: boolean;
  /** 确认按钮使用警示色 */
  danger?: boolean;
};

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "确定",
  cancelLabel = "取消",
  onConfirm,
  onCancel,
  pending = false,
  danger = false,
}: ConfirmDialogProps) {
  useEffect(() => {
    if (!open || pending) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, pending, onCancel]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/40"
          role="dialog"
          aria-modal="true"
          aria-labelledby="confirm-dialog-title"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          onClick={pending ? undefined : onCancel}
        >
          <motion.div
            className="relative w-full max-w-sm rounded-2xl border border-[#e5e5e5] bg-white p-6 shadow-[0_8px_40px_rgba(0,0,0,0.12)]"
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={pending ? undefined : onCancel}
              className="absolute right-3 top-3 rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700 disabled:pointer-events-none"
              aria-label="关闭"
            >
              <X className="h-5 w-5" />
            </button>
            <h2
              id="confirm-dialog-title"
              className="pr-10 text-lg font-semibold text-gray-900"
            >
              {title}
            </h2>
            <p className="mt-3 text-sm text-gray-500 leading-relaxed">{description}</p>
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                disabled={pending}
                onClick={onCancel}
                className="px-4 py-2 text-sm font-medium text-gray-700 rounded-xl border border-[#e5e5e5] bg-white hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                {cancelLabel}
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={onConfirm}
                className={`px-4 py-2 text-sm font-medium rounded-xl text-white transition-colors disabled:opacity-50 ${
                  danger
                    ? "bg-red-600 hover:bg-red-700"
                    : "bg-[#1a1a1a] hover:bg-gray-800"
                }`}
              >
                {pending ? "请稍候…" : confirmLabel}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
