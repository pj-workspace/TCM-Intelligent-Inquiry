"""知识库路由依赖：登录用户 + 可选全局 API Key。"""

from typing import Annotated

from fastapi import Depends

from app.auth.deps import get_current_user
from app.auth.models import UserRecord
from app.core.dependencies import verify_api_key


async def require_kb_user(
    user: Annotated[UserRecord, Depends(get_current_user)],
    _: Annotated[None, Depends(verify_api_key)],
) -> UserRecord:
    """已登录用户；若配置了 API_KEY，还须携带正确的 X-API-Key。"""
    return user
