"""SearXNG `tool` 注册。"""

from langchain_core.tools import tool

from app.agent.tools.registry import tool_registry
from app.agent.tools.searx_web_search.run import run_searx_web_search


@tool_registry.register
@tool
async def searx_web_search(query: str, max_results: int = 10, language: str = "zh") -> str:
    """使用自托管 SearXNG 检索公网网页摘要（元搜索，非中医知识库）。

    参数：
    - query: 检索关键词或短语。
    - max_results: 返回条数上限，默认 10，最大 20。
    - language: 搜索语言偏好（如 zh、en），默认 zh；为中文时请求会优先使用 SearXNG 的百度引擎（须在 settings 中启用）。
    """
    return await run_searx_web_search(query, max_results=max_results, language=language)
