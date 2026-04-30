"""中医知识库向量检索工具。

实现见 `plugin`；导入本子包会通过副作用完成 `tool_registry` 注册。
"""

from app.agent.tools.tcm_search import plugin as _plugin  # noqa: F401

__all__: list[str] = []
