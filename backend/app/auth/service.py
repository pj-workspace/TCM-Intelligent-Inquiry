"""认证服务（骨架）。

后续可接入：
  - JWT 签发与校验
  - 数据库用户表
  - OAuth2 / SSO
"""

from app.auth.schemas import LoginRequest, TokenResponse
from app.core.exceptions import UnauthorizedError
from app.core.logging import get_logger

logger = get_logger(__name__)


class AuthService:
    def login(self, req: LoginRequest) -> TokenResponse:
        """骨架：仅做占位，任何凭证均返回 mock token。"""
        logger.info("login attempt user=%s (骨架，未校验)", req.username)
        if not req.username or not req.password:
            raise UnauthorizedError("用户名或密码不能为空")
        return TokenResponse(
            access_token="mock-token-replace-with-jwt",
            expires_in=3600,
        )
