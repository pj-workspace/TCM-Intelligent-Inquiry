"""将远端 MCP 工具包装为 LangChain BaseTool，挂入全局 tool_registry。"""

from __future__ import annotations

import re
from typing import Any

from langchain_core.tools import StructuredTool
from pydantic import BaseModel, Field

from app.core.logging import get_logger
from app.mcp.client import call_tool

logger = get_logger(__name__)

# server_id -> 已注册到 LangChain 的工具名（用于删除/刷新时卸载）
_mcp_registered_lc_names: dict[str, list[str]] = {}


def _sanitize_segment(name: str, max_len: int = 40) -> str:
    s = re.sub(r"[^a-zA-Z0-9_-]+", "_", (name or "").strip())
    s = s.strip("_") or "tool"
    return s[:max_len]


def make_lc_tool_name(server_id: str, remote_tool_name: str) -> str:
    """生成全局唯一的 LangChain 工具名（前缀 mcp_）。"""
    sid = server_id.replace("-", "")[:8]
    return f"mcp_{sid}_{_sanitize_segment(remote_tool_name)}"


def _unique_lc_name(base: str, taken: set[str]) -> str:
    name = base
    n = 2
    while name in taken:
        name = f"{base}_{n}"
        n += 1
    return name


class McpProxyArgs(BaseModel):
    arguments: dict[str, Any] = Field(
        default_factory=dict,
        description="传给 MCP 工具的参数字典；无参数时传空对象 {}。",
    )


def _build_structured_tool(
    *,
    lc_name: str,
    server_display_name: str,
    server_url: str,
    remote_tool_name: str,
) -> StructuredTool:
    desc = (
        f"[MCP] 服务「{server_display_name}」提供的工具，远端名 `{remote_tool_name}`。"
        "（服务端点已在系统中登记，不在此展示完整 URL。）"
    )

    async def _acall(arguments: dict[str, Any] | None = None) -> str:
        args = dict(arguments or {})
        return await call_tool(server_url, remote_tool_name, args)

    def _sync_stub(arguments: dict[str, Any] | None = None) -> str:
        raise RuntimeError("MCP 工具仅支持异步调用")

    return StructuredTool.from_function(
        name=lc_name,
        description=desc,
        func=_sync_stub,
        coroutine=_acall,
        args_schema=McpProxyArgs,
    )


def register_mcp_tools_for_server(
    server_id: str,
    server_display_name: str,
    server_url: str,
    remote_tool_names: list[str],
) -> list[str]:
    """把远端工具名注册为 LangChain 工具，返回实际注册的 lc 工具名列表。"""
    from app.agent.tools.registry import tool_registry

    unregister_mcp_tools_for_server(server_id)

    taken = set(tool_registry.names())
    registered: list[str] = []
    for remote in remote_tool_names:
        if not (remote or "").strip():
            continue
        base = make_lc_tool_name(server_id, remote)
        lc_name = _unique_lc_name(base, taken)
        taken.add(lc_name)
        tool = _build_structured_tool(
            lc_name=lc_name,
            server_display_name=server_display_name,
            server_url=server_url.rstrip("/"),
            remote_tool_name=remote.strip(),
        )
        tool_registry.register(tool)
        registered.append(lc_name)
        logger.info("已注册 MCP LangChain 工具 name=%s remote=%s", lc_name, remote)

    _mcp_registered_lc_names[server_id] = registered
    from app.agent.executor import invalidate_default_graph_cache

    invalidate_default_graph_cache()
    return registered


def unregister_mcp_tools_for_server(server_id: str) -> None:
    """从 tool_registry 移除该 MCP 服务对应的 LangChain 工具。"""
    from app.agent.executor import invalidate_default_graph_cache
    from app.agent.tools.registry import tool_registry

    names = _mcp_registered_lc_names.pop(server_id, [])
    for n in names:
        tool_registry.unregister(n)
        logger.info("已卸载 MCP LangChain 工具 name=%s", n)
    if names:
        invalidate_default_graph_cache()


def get_registered_lc_names(server_id: str) -> list[str]:
    return list(_mcp_registered_lc_names.get(server_id, []))
