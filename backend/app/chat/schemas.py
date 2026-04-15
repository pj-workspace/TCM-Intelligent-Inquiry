from typing import Literal

from pydantic import BaseModel, Field


class ChatMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(..., min_length=1)


class ChatRequest(BaseModel):
    message: str = Field(..., min_length=1, description="本轮用户输入")
    history: list[ChatMessage] = Field(
        default_factory=list, description="此前的多轮对话，按时间顺序"
    )
    agent_id: str | None = Field(
        default=None, description="指定使用的 Agent ID（None 时用默认 Agent）"
    )
