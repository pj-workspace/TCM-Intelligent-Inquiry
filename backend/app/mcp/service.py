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
        """注册 MCP 服务并自动发现其工具列表。"""
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
        logger.info("注册 MCP 服务 id=%s name=%s tools=%s", server_id, req.name, tool_names)
        return resp

    def delete_server(self, server_id: str) -> None:
        if server_id not in _store:
            raise NotFoundError(f"MCP 服务 '{server_id}' 不存在")
        del _store[server_id]
        logger.info("删除 MCP 服务 id=%s", server_id)

    async def refresh_tools(self, server_id: str) -> McpServerResponse:
        """重新发现指定 MCP 服务的工具列表。"""
        server = self.get_server(server_id)
        tool_names = await discover_tools(server.url)
        server.tool_names = tool_names
        _store[server_id] = server
        return server
