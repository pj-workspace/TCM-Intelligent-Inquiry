from datetime import datetime
from typing import Literal, Self

from pydantic import BaseModel, Field, model_validator


class ChatMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(..., min_length=1)


class ConversationTitleUpdate(BaseModel):
    title: str = Field(..., min_length=1, max_length=512)


class ChatRequest(BaseModel):
    message: str = Field(default="", description="本轮用户输入；可与图片 URL 同时使用")
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
    chat_model: str | None = Field(
        default=None,
        description="仅 llm_provider=qwen 且配置了 QWEN_CHAT_MODEL_OPTIONS 时有效；DashScope model id。",
    )
    image_urls: list[str] = Field(
        default_factory=list,
        description="图片 URL（通常由 OSS 上传接口返回的签名 HTTPS 地址）；与 message 拼接为多模态用户消息。"
        "VL 模型要求每张图宽高均须大于 10px；须经上传校验通过，否则易被模型以 400 拒绝。",
    )

    @model_validator(mode="after")
    def _validate_message_and_images(self) -> Self:
        msg = self.message.strip()
        cleaned: list[str] = []
        for u in self.image_urls:
            if not isinstance(u, str):
                continue
            t = u.strip()
            if not t:
                continue
            if len(t) > 4096:
                raise ValueError("单张图片 URL 过长（最多 4096 字符）")
            if not (t.startswith("https://") or t.startswith("http://")):
                raise ValueError("image_urls 中的每一项须为 http(s) URL")
            cleaned.append(t)
        if len(cleaned) > 8:
            raise ValueError("本轮最多附带 8 张图片")
        if not msg and not cleaned:
            raise ValueError("请输入文字或上传图片")
        self.message = msg
        self.image_urls = cleaned
        return self


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
