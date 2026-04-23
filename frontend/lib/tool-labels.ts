export const TOOL_LABEL_ZH: Record<string, string> = {
  search_tcm_knowledge: "知识库检索",
  formula_lookup: "方剂查询",
  recommend_formulas: "方剂推荐",
  searx_web_search: "联网搜索",
};

/** 工具名展示为中文；MCP / 未知名保留可读降级 */
export function displayToolNameZh(internalName: string): string {
  const n = internalName.trim();
  if (!n) return "工具";
  if (TOOL_LABEL_ZH[n]) return TOOL_LABEL_ZH[n];
  if (n.startsWith("mcp_")) {
    const rest = n.slice(4).replace(/_/g, " ");
    return `外部工具：${rest}`;
  }
  return n;
}
