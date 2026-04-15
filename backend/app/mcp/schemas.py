"""MCP（Model Context Protocol）集成 API 的请求/响应模型。"""

from pydantic import BaseModel, Field


class McpServerCreateRequest(BaseModel):
    name: str = Field(..., min_length=1, description="MCP 服务名称")
    url: str = Field(..., description="MCP 服务端点 URL（如 http://localhost:3100）")
    description: str = Field(default="", description="服务说明")
    enabled: bool = Field(default=True, description="是否启用")


class McpServerResponse(BaseModel):
    id: str
    name: str
    url: str
    description: str
    enabled: bool
    tool_names: list[str] = Field(default_factory=list, description="已发现的工具列表")


class McpServerListResponse(BaseModel):
    servers: list[McpServerResponse]
    total: int
