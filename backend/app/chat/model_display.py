"""列表展示用短标签（分组头已含厂商，条目不再重复厂家名）。"""

from __future__ import annotations

import re


def short_model_list_label(provider_id: str, full_label: str, model_id: str) -> str:
    """与 Cursor 类似：主列表只展示机型简称。"""
    pid = (provider_id or "").strip().lower()
    lab = (full_label or "").strip()
    mid = (model_id or "").strip()

    if pid == "deepseek":
        if mid == "deepseek-v4-flash":
            return "Flash"
        if mid == "deepseek-v4-pro":
            return "Pro"
        return re.sub(r"(?i)^deepseek\s*", "", lab).strip() or mid or lab

    if pid == "qwen":
        s = lab or mid
        for pat in (r"(?i)^qwen3\s*", r"(?i)^qwen\s+"):
            s = re.sub(pat, "", s).strip()
        return s or lab or mid

    return lab or mid


def infer_speed_tag(provider_id: str, model_id: str) -> str | None:
    """右侧脑图标旁英文档位（对齐 Cursor：Fast / Medium / High）。"""
    pid = (provider_id or "").strip().lower()
    mid = (model_id or "").lower()

    if pid == "deepseek":
        if "flash" in mid:
            return "Fast"
        if "pro" in mid:
            return "High"
        return None

    if pid == "qwen":
        if "plus" in mid:
            return "High"
        if "vl" in mid:
            return "Medium"
        if "flash" in mid:
            return "Fast"
        return "Medium"

    if pid == "openai":
        if "mini" in mid or "nano" in mid:
            return "Fast"
        if "gpt-4o" in mid or "o3" in mid or "o1" in mid:
            return "High"
        return "Medium"

    if pid == "anthropic":
        if "opus" in mid:
            return "Extra High"
        if "sonnet" in mid:
            return "High"
        if "haiku" in mid:
            return "Fast"
        return "Medium"

    if pid == "glm":
        return "Medium"

    return None


def context_window_hint(provider_id: str, model_id: str) -> str | None:
    """弹层脚注：上下文长度（已知则写死，否则不写）。"""
    pid = (provider_id or "").strip().lower()
    mid = (model_id or "").lower()

    if pid == "deepseek" and ("v4" in mid or "deepseek" in mid):
        return "上下文长度以 DeepSeek 官方文档为准（V4 系列多为长上下文）。"

    if pid == "qwen" and mid:
        return "上下文长度以阿里云 DashScope 模型页说明为准。"

    if pid == "openai":
        return "上下文长度以 OpenAI / 当前网关文档为准。"

    if pid == "anthropic":
        return "上下文长度以 Anthropic 模型说明为准。"

    if pid == "glm":
        return "上下文长度以智谱模型文档为准。"

    return None


_DEEPSEEK_SSE_LABEL = {
    "deepseek-v4-flash": "DeepSeek V4 Flash",
    "deepseek-v4-pro": "DeepSeek V4 Pro",
}


def sse_reply_model_label(provider_id: str, model_id: str, active_short_label: str) -> str:
    """SSE meta / 助手气泡展示：用可读全名，避免仅显示「Flash」被误认为模型列表。"""
    pid = (provider_id or "").strip().lower()
    mid = (model_id or "").strip()
    short = (active_short_label or "").strip()

    if pid == "deepseek":
        return _DEEPSEEK_SSE_LABEL.get(mid, f"DeepSeek · {short}" if short else mid)

    if pid == "qwen" and short:
        return f"通义 · {short}"

    return short or mid
