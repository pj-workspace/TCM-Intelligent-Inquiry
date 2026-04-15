"""MCP 服务管理：注册、发现工具、动态挂载到 Agent 工具集（持久化 PostgreSQL）。"""

import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import NotFoundError
from app.core.logging import get_logger
from app.mcp.client import discover_tools
from app.mcp.models import McpServerRecord
from app.mcp.schemas import (
    McpServerCreateRequest,
    McpServerListResponse,
    McpServerResponse,
)
from app.mcp.tool_bridge import register_mcp_tools_for_server, unregister_mcp_tools_for_server

logger = get_logger(__name__)


def _to_response(row: McpServerRecord) -> McpServerResponse:
    names = row.tool_names if isinstance(row.tool_names, list) else []
    return McpServerResponse(
        id=row.id,
        name=row.name,
        url=row.url,
        description=row.description or "",
        enabled=row.enabled,
        tool_names=[str(x) for x in names],
    )


class McpService:
    def __init__(self, session: AsyncSession):
        self._session = session

    async def list_servers(self) -> McpServerListResponse:
        r = await self._session.execute(select(McpServerRecord).order_by(McpServerRecord.name))
        rows = r.scalars().all()
        return McpServerListResponse(
            servers=[_to_response(x) for x in rows], total=len(rows)
        )

    async def get_server(self, server_id: str) -> McpServerResponse:
        row = await self._session.get(McpServerRecord, server_id)
        if row is None:
            raise NotFoundError(f"MCP 服务 '{server_id}' 不存在")
        return _to_response(row)

    async def register_server(self, req: McpServerCreateRequest) -> McpServerResponse:
        """注册 MCP 服务并自动发现其工具列表；启用时挂入 LangChain 工具注册表。"""
        tool_names = await discover_tools(req.url)
        server_id = str(uuid.uuid4())
        row = McpServerRecord(
            id=server_id,
            name=req.name,
            url=req.url.rstrip("/"),
            description=req.description or "",
            enabled=req.enabled,
            tool_names=tool_names,
        )
        self._session.add(row)
        await self._session.flush()
        if req.enabled and tool_names:
            register_mcp_tools_for_server(
                server_id,
                req.name,
                row.url,
                tool_names,
            )
        logger.info(
            "注册 MCP 服务 id=%s name=%s tools=%s langchain=%s",
            server_id,
            req.name,
            tool_names,
            req.enabled,
        )
        return _to_response(row)

    async def delete_server(self, server_id: str) -> None:
        row = await self._session.get(McpServerRecord, server_id)
        if row is None:
            raise NotFoundError(f"MCP 服务 '{server_id}' 不存在")
        unregister_mcp_tools_for_server(server_id)
        await self._session.delete(row)
        logger.info("删除 MCP 服务 id=%s", server_id)

    async def refresh_tools(self, server_id: str) -> McpServerResponse:
        """重新发现指定 MCP 服务的工具列表并同步 LangChain 工具注册。"""
        row = await self._session.get(McpServerRecord, server_id)
        if row is None:
            raise NotFoundError(f"MCP 服务 '{server_id}' 不存在")
        tool_names = await discover_tools(row.url)
        row.tool_names = tool_names
        await self._session.flush()
        register_mcp_tools_for_server(
            server_id,
            row.name,
            row.url,
            tool_names if row.enabled else [],
        )
        logger.info("刷新 MCP 工具 id=%s tools=%s", server_id, tool_names)
        return _to_response(row)


async def restore_mcp_tool_registrations(session: AsyncSession) -> None:
    """应用启动时从数据库恢复已启用 MCP 的 LangChain 工具挂载。"""
    r = await session.execute(select(McpServerRecord))
    rows = r.scalars().all()
    for row in rows:
        if not row.enabled:
            continue
        tool_names = row.tool_names if isinstance(row.tool_names, list) else []
        if not tool_names:
            try:
                tool_names = await discover_tools(row.url)
                row.tool_names = tool_names
            except Exception as exc:
                logger.warning(
                    "启动时未能为 MCP id=%s 发现工具，跳过挂载: %s",
                    row.id,
                    exc,
                )
                continue
        if tool_names:
            register_mcp_tools_for_server(
                row.id,
                row.name,
                row.url,
                tool_names,
            )
            logger.info(
                "启动恢复 MCP 工具 id=%s name=%s tools=%s",
                row.id,
                row.name,
                len(tool_names),
            )
