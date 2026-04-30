"""解析本轮请求的 effective 对话模型与各能力裁剪后的布尔值。"""

from __future__ import annotations

from dataclasses import dataclass

from app.core.config import (
    get_settings,
    list_qwen_chat_model_option_rows,
    primary_qwen_chat_model,
    qwen_option_for_model_id,
)


@dataclass(frozen=True)
class ResolvedChatTurn:
    """传给 stream_chat / 构图用。"""

    llm_chat_model_id: str
    effective_deep_think: bool
    effective_web_search: bool
    effective_tool_calling: bool


def resolve_chat_turn(
    *,
    chat_model_body: str | None,
    deep_think: bool,
    web_search_enabled: bool,
) -> ResolvedChatTurn:
    s = get_settings()
    lp = (s.llm_provider or "").strip().lower()

    if lp != "qwen":
        return ResolvedChatTurn(
            llm_chat_model_id="",
            effective_deep_think=deep_think,
            effective_web_search=web_search_enabled,
            effective_tool_calling=True,
        )

    opts = list_qwen_chat_model_option_rows(s)
    pid = primary_qwen_chat_model(s)
    if not opts:
        mid = (s.qwen_chat_model or "").strip()
        return ResolvedChatTurn(
            llm_chat_model_id=mid,
            effective_deep_think=deep_think,
            effective_web_search=web_search_enabled,
            effective_tool_calling=True,
        )

    cand = (chat_model_body or "").strip() or pid
    row = qwen_option_for_model_id(cand, settings=s)
    if row is None:
        raise ValueError(f"无效的 chat_model: {cand!r}")

    tc = row.supports_tool_calling
    td = row.supports_deep_think
    return ResolvedChatTurn(
        llm_chat_model_id=cand,
        effective_deep_think=deep_think and td,
        effective_web_search=web_search_enabled and tc,
        effective_tool_calling=tc,
    )
