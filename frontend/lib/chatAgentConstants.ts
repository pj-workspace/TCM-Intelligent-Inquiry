/** 无自定义 Agent 或 omit agent_id 时，与后端内置默认图对应的展示文案 */
export const SYSTEM_AGENT_LABEL = "系统默认";

/** Select / 下拉：系统默认项的 value（非真实 UUID） */
export const SYSTEM_AGENT_SELECT_VALUE = "__system_default__";

export function isSystemAgentSelectValue(value: string): boolean {
  return value === SYSTEM_AGENT_SELECT_VALUE;
}

/** 侧栏 / 列表：根据会话 agent_id 与接口 agent_name 得到展示名 */
export function formatConversationAgentDisplay(
  agentId: string | null | undefined,
  agentName: string | null | undefined,
): string {
  const id = agentId?.trim();
  if (!id) return SYSTEM_AGENT_LABEL;
  const name = agentName?.trim();
  if (name) return name;
  return "Agent 已删除";
}
