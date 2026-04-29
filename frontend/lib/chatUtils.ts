import type {
  ApiMessageRow,
  FlatMessage,
  Message,
  TraceMessage,
  ToolStep,
} from "@/types/chat";
import type { BrainstormStep } from "@/types/brainstorm";
import { toolActionLabel } from "@/lib/brainstorm-utils";

/** 将 SSE / 历史记录中的工具入参转为可展示字符串 */
export function toolIoToPreview(v: unknown): string | undefined {
  if (v === undefined || v === null) return undefined;
  if (typeof v === "string") return v;
  try {
    return JSON.stringify(v, null, 2);
  } catch {
    return String(v);
  }
}

export function sumThinkingDurations(steps: BrainstormStep[]): number | undefined {
  const total = steps.reduce((sum, step) => {
    if (step.type !== "thinking") return sum;
    return sum + (step.durationSec ?? 0);
  }, 0);
  return total > 0 ? total : undefined;
}

export function groupMessagesIntoTraces(items: FlatMessage[]): Message[] {
  const grouped: Message[] = [];
  let pendingSteps: BrainstormStep[] = [];

  const flushPendingSteps = (collapsed: boolean) => {
    if (!pendingSteps.length) return;
    grouped.push({
      id: `trace-${pendingSteps[0].id}`,
      type: "trace",
      steps: pendingSteps,
      status: "done",
      totalDurationSec: sumThinkingDurations(pendingSteps),
      collapsed,
    } satisfies TraceMessage);
    pendingSteps = [];
  };

  for (const item of items) {
    if (item.type === "message") {
      if (pendingSteps.length > 0) {
        flushPendingSteps(item.role === "assistant");
      }
      grouped.push(item);
      continue;
    }
    pendingSteps.push(item);
  }

  flushPendingSteps(true);
  return grouped;
}

export function mapApiRowToMessage(msg: ApiMessageRow): FlatMessage {
  if (msg.role === "thinking") {
    return {
      id: msg.id,
      type: "thinking",
      content: msg.content,
      durationSec:
        msg.duration_sec != null && msg.duration_sec >= 0
          ? msg.duration_sec
          : undefined,
    };
  }
  if (msg.role === "tool") {
    try {
      const payload = JSON.parse(msg.content) as {
        name?: string;
        runId?: string;
        status?: string;
        outputPreview?: string;
        input?: unknown;
      };
      return {
        id: msg.id,
        type: "tool",
        toolName:
          typeof payload.name === "string" && payload.name ? payload.name : "tool",
        status: payload.status === "error" ? "error" : "success",
        runId: typeof payload.runId === "string" ? payload.runId : undefined,
        inputPreview: toolIoToPreview(payload.input),
        outputPreview:
          typeof payload.outputPreview === "string" && payload.outputPreview
            ? payload.outputPreview
            : undefined,
      } satisfies ToolStep;
    } catch {
      return {
        id: msg.id,
        type: "tool",
        toolName: "tool",
        status: "success",
      } satisfies ToolStep;
    }
  }
  return {
    id: msg.id,
    role: msg.role as "user" | "assistant",
    type: "message",
    content: msg.content,
    modelName:
      msg.role === "assistant" && msg.model_name ? msg.model_name : undefined,
  };
}

/* ── 会话导出（Markdown）────────────────────────────────────────────────── */

function traceStepsToMarkdown(steps: BrainstormStep[]): string {
  const lines: string[] = ["## 头脑风暴"];
  for (const step of steps) {
    if (step.type === "thinking") {
      const d =
        step.durationSec != null && Number.isFinite(step.durationSec)
          ? `${
              step.durationSec < 10
                ? Math.round(step.durationSec * 10) / 10
                : Math.round(step.durationSec)
            }s`
          : null;
      lines.push("", `### 思考${d != null ? `（${d}）` : ""}`, "", step.content);
    } else {
      const st =
        step.status === "running"
          ? "进行中"
          : step.status === "error"
            ? "失败"
            : "完成";
      lines.push("", `### 工具 · ${toolActionLabel(step.toolName)}`, "", `- **状态**：${st}`);
      if (step.inputPreview?.trim())
        lines.push("", "**参数**", "", "```", step.inputPreview.trim(), "```");
      if (step.outputPreview?.trim())
        lines.push("", "**结果摘要**", "", step.outputPreview.trim());
    }
  }
  return lines.join("\n");
}

/** 文件名用：去掉路径非法字符并截断长度 */
export function sanitizeDownloadBasename(raw: string, fallback = "会话记录"): string {
  const collapsed = raw.replace(/\s+/g, " ").trim();
  const base =
    collapsed.length > 0
      ? collapsed.replace(/[/\\?%*:|"<>[\x00-\x1f\r\n]/g, "_").replace(/_+/g, "_").trim()
      : fallback;
  const clipped = base.substring(0, 120).replace(/^\.+|\.+$/g, "") || fallback;
  return clipped;
}

/**
 * 会话导出为 Markdown：保留 Markdown 原文，头脑风暴/trace 导出为可读小节。
 */
export function conversationToMarkdown(title: string, messages: Message[]): string {
  const heading = sanitizeDownloadBasename(title);
  const blocks: string[] = [`# ${heading}`];
  for (const msg of messages) {
    if (msg.type === "message") {
      const who = msg.role === "user" ? "用户" : "TCM AI";
      let block = `## ${who}\n\n${msg.content ?? ""}`;
      if (msg.role === "assistant") {
        const extras: string[] = [];
        if (msg.modelName?.trim())
          extras.push(`_模型：${msg.modelName.trim()}_`);
        if (msg.interrupted)
          extras.push("_（本条输出曾被终止）_");
        if (extras.length) block += `\n\n${extras.join("\n\n")}`;
      }
      blocks.push(block);
    } else if (msg.type === "trace") {
      blocks.push(traceStepsToMarkdown(msg.steps));
    }
  }
  return `${blocks.filter((b) => b.trim()).join("\n\n---\n\n")}\n`;
}
