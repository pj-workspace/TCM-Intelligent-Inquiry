"""Redis 异步客户端（会话缓存、限流等，健康检查会 ping）。"""

from functools import lru_cache

import redis.asyncio as redis

from app.core.config import get_settings


@lru_cache
def get_redis() -> redis.Redis:
    s = get_settings()
    return redis.from_url(s.redis_url, decode_responses=True)


async def ping_redis() -> bool:
    r = get_redis()
    pong = await r.ping()
    return bool(pong)
