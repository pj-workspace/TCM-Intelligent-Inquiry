"""自托管 SearXNG 公网检索工具。

扩展时可增加 `formatting.py`（结果展示）、`run.py`（HTTP 编排）等模块；`plugin.py` 只做 LangChain 注册。
"""

from app.agent.tools.searx_web_search import plugin as _plugin  # noqa: F401
from app.agent.tools.searx_web_search.formatting import format_searx_results_for_llm
from app.agent.tools.searx_web_search.run import run_searx_web_search

__all__ = [
    "format_searx_results_for_llm",
    "run_searx_web_search",
]
