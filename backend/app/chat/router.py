"""对话路由。

路由层只负责：解析请求 → 调 service → 返回响应，不含业务逻辑。
"""

from fastapi import APIRouter
from fastapi.responses import StreamingResponse

from app.chat.schemas import ChatRequest
from app.chat.service import stream_chat

router = APIRouter(prefix="/api/chat", tags=["chat"])


@router.post("", summary="流式对话（SSE）")
async def chat(req: ChatRequest):
    return StreamingResponse(
        stream_chat(req.message, req.history, req.agent_id),
        media_type="text/event-stream",
    )
