"""Agent 管理 API 的请求/响应模型。"""

from pydantic import BaseModel, Field


class AgentCreateRequest(BaseModel):
    name: str = Field(..., min_length=1, description="Agent 名称")
    description: str = Field(default="", description="Agent 用途说明")
    system_prompt: str = Field(default="", description="自定义系统提示（空则使用默认）")
    tool_names: list[str] = Field(default_factory=list, description="启用的工具名列表")
    default_kb_id: str | None = Field(
        default=None, description="默认知识库 ID（search_tcm_knowledge 未传 kb_id 时使用）"
    )


class AgentUpdateRequest(BaseModel):
    """部分更新：至少提供一项；未出现的字段保持不变。"""

    name: str | None = Field(default=None, min_length=1, description="Agent 名称")
    description: str | None = None
    system_prompt: str | None = None
    tool_names: list[str] | None = None
    default_kb_id: str | None = None


class AgentResponse(BaseModel):
    id: str
    name: str
    description: str
    tool_names: list[str]
    system_prompt: str = ""
    default_kb_id: str | None = None


class AgentListResponse(BaseModel):
    agents: list[AgentResponse]
    total: int
