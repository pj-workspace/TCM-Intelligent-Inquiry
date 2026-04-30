"""对话与会话路由。"""

from typing import Annotated

from fastapi import APIRouter, Depends, Header, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.api.deps import get_current_user, get_current_user_optional
from app.auth.models import UserRecord
from app.chat.policy.access import assert_can_use_conversation
from app.chat.policy.turns import resolve_chat_turn
from app.chat.schemas import (
    AttachmentSuggestionItem,
    AttachmentSuggestionsRequest,
    AttachmentSuggestionsResponse,
    ChatRequest,
    ConversationGroupAssign,
    ConversationGroupCreate,
    ConversationGroupItem,
    ConversationGroupRename,
    ConversationItem,
    ConversationTitleUpdate,
    FollowUpSuggestionsRequest,
    FollowUpSuggestionsResponse,
    MessageItem,
)
from app.chat.services.groups import (
    create_group,
    delete_group,
    list_groups,
    rename_group,
    update_conversation_group,
)
from app.chat.services.history import (
    delete_conversation,
    list_messages_for_conversation,
    list_my_conversations,
    persist_follow_up_suggestions_for_assistant_message,
    update_conversation_title,
)
from app.chat.services.streaming import stream_chat
from app.chat.suggestions.attachments import generate_attachment_suggestions
from app.chat.suggestions.follow_up import generate_follow_up_suggestions
from app.core.database import async_session_factory, get_session

router = APIRouter(prefix="/api/chat", tags=["chat"])


@router.post("", summary="流式对话（SSE），支持会话持久化")
async def chat(
    req: ChatRequest,
    user: Annotated[UserRecord | None, Depends(get_current_user_optional)],
):
    if req.conversation_id:
        async with async_session_factory() as session:
            await assert_can_use_conversation(
                session,
                req.conversation_id,
                user,
                req.anon_session_secret,
            )
            await session.commit()

    try:
        resolved = resolve_chat_turn(
            chat_model_body=req.chat_model,
            deep_think=req.deep_think,
            web_search_enabled=req.web_search_enabled,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e

    return StreamingResponse(
        stream_chat(
            req.message,
            list(req.history),
            req.agent_id,
            req.conversation_id,
            user,
            req.anon_session_secret,
            req.regenerate_last_reply,
            resolved=resolved,
            web_search_mode=req.web_search_mode,
            group_id=req.group_id,
            image_urls=list(req.image_urls),
        ),
        media_type="text/event-stream",
    )


@router.post(
    "/follow-up-suggestions",
    response_model=FollowUpSuggestionsResponse,
    summary="根据助手正文生成追问建议（非流式，独立于对话 SSE）",
)
async def follow_up_suggestions_route(
    req: FollowUpSuggestionsRequest,
    session: Annotated[AsyncSession, Depends(get_session)],
    user: Annotated[UserRecord | None, Depends(get_current_user_optional)],
):
    if req.conversation_id:
        await assert_can_use_conversation(
            session,
            req.conversation_id,
            user,
            req.anon_session_secret,
        )
    suggestions = await generate_follow_up_suggestions(
        req.assistant_reply,
        user_question=req.user_question,
    )
    if req.conversation_id:
        await persist_follow_up_suggestions_for_assistant_message(
            session,
            conversation_id=req.conversation_id,
            assistant_message_id=(req.assistant_message_id or "").strip() or None,
            suggestions=suggestions,
            user=user,
            anon_session_secret=req.anon_session_secret,
        )
    return FollowUpSuggestionsResponse(suggestions=suggestions)


@router.post(
    "/attachment-suggestions",
    response_model=AttachmentSuggestionsResponse,
    summary="根据待发送图片生成附图快捷话术（VL 看图）",
)
async def attachment_suggestions_route(
    req: AttachmentSuggestionsRequest,
    session: Annotated[AsyncSession, Depends(get_session)],
    user: Annotated[UserRecord | None, Depends(get_current_user_optional)],
):
    if req.conversation_id:
        await assert_can_use_conversation(
            session,
            req.conversation_id,
            user,
            req.anon_session_secret,
        )
        await session.commit()
    rows = await generate_attachment_suggestions(req.image_urls)
    return AttachmentSuggestionsResponse(
        items=[AttachmentSuggestionItem(label=r["label"], prompt=r["prompt"]) for r in rows],
    )


@router.get(
    "/model-options",
    summary="Qwen 可选对话模型与能力（未配置 OPTIONS 返回空数组）",
)
async def chat_model_options():
    from app.core.config import get_settings, list_qwen_chat_model_option_rows

    s = get_settings()
    if (s.llm_provider or "").strip().lower() != "qwen":
        return []
    rows = list_qwen_chat_model_option_rows(s)
    if not rows:
        return []
    return [
        {
            "id": r.id,
            "label": r.label,
            "capabilities": r.api_capabilities,
            "default": r.default,
        }
        for r in rows
    ]


@router.get(
    "/conversations",
    response_model=list[ConversationItem],
    summary="当前用户的会话列表（需登录）",
)
async def conversations(
    session: Annotated[AsyncSession, Depends(get_session)],
    user: Annotated[UserRecord, Depends(get_current_user)],
):
    return await list_my_conversations(session, user)


@router.get(
    "/conversations/{conversation_id}/messages",
    response_model=list[MessageItem],
    summary="某会话下的消息列表",
)
async def conversation_messages(
    conversation_id: str,
    session: Annotated[AsyncSession, Depends(get_session)],
    user: Annotated[UserRecord | None, Depends(get_current_user_optional)],
    x_anon_session: Annotated[str | None, Header(alias="X-Anonymous-Session")] = None,
):
    return await list_messages_for_conversation(
        session, conversation_id, user, x_anon_session
    )


@router.put(
    "/conversations/{conversation_id}/group",
    summary="将会话移动到某分组（或移出分组）",
)
async def update_conversation_group_route(
    conversation_id: str,
    req: ConversationGroupAssign,
    session: Annotated[AsyncSession, Depends(get_session)],
    user: Annotated[UserRecord, Depends(get_current_user)],
):
    await update_conversation_group(session, user, conversation_id, req.group_id)
    return {"success": True}


@router.get(
    "/groups",
    response_model=list[ConversationGroupItem],
    summary="当前用户的会话分组列表",
)
async def chat_groups_list(
    session: Annotated[AsyncSession, Depends(get_session)],
    user: Annotated[UserRecord, Depends(get_current_user)],
):
    return await list_groups(session, user)


@router.post(
    "/groups",
    response_model=ConversationGroupItem,
    summary="新建分组",
)
async def chat_groups_create(
    req: ConversationGroupCreate,
    session: Annotated[AsyncSession, Depends(get_session)],
    user: Annotated[UserRecord, Depends(get_current_user)],
):
    return await create_group(session, user, req.name)


@router.patch(
    "/groups/{group_id}",
    summary="重命名分组",
)
async def chat_groups_rename(
    group_id: str,
    req: ConversationGroupRename,
    session: Annotated[AsyncSession, Depends(get_session)],
    user: Annotated[UserRecord, Depends(get_current_user)],
):
    await rename_group(session, user, group_id, req.name)
    return {"success": True}


@router.delete(
    "/groups/{group_id}",
    summary="删除分组（会话移回未分组）",
)
async def chat_groups_delete(
    group_id: str,
    session: Annotated[AsyncSession, Depends(get_session)],
    user: Annotated[UserRecord, Depends(get_current_user)],
):
    await delete_group(session, user, group_id)
    return {"success": True}


@router.delete(
    "/conversations/{conversation_id}",
    summary="删除会话",
)
async def delete_conversation_route(
    conversation_id: str,
    session: Annotated[AsyncSession, Depends(get_session)],
    user: Annotated[UserRecord | None, Depends(get_current_user_optional)],
    x_anon_session: Annotated[str | None, Header(alias="X-Anonymous-Session")] = None,
):
    await delete_conversation(session, conversation_id, user, x_anon_session)
    return {"success": True}


@router.put(
    "/conversations/{conversation_id}/title",
    summary="修改会话标题",
)
async def update_conversation_title_route(
    conversation_id: str,
    req: ConversationTitleUpdate,
    session: Annotated[AsyncSession, Depends(get_session)],
    user: Annotated[UserRecord | None, Depends(get_current_user_optional)],
    x_anon_session: Annotated[str | None, Header(alias="X-Anonymous-Session")] = None,
):
    await update_conversation_title(session, conversation_id, req.title, user, x_anon_session)
    return {"success": True}
