"""方剂名称检索与症状推荐工具。

底层数据与服务在并列包 `formula`；本子包只做 LangChain `tool` 注册。
"""

from app.agent.tools.formula_lookup import plugin as _plugin  # noqa: F401

__all__: list[str] = []
