"""ask_user：向前端发送交互选择框，暂停等待用户作答。

调用本工具后，前端会在对话流中插入一张可交互的选择卡片，
用户点选或填写后，其回答将作为下一条用户消息继续对话。
"""

from __future__ import annotations

import json
import uuid

from langchain_core.tools import tool

from app.agent.tools.registry import tool_registry


@tool_registry.register
@tool
def ask_user(
    question: str,
    choices: list[str],
    allow_free_text: bool = True,
) -> str:
    """向用户发送一个交互选择框，收集用户偏好或澄清关键信息。

    仅在信息不足、确实需要用户做出选择时调用；不要滥用。
    调用后请输出一句简短提示（如"请从上方选择"），然后停止输出，等待用户作答。

    参数：
    - question: 向用户展示的问题（简洁，30字以内）
    - choices: 选项列表，2 至 6 个，每项不超过 20 字
    - allow_free_text: 是否允许用户自由填写（默认 True）
    """
    widget_id = f"w-{uuid.uuid4().hex[:10]}"
    payload = {
        "__widget__": True,
        "widgetId": widget_id,
        "widgetType": "choice",
        "question": (question or "").strip()[:60],
        "choices": [str(c).strip()[:30] for c in (choices or [])[:6] if str(c).strip()],
        "allowFreeText": bool(allow_free_text),
    }
    return json.dumps(payload, ensure_ascii=False)
