import type {
  ApiMessageRow,
  FlatMessage,
  Message,
  TraceMessage,
  ToolStep,
} from "@/types/chat";
import type { BrainstormStep } from "@/components/chat/BrainstormPanel";

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
