"use client";

import { motion, AnimatePresence } from "framer-motion";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import {
  Plus,
  Send,
  Square,
  ChevronDown,
  PenLine,
  BookOpen,
  Leaf,
  Sun,
  Brain,
  Globe,
  Check,
} from "lucide-react";
import type { GenerationState } from "@/types/chat";

const springTransition = {
  type: "spring" as const,
  stiffness: 300,
  damping: 30,
  mass: 0.8,
};

type ChatInputBarProps = {
  input: string;
  hasStarted: boolean;
  genState: GenerationState;
  deepThinkEnabled: boolean;
  webSearchEnabled: boolean;
  webSearchMode: "force" | "auto";
  inputRef: React.RefObject<HTMLTextAreaElement | null>;
  onInputChange: (value: string) => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
  onSend: () => void;
  onStop: () => void;
  onToggleDeepThink: () => void;
  onToggleWebSearch: () => void;
  onSetWebSearchMode: (mode: "force" | "auto") => void;
};

export function ChatInputBar({
  input,
  hasStarted,
  genState,
  deepThinkEnabled,
  webSearchEnabled,
  webSearchMode,
  inputRef,
  onInputChange,
  onKeyDown,
  onSend,
  onStop,
  onToggleDeepThink,
  onToggleWebSearch,
  onSetWebSearchMode,
}: ChatInputBarProps) {
  return (
    <motion.div
      layout
      transition={springTransition}
      className={`absolute left-0 right-0 px-4 md:px-8 flex flex-col items-center z-10 ${
        hasStarted
          ? "bottom-0 pb-6 pt-4 bg-gradient-to-t from-[#fdfdfc] via-[#fdfdfc] to-transparent"
          : "bottom-[45%]"
      }`}
    >
      <AnimatePresence mode="popLayout">
        {!hasStarted && (
          <motion.div
            layout
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            className="mb-8 flex items-center gap-3 text-3xl md:text-4xl font-serif text-[#1a1a1a]"
          >
            <Sun className="w-8 h-8 text-orange-500" />
            <span>需要中医咨询吗？</span>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="w-full max-w-3xl lg:max-w-4xl xl:max-w-5xl relative">
        <motion.div
          layout
          transition={springTransition}
          className="relative flex flex-col w-full bg-white rounded-2xl border border-[#e5e5e5] shadow-[0_2px_10px_rgba(0,0,0,0.02)] focus-within:border-gray-300 focus-within:shadow-[0_4px_20px_rgba(0,0,0,0.05)] transition-shadow overflow-hidden"
        >
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => onInputChange(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="有问题，尽管问，Shift+Enter 换行"
            className="no-scrollbar w-full max-h-[200px] min-h-[60px] overflow-y-auto py-4 px-4 bg-transparent resize-none outline-none text-[16px] text-gray-800 placeholder:text-gray-400"
            rows={1}
          />

          <motion.div
            layout="position"
            className="flex flex-wrap items-center justify-between gap-2 px-3 pb-3 pt-1"
          >
            <div className="flex flex-wrap items-center gap-2 min-w-0 flex-1">
              {/* 深度思考按钮 */}
              <button
                type="button"
                onClick={onToggleDeepThink}
                disabled={genState !== "idle"}
                title="开启后系统提示将要求模型逐步推理；若接口支持，思考过程将流式展示"
                className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-all duration-150 disabled:opacity-50 ${
                  deepThinkEnabled
                    ? "border-emerald-400 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                    : "border-gray-200 bg-gray-50 text-gray-600 hover:bg-gray-100"
                }`}
              >
                <Brain className="h-3.5 w-3.5 shrink-0" />
                深度思考
              </button>

              {/* 联网搜索按钮组 */}
              <div
                className={`inline-flex items-center rounded-full border transition-all duration-150 ${
                  genState !== "idle" ? "pointer-events-none opacity-50" : ""
                } ${
                  webSearchEnabled
                    ? "border-emerald-400 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                    : "border-gray-200 bg-gray-50 text-gray-600 hover:bg-gray-100"
                }`}
              >
                <button
                  type="button"
                  disabled={genState !== "idle"}
                  onClick={onToggleWebSearch}
                  title={webSearchEnabled ? "关闭联网搜索" : "开启联网搜索"}
                  className="flex items-center gap-1.5 rounded-l-full py-1.5 pl-3 pr-1 text-xs font-medium transition-colors hover:bg-black/[0.06]"
                >
                  <Globe className="h-3.5 w-3.5 shrink-0" />
                  联网搜索
                </button>
                <DropdownMenu.Root modal={false}>
                  <DropdownMenu.Trigger asChild>
                    <button
                      type="button"
                      disabled={genState !== "idle"}
                      aria-label="选择联网搜索模式"
                      title="选择联网搜索模式"
                      className="group flex cursor-pointer items-center rounded-r-full py-1.5 pl-0.5 pr-2 hover:bg-black/5 disabled:cursor-not-allowed"
                    >
                      <span
                        className={`flex items-center justify-center transition-transform duration-150 group-hover:scale-110 group-data-[state=open]:scale-110 ${
                          webSearchEnabled
                            ? "group-hover:text-emerald-800 group-data-[state=open]:text-emerald-800"
                            : "group-hover:text-gray-800 group-data-[state=open]:text-gray-800"
                        }`}
                        aria-hidden
                      >
                        <ChevronDown
                          className="h-3.5 w-3.5 shrink-0 transition-transform duration-200 ease-out group-data-[state=open]:rotate-180"
                          strokeWidth={2.25}
                        />
                      </span>
                    </button>
                  </DropdownMenu.Trigger>
                  <DropdownMenu.Portal>
                    <DropdownMenu.Content
                      side="top"
                      align="end"
                      sideOffset={6}
                      className="z-[100] w-fit min-w-[10.5rem] rounded-lg border border-gray-200 bg-white py-1 shadow-md outline-none"
                    >
                      <DropdownMenu.Label className="px-3 pb-0.5 pt-1.5 text-[11px] font-medium text-gray-400">
                        联网搜索模式
                      </DropdownMenu.Label>
                      <DropdownMenu.Item
                        className="mx-1 grid cursor-pointer grid-cols-[auto_1rem] items-center gap-2 rounded-md px-2 py-1.5 text-left outline-none transition-colors data-[highlighted]:bg-gray-50"
                        onSelect={() => onSetWebSearchMode("auto")}
                      >
                        <div className="min-w-0">
                          <div className="text-sm font-medium text-gray-900">自动</div>
                          <div className="text-[11px] leading-tight text-gray-400">
                            自动判断是否联网
                          </div>
                        </div>
                        {webSearchEnabled && webSearchMode === "auto" ? (
                          <Check className="h-3.5 w-3.5 shrink-0 text-gray-700" strokeWidth={2.5} />
                        ) : (
                          <span className="h-3.5 w-3.5 shrink-0" aria-hidden />
                        )}
                      </DropdownMenu.Item>
                      <DropdownMenu.Item
                        className="mx-1 grid cursor-pointer grid-cols-[auto_1rem] items-center gap-2 rounded-md px-2 py-1.5 text-left outline-none transition-colors data-[highlighted]:bg-gray-50"
                        onSelect={() => onSetWebSearchMode("force")}
                      >
                        <div className="min-w-0">
                          <div className="text-sm font-medium text-gray-900">手动</div>
                          <div className="text-[11px] leading-tight text-gray-400">
                            手动控制联网状态
                          </div>
                        </div>
                        {webSearchEnabled && webSearchMode === "force" ? (
                          <Check className="h-3.5 w-3.5 shrink-0 text-gray-700" strokeWidth={2.5} />
                        ) : (
                          <span className="h-3.5 w-3.5 shrink-0" aria-hidden />
                        )}
                      </DropdownMenu.Item>
                    </DropdownMenu.Content>
                  </DropdownMenu.Portal>
                </DropdownMenu.Root>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                title="附件（待接入）"
              >
                <Plus className="w-5 h-5" />
              </button>

              <button
                type="button"
                disabled
                title="模型切换即将推出"
                aria-disabled="true"
                className="flex items-center gap-1.5 px-2.5 py-1.5 text-sm font-medium text-gray-500 rounded-lg opacity-60 disabled:hover:bg-transparent disabled:hover:text-gray-500"
              >
                TCM Pro 1.0
                <ChevronDown className="w-3.5 h-3.5" />
              </button>

              {genState !== "idle" ? (
                <button
                  type="button"
                  onClick={onStop}
                  title="终止输出"
                  className="p-1.5 rounded-lg transition-all duration-200 flex items-center justify-center bg-red-500 text-white hover:bg-red-600 active:scale-95"
                >
                  <Square className="w-4 h-4 fill-current" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={onSend}
                  disabled={genState !== "idle"}
                  className={`p-1.5 rounded-lg transition-all duration-200 flex items-center justify-center ${
                    input.trim()
                      ? "bg-black text-white hover:bg-gray-800 scale-105"
                      : "bg-transparent text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                  }`}
                >
                  <Send className="w-4 h-4" />
                </button>
              )}
            </div>
          </motion.div>
        </motion.div>

        {/* 快捷问题建议（首屏） */}
        <AnimatePresence mode="popLayout">
          {!hasStarted && (
            <motion.div
              layout
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96 }}
              transition={{ duration: 0.15, ease: "easeOut" }}
              className="flex flex-wrap items-center justify-center gap-2 mt-6"
            >
              <motion.button
                type="button"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => onInputChange("我最近总是失眠多梦，该怎么调理？")}
                className="flex items-center gap-2 px-4 py-2 bg-white border border-[#e5e5e5] rounded-full text-sm text-gray-600 hover:bg-gray-50 transition-colors shadow-sm"
              >
                <PenLine className="w-4 h-4 text-blue-500" />
                症状自查
              </motion.button>
              <motion.button
                type="button"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => onInputChange("六味地黄丸的功效和禁忌是什么？")}
                className="flex items-center gap-2 px-4 py-2 bg-white border border-[#e5e5e5] rounded-full text-sm text-gray-600 hover:bg-gray-50 transition-colors shadow-sm"
              >
                <BookOpen className="w-4 h-4 text-green-500" />
                方剂查询
              </motion.button>
              <motion.button
                type="button"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => onInputChange("春季养肝有什么好的食疗建议？")}
                className="flex items-center gap-2 px-4 py-2 bg-white border border-[#e5e5e5] rounded-full text-sm text-gray-600 hover:bg-gray-50 transition-colors shadow-sm"
              >
                <Leaf className="w-4 h-4 text-orange-500" />
                节气养生
              </motion.button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* 免责声明 */}
        <AnimatePresence>
          <motion.div
            key="disclaimer"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="text-center mt-3 text-xs text-gray-400 font-medium px-2"
          >
            AI 可能会产生误导性信息，请结合实际情况判断。
          </motion.div>
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
