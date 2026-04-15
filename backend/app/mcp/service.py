"""MCP 服务管理：注册、发现工具、动态挂载到 Agent 工具集。"""

import uuid

from app.core.exceptions import NotFoundError
from app.core.logging import get_logger
from app.mcp.client import discover_tools
from app.mcp.schemas import (
    McpServerCreateRequest,
    McpServerListResponse,
    McpServerResponse,
)
from app.mcp.tool_bridge import register_mcp_tools_for_server, unregister_mcp_tools_for_server

logger = get_logger(__name__)

_store: dict[str, McpServerResponse] = {}


class McpService:
    def list_servers(self) -> McpServerListResponse:
        servers = list(_store.values())
        return McpServerListResponse(servers=servers, total=len(servers))

    def get_server(self, server_id: str) -> McpServerResponse:
        if server_id not in _store:
            raise NotFoundError(f"MCP 服务 '{server_id}' 不存在")
        return _store[server_id]

    async def register_server(self, req: McpServerCreateRequest) -> McpServerResponse:
        """注册 MCP 服务并自动发现其工具列表；启用时挂入 LangChain 工具注册表。"""
        tool_names = await discover_tools(req.url)
        server_id = str(uuid.uuid4())
        resp = McpServerResponse(
            id=server_id,
            name=req.name,
            url=req.url,
            description=req.description,
            enabled=req.enabled,
            tool_names=tool_names,
        )
        _store[server_id] = resp
        if req.enabled and tool_names:
            register_mcp_tools_for_server(
                server_id,
                req.name,
                req.url,
                tool_names,
            )
        logger.info(
            "注册 MCP 服务 id=%s name=%s tools=%s langchain=%s",
            server_id,
            req.name,
            tool_names,
            req.enabled,
        )
        return resp

    def delete_server(self, server_id: str) -> None:
        if server_id not in _store:
            raise NotFoundError(f"MCP 服务 '{server_id}' 不存在")
        unregister_mcp_tools_for_server(server_id)
        del _store[server_id]
        logger.info("删除 MCP 服务 id=%s", server_id)

    async def refresh_tools(self, server_id: str) -> McpServerResponse:
        """重新发现指定 MCP 服务的工具列表并同步 LangChain 工具注册。"""
        server = self.get_server(server_id)
        tool_names = await discover_tools(server.url)
        server.tool_names = tool_names
        _store[server_id] = server
        register_mcp_tools_for_server(
            server_id,
            server.name,
            server.url,
            tool_names if server.enabled else [],
        )
        logger.info("刷新 MCP 工具 id=%s tools=%s", server_id, tool_names)
        return server
