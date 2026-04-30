import type { BrainstormStep } from "@/types/brainstorm";

export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  type: "message";
  content: string;
  /** 用户消息：多模态 OSS 签名 URL（仅内存与当前会话渲染；过期后历史图可能打不开） */
  imageUrls?: string[];
  /** 助手消息：来自 SSE meta.chatModel */
  modelName?: string;
  /** 助手消息：后端持久化的快速追问话术 */
  followUpSuggestions?: string[];
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
  follow_up_suggestions?: string[] | null;
};

export type GenerationState = "idle" | "waiting" | "thinking" | "tool" | "typing";

export type ServerConversation = {
  id: string;
  title: string;
  created_at?: string;
  /** 服务端分组 id；无则会话在「聊天」未分组 */
  group_id?: string | null;
};

/** 服务端返回的会话文件夹 */
export type ConversationFolder = {
  id: string;
  name: string;
  sort_order: number;
  created_at?: string;
};
