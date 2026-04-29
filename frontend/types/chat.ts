import type { BrainstormStep } from "@/types/brainstorm";

export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  type: "message";
  content: string;
  /** 助手消息：来自 SSE meta.chatModel */
  modelName?: string;
  /** 助手消息：用户点击终止后标记为 true */
  interrupted?: boolean;
};

export type ThinkingStep = Extract<BrainstormStep, { type: "thinking" }>;
export type ToolStep = Extract<BrainstormStep, { type: "tool" }>;
export type FlatMessage = ChatMessage | ThinkingStep | ToolStep;

export type TraceMessage = {
  id: string;
  type: "trace";
  steps: BrainstormStep[];
  status: "streaming" | "done";
  totalDurationSec?: number;
  collapsed: boolean;
};

export type Message = ChatMessage | TraceMessage;

export type ApiMessageRow = {
  id: string;
  role: string;
  content: string;
  duration_sec?: number | null;
  model_name?: string | null;
};

export type GenerationState = "idle" | "waiting" | "thinking" | "tool" | "typing";

export type ServerConversation = {
  id: string;
  title: string;
  created_at?: string;
};
