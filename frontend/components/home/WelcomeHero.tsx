"use client";

import { useEffect, useState } from "react";
import { Sun } from "lucide-react";

type WelcomeVariant = {
  title: string;
  /** 打字机展示的说明正文（标题不打字） */
  body: string;
};

const WELCOME_VARIANTS: WelcomeVariant[] = [
  {
    title: "需要中医咨询吗？",
    body:
      "可以在下方输入症状或疑惑，也可以使用快捷卡片开始一段对话。\n换季、失眠、脾胃虚弱……都可以从这些话题慢慢聊开。",
  },
  {
    title: "今天想从哪里聊起？",
    body:
      "若暂时不知从何说起，不妨试试「我最近哪里不舒服」这一句。\n内容仅供科普与养生参考，不可替代线下就诊与处方。",
  },
  {
    title: "辨体质 · 食疗 · 时令",
    body:
      "你想了解手脚冰凉、口干舌燥，还是二十四节气里的饮食起居？\n在这里我们可以用白话聊聊中医怎么想这些问题。",
  },
  {
    title: "慢一点，给身体一点描述",
    body:
      "中医讲究望闻问切——在这里至少可以先说说：多久了？加重还是减轻？怕冷还是怕热？\n信息越具体，越有讨论的空间。",
  },
  {
    title: "从经典到日常",
    body:
      "既可以说《黄帝内经》里某句话是什么意思，也可以问六味地黄丸能不能吃。\n按需开启「深度思考」或「联网搜索」，探索会更灵活。",
  },
  {
    title: "养生不是进补堆砌",
    body:
      "虚火、痰湿、气滞……很多「不舒服」在中医里有自己的语言表达。\n先描述感受，再从饮食、作息、情绪慢慢梳理就好。",
  },
  {
    title: "给身心一个小对话",
    body:
      "压力大、睡不好、肩颈僵，也许都可以在这里找到一些新的理解角度。\n下方输入或直接点一张快捷卡片，随机推荐也会带你遇见不同切入点。",
  },
  {
    title: "你好奇的中医话题",
    body:
      "舌象、脉象、经络、药食同源……任选其一。\n我们不会下诊断，但能陪你把概念拆开、说清楚、想明白下一步该问医生什么。",
  },
];

/** SSR 与首次客户端渲染必须一致，避免 hydration mismatch */
const SSR_TITLE_FALLBACK = "需要中医咨询吗？";

/** 一轮打字结束后停顿，再重头打同一段正文（标题与文案不轮换） */
const LOOP_PAUSE_MS = 2800;

function pickRandomVariant(): WelcomeVariant {
  return WELCOME_VARIANTS[Math.floor(Math.random() * WELCOME_VARIANTS.length)]!;
}

function charDelayMs(ch: string, prev: string): number {
  if (ch === "\n") return 180;
  if (/[，。；：？！、]/.test(ch)) return 140;
  if (/[……]/.test(ch)) return 220;
  if (/[。.]/.test(prev) && ch !== "\n") return 80;
  return 26 + Math.round(Math.random() * 14);
}

export function WelcomeHero() {
  /** 挂载后再赋值，首轮渲染不写 random */
  const [variant, setVariant] = useState<WelcomeVariant | null>(null);
  const [typed, setTyped] = useState("");
  const [phase, setPhase] = useState<"typing" | "pause">("typing");

  useEffect(() => {
    const t = window.setTimeout(() => {
      setVariant(pickRandomVariant());
    }, 0);
    return () => window.clearTimeout(t);
  }, []);

  useEffect(() => {
    if (!variant || phase !== "typing") return;

    const full = variant.body;
    let i = 0;
    const ctrl = { cancelled: false as boolean, tid: undefined as number | undefined };

    const clear = () => {
      if (ctrl.tid !== undefined) window.clearTimeout(ctrl.tid);
      ctrl.tid = undefined;
    };

    const schedule = (ms: number, fn: () => void) => {
      clear();
      ctrl.tid = window.setTimeout(fn, ms);
    };

    const runStep = () => {
      if (ctrl.cancelled) return;
      if (i >= full.length) {
        setPhase("pause");
        return;
      }
      i += 1;
      setTyped(full.slice(0, i));
      const prev = i >= 2 ? (full[i - 2] ?? "") : "";
      const ch = full[i - 1] ?? "";
      schedule(charDelayMs(ch, prev), runStep);
    };

    const kickoff = () => {
      if (ctrl.cancelled) return;
      setTyped("");
      schedule(400, runStep);
    };

    schedule(0, kickoff);

    return () => {
      ctrl.cancelled = true;
      clear();
    };
  }, [variant, phase]);

  useEffect(() => {
    if (!variant || phase !== "pause") return;
    const t = window.setTimeout(() => {
      setPhase("typing");
    }, LOOP_PAUSE_MS);
    return () => window.clearTimeout(t);
  }, [phase, variant]);

  const showCaret = variant !== null && phase === "typing";
  const title = variant?.title ?? SSR_TITLE_FALLBACK;

  return (
    <div className="flex min-h-0 flex-1 flex-col items-center justify-center px-4 pb-4 pt-6 text-center md:pt-8">
      <div className="flex flex-wrap items-center justify-center gap-2.5 font-serif text-2xl text-[#1a1a1a] md:gap-3 md:text-3xl">
        <Sun className="h-7 w-7 shrink-0 text-orange-500 md:h-8 md:w-8" aria-hidden />
        <h1 className="text-balance">{title}</h1>
      </div>
      <p
        className="mx-auto mt-4 min-h-[5.5rem] max-w-lg text-balance text-sm leading-relaxed text-gray-500"
        aria-live="polite"
      >
        <span className="whitespace-pre-line">{typed}</span>
        {showCaret && (
          <span
            className="ml-0.5 inline-block h-4 w-px translate-y-0.5 animate-pulse bg-orange-500/90 align-middle"
            aria-hidden
          />
        )}
      </p>
    </div>
  );
}
