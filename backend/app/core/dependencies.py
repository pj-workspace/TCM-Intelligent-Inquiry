"""公共 FastAPI 依赖项。

后续可在此添加：JWT 鉴权、数据库 Session、分页参数等。
"""

from typing import Annotated

from fastapi import Header, HTTPException


async def verify_api_key(x_api_key: Annotated[str | None, Header()] = None) -> None:
    """占位：API Key 校验（默认关闭，填写 API_KEY 环境变量后自动启用）。

    生产环境建议在此接入 JWT 或 OAuth2。
    """
    from app.core.config import get_settings

    s = get_settings()
    api_key = getattr(s, "api_key", None)
    if api_key and x_api_key != api_key:
        raise HTTPException(status_code=401, detail="Invalid API Key")
