"""Agent 管理路由。

提供 Agent 的增删查接口，以及可用工具列表查询。
"""

from fastapi import APIRouter, Depends

from app.agent.schemas import AgentCreateRequest, AgentListResponse, AgentResponse
from app.agent.service import AgentService

router = APIRouter(prefix="/api/agents", tags=["agents"])


def _svc() -> AgentService:
    return AgentService()


@router.get("", response_model=AgentListResponse, summary="列出所有 Agent")
def list_agents(svc: AgentService = Depends(_svc)):
    return svc.list_agents()


@router.post("", response_model=AgentResponse, summary="创建 Agent")
def create_agent(req: AgentCreateRequest, svc: AgentService = Depends(_svc)):
    return svc.create_agent(req)


@router.get("/tools", summary="列出所有可用工具")
def list_tools(svc: AgentService = Depends(_svc)):
    return {"tools": svc.list_available_tools()}


@router.get("/{agent_id}", response_model=AgentResponse, summary="获取 Agent 详情")
def get_agent(agent_id: str, svc: AgentService = Depends(_svc)):
    return svc.get_agent(agent_id)


@router.delete("/{agent_id}", status_code=204, summary="删除 Agent")
def delete_agent(agent_id: str, svc: AgentService = Depends(_svc)):
    svc.delete_agent(agent_id)
