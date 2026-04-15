"""MCP 服务管理路由。"""

from fastapi import APIRouter, Depends

from app.mcp.schemas import (
    McpServerCreateRequest,
    McpServerListResponse,
    McpServerResponse,
)
from app.mcp.service import McpService

router = APIRouter(prefix="/api/mcp", tags=["mcp"])


def _svc() -> McpService:
    return McpService()


@router.get("", response_model=McpServerListResponse, summary="列出已注册 MCP 服务")
def list_servers(svc: McpService = Depends(_svc)):
    return svc.list_servers()


@router.post("", response_model=McpServerResponse, summary="注册 MCP 服务")
async def register_server(
    req: McpServerCreateRequest, svc: McpService = Depends(_svc)
):
    return await svc.register_server(req)


@router.get("/{server_id}", response_model=McpServerResponse, summary="获取 MCP 服务详情")
def get_server(server_id: str, svc: McpService = Depends(_svc)):
    return svc.get_server(server_id)


@router.post(
    "/{server_id}/refresh",
    response_model=McpServerResponse,
    summary="重新发现工具列表",
)
async def refresh_tools(server_id: str, svc: McpService = Depends(_svc)):
    return await svc.refresh_tools(server_id)


@router.delete("/{server_id}", status_code=204, summary="删除 MCP 服务")
def delete_server(server_id: str, svc: McpService = Depends(_svc)):
    svc.delete_server(server_id)
