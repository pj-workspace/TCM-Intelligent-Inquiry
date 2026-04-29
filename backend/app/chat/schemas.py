from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


class ChatMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(..., min_length=1)


class ConversationTitleUpdate(BaseModel):
    title: str = Field(..., min_length=1, max_length=512)


class ChatRequest(BaseModel):
    message: str = Field(..., min_length=1, description="本轮用户输入")
    history: list[ChatMessage] = Field(
        default_factory=list,
        description="仅在新会话首轮有效：客户端维护的历史；传入 conversation_id 后服务端以数据库为准",
    )
    conversation_id: str | None = Field(
        default=None, description="已有会话 ID；不传则创建新会话并在首包 meta 中返回",
    )
    agent_id: str | None = Field(
        default=None, description="指定使用的 Agent ID（None 时用默认 Agent）"
    )
    anon_session_secret: str | None = Field(
        default=None,
        description="匿名会话凭证，与首包 meta.anonSessionSecret 一致；续聊与登录用户会话无关",
    )
    regenerate_last_reply: bool = Field(
        default=False,
        description="为 True 时需带 conversation_id：删除该会话最后一条用户消息之后的 thinking/assistant，"
        "不重复写入用户消息，用于「重新生成」上一轮助手回复。",
    )
    deep_think: bool = Field(
        default=False,
        description="为 True 时在系统提示中追加「深度思考」指令：逐步推理；若模型支持思考通道则展示推理过程。",
    )
    web_search_enabled: bool = Field(
        default=False,
        description="为 True 时在系统提示中追加联网检索（searx_web_search）策略说明。",
    )
    web_search_mode: Literal["force", "auto"] = Field(
        default="force",
        description="在 web_search_enabled 时生效：force=必须调用联网搜索；auto=由模型判断是否需要搜网。",
    )
    group_id: str | None = Field(
        default=None,
        description="仅在新建会话（未传 conversation_id）时生效：将把会话归入该分组，须为当前用户的分组 ID。",
    )


class ConversationItem(BaseModel):
    id: str
    title: str
    agent_id: str | None = None
    created_at: datetime
    group_id: str | None = None


class ConversationGroupItem(BaseModel):
    id: str
    name: str
    sort_order: int
    created_at: datetime


class ConversationGroupCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=128)


class ConversationGroupRename(BaseModel):
    name: str = Field(..., min_length=1, max_length=128)


class ConversationGroupAssign(BaseModel):
    group_id: str | None = Field(None, description="不传或 null 表示移出分组")


class MessageItem(BaseModel):
    id: str
    role: str
    content: str
    created_at: datetime
    duration_sec: float | None = None
    model_name: str | None = None
