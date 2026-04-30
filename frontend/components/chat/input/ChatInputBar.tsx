"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import * as Select from "@radix-ui/react-select";
import {
  Plus,
  Send,
  Square,
  ChevronDown,
  PenLine,
  BookOpen,
  Leaf,
  Brain,
  Globe,
  Check,
  Stethoscope,
  HeartPulse,
  Apple,
  Moon,
  Sun,
  Wind,
  Sparkles,
  ScrollText,
  ThermometerSun,
  Activity,
  type LucideIcon,
} from "lucide-react";
import type { GenerationState } from "@/types/chat";
import type { ModelOption } from "@/types/models";

const springTransition = {
  type: "spring" as const,
  stiffness: 300,
  damping: 30,
  mass: 0.8,
};

/** 首屏输入区上方每次随机展示条数 */
const QUICK_PROMPT_SHOW_COUNT = 5;

type QuickPromptItem = {
  title: string;
  subtitle: string;
  prompt: string;
  Icon: LucideIcon;
  iconClassName: string;
};

const QUICK_PROMPT_POOL: QuickPromptItem[] = [
  {
    title: "症状自查",
    subtitle: "睡眠、疲乏等常见问题",
    prompt: "我最近总是失眠多梦，该怎么调理？",
    Icon: PenLine,
    iconClassName: "text-blue-500",
  },
  {
    title: "方剂查询",
    subtitle: "经典方功效与须知",
    prompt: "六味地黄丸的功效和禁忌是什么？",
    Icon: BookOpen,
    iconClassName: "text-emerald-600",
  },
  {
    title: "节气养生",
    subtitle: "四时饮食起居建议",
    prompt: "春季养肝有什么好的食疗建议？",
    Icon: Leaf,
    iconClassName: "text-orange-500",
  },
  {
    title: "体质辨识",
    subtitle: "平和、气虚、阴虚等",
    prompt: "怕冷又容易累，从中医角度可能是什么体质？日常怎么调养？",
    Icon: Activity,
    iconClassName: "text-violet-600",
  },
  {
    title: "舌脉科普",
    subtitle: "了解诊察含义",
    prompt: "舌苔厚腻在中医里一般说明什么？需要注意什么？",
    Icon: Stethoscope,
    iconClassName: "text-sky-600",
  },
  {
    title: "情志调摄",
    subtitle: "压力、焦虑与肝郁",
    prompt: "工作压力大、容易烦躁胸闷，中医有哪些简单的调理思路？",
    Icon: Wind,
    iconClassName: "text-teal-600",
  },
  {
    title: "食疗药膳",
    subtitle: "安全与搭配原则",
    prompt: "脾胃虚弱的人适合常吃哪些家常菜？有哪些需要少吃的？",
    Icon: Apple,
    iconClassName: "text-rose-600",
  },
  {
    title: "作息与节律",
    subtitle: "睡眠与子午流注",
    prompt: "经常熬夜伤肝吗？中医对作息有什么讲究？",
    Icon: Moon,
    iconClassName: "text-indigo-600",
  },
  {
    title: "四季起居",
    subtitle: "顺应寒热",
    prompt: "三伏天容易中暑乏力，中医养生要注意什么？",
    Icon: Sun,
    iconClassName: "text-amber-600",
  },
  {
    title: "经典条文",
    subtitle: "《内经》等入门",
    prompt: "用通俗的话解释一下「未病先防」在《黄帝内经》里是什么意思？",
    Icon: ScrollText,
    iconClassName: "text-stone-600",
  },
  {
    title: "感冒分型",
    subtitle: "风寒风热辨要点",
    prompt: "流清涕、怕冷无汗，在中医里常见于哪种感冒类型？该怎样护理？",
    Icon: ThermometerSun,
    iconClassName: "text-orange-600",
  },
  {
    title: "脾胃养护",
    subtitle: "纳呆、腹胀",
    prompt: "饭后容易腹胀嗳气，中医认为可能是什么问题？饮食方面怎么改善？",
    Icon: HeartPulse,
    iconClassName: "text-red-600",
  },
  {
    title: "穴位保健",
    subtitle: "日常按揉常识",
    prompt: "经常久坐颈肩酸胀，有哪几个常用的保健穴位可以自己按揉？",
    Icon: Sparkles,
    iconClassName: "text-fuchsia-600",
  },
  {
    title: "药食禁忌",
    subtitle: "合理进补",
    prompt: "感冒发烧期间，饮食上中医一般建议避免什么？",
    Icon: BookOpen,
    iconClassName: "text-green-700",
  },
];

function pickRandomPrompts(pool: QuickPromptItem[], count: number): QuickPromptItem[] {
  const copy = [...pool];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, Math.min(count, copy.length));
}

/** SSR 与水合首帧必须与服务端 HTML 完全一致，禁止使用 random */
function initialQuickPromptsForHydration(): QuickPromptItem[] {
  return QUICK_PROMPT_POOL.slice(0, QUICK_PROMPT_SHOW_COUNT);
}

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
  modelOptions: ModelOption[];
  selectedModelId: string;
  onSelectModel: (id: string) => void;
  attachmentDisabled: boolean;
  deepThinkDisabledByModel: boolean;
  webSearchDisabledByModel: boolean;
  placeholder?: string;
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
  modelOptions,
  selectedModelId,
  onSelectModel,
  attachmentDisabled,
  deepThinkDisabledByModel,
  webSearchDisabledByModel,
  placeholder = "有问题，尽管问，Shift+Enter 换行",
}: ChatInputBarProps) {
  const [quickPromptChoices, setQuickPromptChoices] = useState<QuickPromptItem[]>(
    initialQuickPromptsForHydration
  );

  useEffect(() => {
    const t = window.setTimeout(() => {
      setQuickPromptChoices(pickRandomPrompts(QUICK_PROMPT_POOL, QUICK_PROMPT_SHOW_COUNT));
    }, 0);
    return () => window.clearTimeout(t);
  }, []);

  return (
    <motion.div
      layout
      transition={springTransition}
      className="absolute bottom-0 left-0 right-0 z-10 flex flex-col items-center bg-gradient-to-t from-[#fdfdfc] from-40% via-[#fdfdfc]/95 to-transparent px-4 pb-6 pt-4 md:px-8"
    >
      <div className="relative w-full max-w-3xl lg:max-w-4xl xl:max-w-5xl">
        {/* 快捷入口：紧贴输入框上方横排（参考元宝式布局） */}
        <AnimatePresence mode="popLayout">
          {!hasStarted && (
            <motion.div
              layout
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 6 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="no-scrollbar mb-3 flex flex-wrap gap-2 sm:flex-nowrap sm:snap-x sm:snap-mandatory sm:overflow-x-auto pb-0.5"
            >
              {quickPromptChoices.map((item) => {
                const { Icon } = item;
                return (
                  <motion.button
                    key={item.prompt}
                    type="button"
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.99 }}
                    onClick={() => onInputChange(item.prompt)}
                    className="w-max max-w-[min(20rem,calc(100vw-5rem))] shrink-0 snap-start rounded-xl border border-[#e5e5e5] bg-white/95 px-3 py-2 text-left shadow-sm transition-colors hover:border-gray-300 hover:bg-white sm:max-w-[min(21rem,calc((100vw-7rem)/2))] md:py-2.5"
                  >
                    <div className="flex min-w-0 gap-2">
                      <Icon
                        className={`mt-0.5 h-4 w-4 shrink-0 ${item.iconClassName}`}
                        aria-hidden
                      />
                      <div className="min-w-[6.5rem] max-w-[16rem] sm:max-w-[18rem]">
                        <div className="whitespace-normal text-sm font-semibold leading-snug text-gray-900">
                          {item.title}
                        </div>
                        <p className="mt-1 whitespace-normal text-[11px] leading-snug text-gray-500">
                          {item.subtitle}
                        </p>
                      </div>
                    </div>
                  </motion.button>
                );
              })}
            </motion.div>
          )}
        </AnimatePresence>

        <motion.div
          layout
          transition={springTransition}
          className="relative flex w-full flex-col overflow-hidden rounded-2xl border border-[#e5e5e5] bg-white shadow-[0_2px_10px_rgba(0,0,0,0.02)] transition-shadow focus-within:border-gray-300 focus-within:shadow-[0_4px_20px_rgba(0,0,0,0.05)]"
        >
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => onInputChange(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder={placeholder}
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
                disabled={genState !== "idle" || deepThinkDisabledByModel}
                title={
                  deepThinkDisabledByModel
                    ? "当前模型不支持深度思考"
                    : "开启后系统提示将要求模型逐步推理；若接口支持，思考过程将流式展示"
                }
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
                  genState !== "idle" || webSearchDisabledByModel
                    ? "pointer-events-none opacity-50"
                    : ""
                } ${
                  webSearchEnabled
                    ? "border-emerald-400 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                    : "border-gray-200 bg-gray-50 text-gray-600 hover:bg-gray-100"
                }`}
              >
                <button
                  type="button"
                  disabled={genState !== "idle" || webSearchDisabledByModel}
                  onClick={onToggleWebSearch}
                  title={
                    webSearchDisabledByModel
                      ? "当前模型不支持工具调用（含联网检索）"
                      : webSearchEnabled
                        ? "关闭联网搜索"
                        : "开启联网搜索"
                  }
                  className="flex items-center gap-1.5 rounded-l-full py-1.5 pl-3 pr-1 text-xs font-medium transition-colors hover:bg-black/[0.06]"
                >
                  <Globe className="h-3.5 w-3.5 shrink-0" />
                  联网搜索
                </button>
                <DropdownMenu.Root modal={false}>
                  <DropdownMenu.Trigger asChild>
                    <button
                      type="button"
                      disabled={genState !== "idle" || webSearchDisabledByModel}
                      aria-label="选择联网搜索模式"
                      title={
                        webSearchDisabledByModel ? "当前模型不支持联网检索" : "选择联网搜索模式"
                      }
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
                disabled={attachmentDisabled}
                aria-disabled={attachmentDisabled}
                className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 disabled:cursor-not-allowed disabled:opacity-40"
                title={
                  attachmentDisabled
                    ? "当前模型暂未开放图片附件入口"
                    : "附件（待接入：多模态消息）"
                }
              >
                <Plus className="h-5 w-5" />
              </button>

              {modelOptions.length === 0 ? (
                <span
                  className="truncate rounded-lg px-2 py-1.5 text-xs font-medium text-gray-500 opacity-75"
                  title="使用服务端配置的默认对话模型（未检测到可选模型列表）"
                >
                  默认模型
                </span>
              ) : (
                <Select.Root
                  disabled={genState !== "idle"}
                  value={
                    selectedModelId ||
                    modelOptions.find((o) => o.default)?.id ||
                    modelOptions[0]?.id ||
                    ""
                  }
                  onValueChange={onSelectModel}
                >
                  <Select.Trigger className="flex max-w-[10.5rem] items-center gap-1 rounded-lg border border-transparent px-2 py-1.5 text-sm font-medium text-gray-800 outline-none transition-colors hover:bg-gray-100 focus-visible:border-gray-300 disabled:opacity-45">
                    <Select.Value placeholder="模型" />
                    <Select.Icon aria-hidden>
                      <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-55" />
                    </Select.Icon>
                  </Select.Trigger>
                  <Select.Portal>
                    <Select.Content
                      position="popper"
                      sideOffset={6}
                      collisionPadding={8}
                      className="z-[9999] max-h-60 min-w-[min(14rem,var(--radix-select-trigger-width))] overflow-hidden rounded-lg border border-gray-200 bg-white py-1 shadow-lg"
                    >
                      <Select.Viewport className="p-0.5">
                        {modelOptions.map((o) => (
                          <Select.Item
                            key={o.id}
                            value={o.id}
                            className="relative cursor-pointer select-none rounded-md px-2.5 py-2 text-sm text-gray-900 outline-none data-[highlighted]:bg-gray-50"
                          >
                            <Select.ItemText>{o.label}</Select.ItemText>
                          </Select.Item>
                        ))}
                      </Select.Viewport>
                    </Select.Content>
                  </Select.Portal>
                </Select.Root>
              )}

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
