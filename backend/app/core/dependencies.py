"""公共 FastAPI 依赖项。

后续可在此添加：JWT 鉴权、数据库 Session、分页参数等。
"""

from typing import Annotated

from fastapi import Header, HTTPException


async def verify_api_key(x_api_key: Annotated[str | None, Header()] = None) -> None:
    """可选 API Key：`Settings.api_key`（环境变量 `API_KEY`）非空时要求请求头 `X-API-Key` 一致。"""
    from app.core.config import get_settings

    expected = (get_settings().api_key or "").strip()
    if not expected:
        return
    if (x_api_key or "").strip() != expected:
        raise HTTPException(status_code=401, detail="Invalid API Key")
