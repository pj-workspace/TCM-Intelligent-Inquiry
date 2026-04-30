"""会话访问校验。"""

import secrets

from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.models import UserRecord
from app.chat.models import ConversationRecord
from app.core.exceptions import ForbiddenError, NotFoundError


async def assert_can_use_conversation(
    session: AsyncSession,
    conversation_id: str,
    user: UserRecord | None,
    anon_session_secret: str | None = None,
) -> ConversationRecord:
    """已登录用户仅能访问本人会话；匿名会话须携带与创建时一致的 anon_session_secret。"""
    row = await session.get(ConversationRecord, conversation_id)
    if row is None:
        raise NotFoundError(f"会话 '{conversation_id}' 不存在")
    if row.user_id:
        if user is None or user.id != row.user_id:
            raise ForbiddenError("无权访问该会话")
        return row
    # 匿名会话（user_id 为空）
    if row.anon_session_secret:
        if not anon_session_secret or not secrets.compare_digest(
            row.anon_session_secret, anon_session_secret.strip()
        ):
            raise ForbiddenError("匿名会话无效或缺少会话凭证（X-Anonymous-Session 或请求体 anon_session_secret）")
        return row
    # 历史数据：无凭证的匿名会话不再允许访问
    raise ForbiddenError("该匿名会话已失效，请重新发起对话")
