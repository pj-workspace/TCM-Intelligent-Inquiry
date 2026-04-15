"""方剂查询工具（骨架，待接入方剂数据库）。"""

from langchain_core.tools import tool

from app.agent.tools.registry import tool_registry


@tool_registry.register
@tool
def formula_lookup(formula_name: str) -> str:
    """根据方剂名称查询组成、功效与主治。

    当前为骨架，后续接入结构化方剂数据库或向量检索。
    """
    return f"（骨架）方剂「{formula_name}」的信息尚未导入，请在 knowledge 域接入数据源后启用。"
