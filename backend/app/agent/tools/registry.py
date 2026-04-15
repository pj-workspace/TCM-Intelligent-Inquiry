"""工具注册表：统一管理所有 Agent 可用工具。

使用方式：
  from app.agent.tools.registry import tool_registry
  tool_registry.register(my_tool)
  tools = tool_registry.get(["search_tcm_knowledge", "formula_lookup"])
"""

from langchain_core.tools import BaseTool


class ToolRegistry:
    def __init__(self) -> None:
        self._tools: dict[str, BaseTool] = {}

    def register(self, tool: BaseTool) -> BaseTool:
        self._tools[tool.name] = tool
        return tool

    def unregister(self, name: str) -> None:
        self._tools.pop(name, None)

    def get(self, names: list[str]) -> list[BaseTool]:
        return [self._tools[n] for n in names if n in self._tools]

    def all(self) -> list[BaseTool]:
        return list(self._tools.values())

    def names(self) -> list[str]:
        return list(self._tools.keys())


tool_registry = ToolRegistry()
