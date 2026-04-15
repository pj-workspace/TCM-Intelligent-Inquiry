"""方剂查询工具：PostgreSQL 结构化库，支持方名检索与症状/证型推荐。"""

from langchain_core.tools import tool

from app.agent.tools.registry import tool_registry
from app.core.database import async_session_factory
from app.agent.tools.formula.service import (
    lookup_formula_by_name,
    recommend_formulas_for_clinical,
)


@tool_registry.register
@tool
async def formula_lookup(formula_name: str) -> str:
    """根据方剂名称查询组成、功效、主治与常见证型标签。

    支持标准名或常见别名中的模糊匹配；若多条命中会列出若干条供核对。
    """
    q = (formula_name or "").strip()
    if not q:
        return "请提供方剂名称。"

    async with async_session_factory() as session:
        out = await lookup_formula_by_name(session, q)
    return out


@tool_registry.register
@tool
async def recommend_formulas(
    clinical_query: str,
    pattern_type: str | None = None,
    top_k: int = 5,
) -> str:
    """依据症状、体征或患者主诉，从本地方剂库推荐可能相关的经典方剂（学习参考）。

    参数：
    - clinical_query: 症状与体征描述（可含起病、寒热、饮食、二便、疼痛部位等）。
    - pattern_type: 可选，辨证线索或证型提示，如「肝郁脾虚」「少阳证」「脾胃虚寒」等。
    - top_k: 返回条数，默认 5，最大约 15。

    注意：结果为文献与教材常见方的检索式推荐，不能替代执业医师面诊处方。
    """
    try:
        k = int(top_k)
    except (TypeError, ValueError):
        k = 5

    async with async_session_factory() as session:
        out = await recommend_formulas_for_clinical(session, clinical_query, pattern_type, k)
    return out
