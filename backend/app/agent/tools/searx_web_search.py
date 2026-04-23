"""通过自托管 SearXNG 的 JSON API 做公网检索摘要（与知识库 RAG 互补）。"""

from __future__ import annotations

import json
from typing import Any

import httpx
from langchain_core.tools import tool

from app.agent.tools.registry import tool_registry
from app.core.config import get_settings
from app.core.logging import get_logger

logger = get_logger(__name__)


def format_searx_results_for_llm(payload: dict[str, Any], max_results: int) -> str:
    """将 SearXNG JSON 中的 results 转为模型可读文本（单测可直调）。"""
    rows = payload.get("results")
    if not isinstance(rows, list) or not rows:
        return "SearXNG 未返回任何结果条目（results 为空）。"

    lines: list[str] = []
    n_shown = 0
    for item in rows[:max_results]:
        if not isinstance(item, dict):
            continue
        n_shown += 1
        title = str(item.get("title", "")).strip() or "(无标题)"
        url = str(item.get("url", "")).strip()
        content = str(item.get("content", "")).strip()
        eng = str(item.get("engine", "")).strip()
        meta = f" [{eng}]" if eng else ""
        chunk = f"[{n_shown}]{meta} {title}\n{url}\n{content}"
        lines.append(chunk.strip())
    if not lines:
        return "SearXNG 返回的结果格式异常，无法解析。"
    return "\n\n".join(lines)


async def run_searx_web_search(
    query: str,
    *,
    max_results: int = 5,
    language: str = "zh",
) -> str:
    """执行 SearXNG 检索并返回可给模型阅读的纯文本（供测试与工具共用）。"""
    q = (query or "").strip()
    if not q:
        return "请提供非空的检索关键词。"

    s = get_settings()
    base = (s.searxng_url or "").strip().rstrip("/")
    if not base:
        return "未配置 SEARXNG_URL：请在环境中设置 SearXNG 根地址，或启动 docker compose 中的 searxng 服务。"

    try:
        n = max(1, min(int(max_results), 15))
    except (TypeError, ValueError):
        n = 5

    lang = (language or "zh").strip() or "zh"
    params = {"q": q, "format": "json", "language": lang}
    timeout = httpx.Timeout(s.searxng_timeout_seconds)

    try:
        async with httpx.AsyncClient(timeout=timeout, follow_redirects=True) as client:
            r = await client.get(f"{base}/search", params=params)
    except httpx.HTTPError as exc:
        logger.warning("SearXNG 请求失败: %s", exc)
        return (
            f"无法连接 SearXNG（{base}）：{exc}。"
            "请确认已执行 `docker compose up -d searxng` 且端口与 SEARXNG_URL 一致。"
        )

    if r.status_code == 403:
        return (
            "SearXNG 拒绝了 JSON 格式请求（403）。"
            "请确认实例 settings.yml 中 search.formats 包含 json（见项目 docker/searxng/settings.yml）。"
        )
    if r.status_code != 200:
        return f"SearXNG 返回 HTTP {r.status_code}，无法完成检索。"

    try:
        payload = r.json()
    except json.JSONDecodeError:
        return "SearXNG 响应不是合法 JSON，无法解析。"

    if not isinstance(payload, dict):
        return "SearXNG JSON 结构异常。"

    return format_searx_results_for_llm(payload, n)


@tool_registry.register
@tool
async def searx_web_search(query: str, max_results: int = 5, language: str = "zh") -> str:
    """使用自托管 SearXNG 检索公网网页摘要（元搜索，非中医知识库）。

    参数：
    - query: 检索关键词或短语。
    - max_results: 返回条数上限，默认 5，最大 15。
    - language: 搜索语言偏好（如 zh、en），默认 zh。
    """
    return await run_searx_web_search(query, max_results=max_results, language=language)
