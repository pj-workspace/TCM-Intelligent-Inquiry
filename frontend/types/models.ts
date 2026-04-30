/** 与 GET /api/chat/model-options 单项对齐 */

export type ModelCapabilities = {
  input?: string[];
  supports_tool_calling?: boolean;
  supports_deep_think?: boolean;
  vendor_native_online_search?: boolean;
  [key: string]: unknown;
};

export type ModelOption = {
  id: string;
  label: string;
  default?: boolean;
  capabilities: ModelCapabilities;
};
