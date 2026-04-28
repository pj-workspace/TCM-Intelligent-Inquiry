import { displayToolNameZh } from "@/lib/tool-labels";
import type { EdgeFadeState, WebResultItem } from "@/types/brainstorm";

export const INTERNAL_SCROLL_THRESHOLD = 72;
export const INTERNAL_LOCK_THRESHOLD = 8;

export function formatDurationSec(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) return "0s";
  if (sec < 10) return `${Math.round(sec * 10) / 10}s`;
  return `${Math.round(sec)}s`;
}

export function getEdgeFadeState(el: HTMLDivElement | null): EdgeFadeState {
  if (!el) return { top: false, bottom: false };
  const maxScrollTop = Math.max(0, el.scrollHeight - el.clientHeight);
  if (maxScrollTop <= 2) return { top: false, bottom: false };
  return {
    top: el.scrollTop > 6,
    bottom: el.scrollTop < maxScrollTop - 6,
  };
}

export function toolActionLabel(toolName: string): string {
  if (toolName === "searx_web_search") return "联网搜索";
  if (toolName === "search_tcm_knowledge") return "检索知识库";
  if (toolName === "formula_lookup") return "查询方剂";
  if (toolName === "recommend_formulas") return "推荐方剂";
  return displayToolNameZh(toolName);
}

export function runningToolLabel(toolName: string): string {
  const action = toolActionLabel(toolName);
  return action.startsWith("正在") ? `${action}...` : `正在${action}...`;
}

export function toolFailureLabel(toolName: string): string {
  return `${toolActionLabel(toolName)}失败(>﹏<)`;
}

export function parseWebResults(raw?: string): WebResultItem[] {
  if (!raw) return [];
  return raw
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block) => {
      const lines = block.split("\n").map((line) => line.trim()).filter(Boolean);
      const titleLine = lines[0] ?? "";
      const title = titleLine
        .replace(/^\[\d+\](\s*\[[^\]]*\])?\s*/, "")
        .trim();
      const urlIdx = lines.findIndex((line) => /^https?:\/\//i.test(line));
      return {
        title: title || "(无标题)",
        url: urlIdx >= 0 ? lines[urlIdx] : undefined,
        summary:
          urlIdx >= 0
            ? lines.slice(urlIdx + 1).join(" ")
            : lines.slice(1).join(" "),
      };
    })
    .filter((item) => item.title || item.url)
    .slice(0, 10);
}

export function parseSummaryBlocks(raw?: string): string[] {
  if (!raw) return [];
  const blocks = raw.split(/\n{2,}/).map((block) => block.trim()).filter(Boolean);
  const source = blocks.length > 0 ? blocks : [raw.trim()];
  return source.slice(0, 5).map((block) => {
    const cleaned = block
      .replace(/^\[\d+\]\s*/, "")
      .replace(/^（[^）]+）\s*/, "")
      .replace(/\s+/g, " ")
      .trim();
    return cleaned.length > 150 ? `${cleaned.slice(0, 149)}…` : cleaned;
  });
}
