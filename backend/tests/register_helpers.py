"""测试用：写入注册邮箱 OTP（对齐生产 Redis key）。"""

import redis as redis_sync

from app.auth.services.mail_service import redis_email_login_code, redis_register_code
from app.core.config import get_settings


def prime_register_otp(email: str, *, code: str = "887766") -> None:
    client = redis_sync.from_url(get_settings().redis_url, decode_responses=True)
    client.setex(redis_register_code(email), 600, code)


def prime_email_login_otp(email: str, *, code: str = "554433") -> None:
    client = redis_sync.from_url(get_settings().redis_url, decode_responses=True)
    client.setex(redis_email_login_code(email), 600, code)
