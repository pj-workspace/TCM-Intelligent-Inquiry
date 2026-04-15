"""认证路由（骨架）。"""

from fastapi import APIRouter

from app.auth.schemas import LoginRequest, TokenResponse
from app.auth.service import AuthService

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/login", response_model=TokenResponse, summary="登录获取 Token（骨架）")
def login(req: LoginRequest):
    return AuthService().login(req)
