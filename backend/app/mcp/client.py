"""MCP 客户端连接管理（骨架）。

MCP（Model Context Protocol）是 Anthropic 提出的工具协议标准，
允许 Agent 通过统一接口调用外部工具服务。

骨架阶段：模拟工具发现，不建立真实连接。
接入真实 MCP 时可使用 `mcp` Python SDK（pip install mcp）。
"""

from app.core.logging import get_logger

logger = get_logger(__name__)


async def discover_tools(server_url: str) -> list[str]:
    """连接 MCP 服务，发现其暴露的工具列表。

    骨架实现：返回空列表，后续替换为真实 MCP 握手。
    """
    logger.info("MCP discover_tools url=%s (骨架，未实际连接)", server_url)
    return []


async def call_tool(server_url: str, tool_name: str, arguments: dict) -> str:
    """调用 MCP 服务上的指定工具。

    骨架实现：返回提示字符串。
    """
    logger.info("MCP call_tool url=%s tool=%s (骨架)", server_url, tool_name)
    return f"（骨架）MCP 工具 '{tool_name}' 尚未接入真实服务。"
