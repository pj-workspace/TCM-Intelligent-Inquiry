"""根据助手已输出正文生成 2～3 条简短追问建议（独立于主 SSE）。

每条建议强制 ≤20 字（含标点），模型须在提示词约束下从源头写短。

模型返回单一 JSON 对象：need_follow_ups + suggestions；由模型判断是否值得展示追问。
OpenAI 兼容渠道（Qwen / OpenAI / GLM / DeepSeek）开启 response_format=json_object。
"""

from __future__ import annotations

import asyncio
import json
import re

from app.core.logging import get_logger

logger = get_logger(__name__)


def _extract_ai_text(res: object) -> str:
    content = getattr(res, "content", None)
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        parts: list[str] = []
        for block in content:
            if isinstance(block, dict) and block.get("type") == "text":
                parts.append(str(block.get("text", "")))
            elif isinstance(block, str):
                parts.append(block)
        return "".join(parts)
    return ""


_MAX_REPLY_CHARS = 32_000
_MAX_ITEMS = 3
_EACH_MAX_LEN = 20

_JSON_OBJECT_PROVIDERS = frozenset({"qwen", "openai", "glm", "deepseek"})


def _truthy(v: object) -> bool:
    if isinstance(v, bool):
        return v
    if isinstance(v, (int, float)):
        return v != 0
    if isinstance(v, str):
        return v.strip().lower() in ("true", "1", "yes", "y", "是")
    return False


def _truncate_safe(s: str, n: int) -> str:
    if len(s) <= n:
        return s
    return s[: n - 1] + "…"


def _normalize_suggestion_strings(items: object) -> list[str]:
    if not isinstance(items, list):
        return []
    out: list[str] = []
    for item in items:
        if isinstance(item, str):
            t = item.strip().replace("\n", " ")
            if t and len(t) <= 240:
                out.append(_truncate_safe(t, _EACH_MAX_LEN))
        elif item is not None:
            t = str(item).strip().replace("\n", " ")
            if t:
                out.append(_truncate_safe(t, _EACH_MAX_LEN))
        if len(out) >= _MAX_ITEMS:
            break
    return out


def _loads_json_object(payload: str) -> dict | list | None:
    s = payload.strip()
    if not s:
        return None
    try:
        data = json.loads(s)
    except json.JSONDecodeError:
        data = None
    if data is not None:
        return data  # type: ignore[return-value]
    fence = re.search(r"```(?:json)?\s*([\s\S]*?)\s*```", s, re.IGNORECASE)
    if fence:
        inner = fence.group(1).strip()
        try:
            return json.loads(inner)  # type: ignore[no-any-return]
        except json.JSONDecodeError:
            pass
    mobj = re.search(r"\{[\s\S]*\}", s)
    if mobj:
        try:
            return json.loads(mobj.group(0))  # type: ignore[no-any-return]
        except json.JSONDecodeError:
            pass
    # 兼容：仅数组
    marr = re.search(r"\[[\s\S]*\]", s)
    if marr:
        try:
            return json.loads(marr.group(0))  # type: ignore[no-any-return]
        except json.JSONDecodeError:
            pass
    return None


def _parse_follow_up_payload(raw: str) -> list[str]:
    """解析模型 JSON；need_follow_ups 为假或缺省时返回空列表。"""
    data = _loads_json_object(raw)
    if data is None:
        return []

    if isinstance(data, list):
        return _normalize_suggestion_strings(data)

    if not isinstance(data, dict):
        return []

    need = data.get("need_follow_ups")
    if need is None:
        need = data.get("need_suggestions")
    if not _truthy(need):
        return []

    sug = data.get("suggestions")
    if sug is None:
        sug = data.get("items")
    return _normalize_suggestion_strings(sug)


async def generate_follow_up_suggestions(
    assistant_reply: str,
    *,
    chat_model_override: str | None = None,
    timeout_sec: float = 22.0,
) -> list[str]:
    from app.core.config import get_settings, primary_qwen_chat_model
    from app.llm.chat_factory import build_chat_model

    text = (assistant_reply or "").strip()
    if len(text) < 12:
        return []
    if len(text) > _MAX_REPLY_CHARS:
        text = text[:_MAX_REPLY_CHARS]

    s = get_settings()
    p = (s.llm_provider or "qwen").strip().lower()
    use_json_object = p in _JSON_OBJECT_PROVIDERS

    ov: str | None = None
    if p == "qwen":
        qs = primary_qwen_chat_model(s)
        ov = ((chat_model_override or "").strip() or qs)

    model = build_chat_model(
        enable_thinking=False,
        chat_model_override=ov,
        response_format_json_object=use_json_object,
    )
    prompt = (
        "你是一款中医药智能问答产品的助手。\n下面「助手正文」是上一条模型对用户的完整回复。\n\n"
        "请先判断：**是否值得**在 UI 上向用户展示 2～3 条快捷补充话术按钮。\n\n"
        "将 need_follow_ups 设为 false 的典型情况包括但不限于：\n"
        "• 正文主要是免责声明、法律咨询、不能做诊断／不能替代医生的说明，且没有多少可展开的中医细节；\n"
        "• 正文是纯礼貌结束语或「再见」一类，没有再问空间；\n"
        "• 正文本身是错误提示、空白或信息量极低；\n"
        "• 正文已经穷尽主题、用户很难再自然延伸（例如极简事实确认）。\n\n"
        "**重要（语气）**：suggestions 里每一条都必须是用户**准备在输入框里发给助手**的一句话，"
        "仿佛用户本人在向 AI 请教或补充情况；不要用医生盘问病人的口吻来写（例如避免出现「你有没有…」「疼痛是突然的吗」「大便怎么样」这类把用户当问诊对象的句子）。"
        "可自然使用：请问…、能帮我讲讲…吗、想了解…、我如果…算不算…、请结合上文说说…等。\n"
        "若 need_follow_ups 为 true：给出 2～3 条这样的文案；**每条总长（含标点、省略号）不得超过 "
        f"{_EACH_MAX_LEN} 个字符**，尽量一句短问，口语化即可；超长会被截断，请从源头写短。\n"
        "若不需要快捷话术：need_follow_ups 为 false，且 suggestions 为 []。\n\n"
        "**只输出一条合法的 JSON**，不要 Markdown 代码围栏、不要有前后解释文字（JSON keyword 为满足接口要求）。"
        'Schema 示例：{"need_follow_ups":true,'
        '"suggestions":["阳虚怎么判断？","手脚冰凉算阳虚吗"]}\n\n'
        f"助手正文：\n<<<\n{text}\n>>>"
    )

    async def _call() -> list[str]:
        res = await model.ainvoke(prompt)
        raw = _extract_ai_text(res) if res is not None else ""
        if not raw and hasattr(res, "content"):
            raw = str(getattr(res, "content", "") or "")
        return _parse_follow_up_payload(raw.strip())

    try:
        items = await asyncio.wait_for(_call(), timeout=timeout_sec)
        return items[:_MAX_ITEMS] if items else []
    except TimeoutError:
        logger.warning("follow-up suggestions timed out")
        return []
    except Exception as e:
        logger.warning("follow-up suggestions failed: %s", e)
        return []
