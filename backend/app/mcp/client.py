"""MCP 客户端：可达性探测 + 占位工具发现。

完整 MCP 协议（stdio / streamable HTTP）需接入 `mcp` SDK；此处先保证 URL 可访问并记录状态。
"""

import httpx

from app.core.logging import get_logger

logger = get_logger(__name__)


async def probe_server_reachable(server_url: str) -> bool:
    """HEAD/GET 根路径，判断服务是否在线。"""
    base = server_url.rstrip("/")
    timeout = httpx.Timeout(5.0)
    async with httpx.AsyncClient(timeout=timeout, follow_redirects=True) as client:
        for method, path in (("HEAD", ""), ("GET", "/"), ("GET", "/health")):
            try:
                url = f"{base}{path}" if path else base
                if method == "HEAD":
                    r = await client.head(url)
                else:
                    r = await client.get(url)
                if r.status_code < 500:
                    return True
            except httpx.HTTPError as exc:
                logger.debug("MCP probe %s %s: %s", method, url, exc)
    return False


async def discover_tools(server_url: str) -> list[str]:
    """连接 MCP 服务，发现其暴露的工具列表。

    若服务 HTTP 可达但无标准工具清单接口，返回占位项便于前端展示。
    """
    ok = await probe_server_reachable(server_url)
    if not ok:
        logger.warning("MCP 服务不可达: %s", server_url)
        return []
    logger.info("MCP 服务可达（尚未解析工具清单）: %s", server_url)
    # 后续可在此接入 MCP Python SDK 的 list_tools
    return ["_server_reachable"]


async def call_tool(server_url: str, tool_name: str, arguments: dict) -> str:
    """调用 MCP 服务上的指定工具（占位）。"""
    logger.info("MCP call_tool url=%s tool=%s args=%s", server_url, tool_name, arguments)
    return (
        f"（占位）MCP 工具调用尚未接入协议层；服务器: {server_url}，工具: {tool_name}。"
        "请安装 `mcp` 包并实现 streamable HTTP / stdio 客户端。"
    )
