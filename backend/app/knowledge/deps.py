"""知识库路由依赖：登录用户 + 可选全局 API Key。"""

from app.auth.deps import require_api_user as require_kb_user

__all__ = ["require_kb_user"]
