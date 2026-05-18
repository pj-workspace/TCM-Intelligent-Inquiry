/** GET /api/chat/billing/usage-summary */

export type BillingPeriodOut = {
  start: string;
  end: string;
};

export type BillingTotalsOut = {
  requests: number;
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
};

export type BillingProviderBreakdownRow = {
  provider_id: string;
  requests: number;
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
};

export type UsageSummaryResponse = {
  period: BillingPeriodOut;
  totals: BillingTotalsOut;
  by_provider: BillingProviderBreakdownRow[];
};

/** GET /api/chat/conversations/{id}/billing/usage-summary */

export type ConversationBillingTotalsResponse = {
  totals: BillingTotalsOut;
};

/** GET /api/chat/billing/usage-events */

export type UsageEventItemOut = {
  usage_event_id: string;
  created_at: string;
  provider_id: string;
  chat_model: string | null;
  conversation_id: string | null;
  prompt_tokens: number | null;
  completion_tokens: number | null;
  total_tokens: number | null;
};

export type UsageEventsResponse = {
  items: UsageEventItemOut[];
  limit: number;
  offset: number;
};

/** GET /api/chat/providers/{id}/balance */

export type BalanceLineItem = {
  currency: string;
  total_balance: string;
  granted_balance: string;
  topped_up_balance: string;
};

export type BalanceSnapshotJson = {
  provider_id: string;
  is_available: boolean | null;
  balances: BalanceLineItem[];
  raw: Record<string, unknown>;
};

/** SSE `type: "llm-usage"` 内嵌 normalize_llm_usage 输出 */

export type NormalizedLlmUsage = {
  provider_id?: string;
  prompt_tokens?: number;
  input_tokens?: number;
  completion_tokens?: number;
  output_tokens?: number;
  total_tokens?: number;
  reasoning_tokens?: number;
  cached_prompt_tokens?: number;
  prompt_cache_miss_tokens?: number;
};
