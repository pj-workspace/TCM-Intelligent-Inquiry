"""DeepSeek 余额响应等 JSON 字段的轻量解析（无 httpx / billing 依赖，避免循环 import）。"""

from __future__ import annotations

from typing import Any


def balance_is_available_field(value: Any) -> bool | None:
    """解析余额 JSON 中的 ``is_available``，避免 ``bool("false") is True`` 等陷阱。"""
    if value is None:
        return None
    if isinstance(value, bool):
        return value
    # bool 是 int 的子类，必须先于 int 分支处理
    if isinstance(value, int):
        if value == 0:
            return False
        if value == 1:
            return True
        return None
    if isinstance(value, str):
        s = value.strip().lower()
        if s in ("true", "1", "yes", "on"):
            return True
        if s in ("false", "0", "no", "off"):
            return False
        if s == "":
            return None
        return None
    return None
