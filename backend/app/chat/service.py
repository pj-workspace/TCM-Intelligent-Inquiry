"""对话服务：LangGraph 流式输出 + 会话/消息持久化。"""

import json
import secrets
import time
import uuid
import asyncio
from collections.abc import AsyncIterator, Iterator
from typing import TYPE_CHECKING, Any

from langchain_core.messages import AIMessage, HumanMessage, ToolMessage
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.chat.models import ConversationRecord, MessageRecord
from app.chat.schemas import ChatMessage
from app.core.chat_context import chat_user_id
from app.core.database import async_session_factory
from app.core.logging import get_logger
from app.core.config import active_chat_model_label
from app.core.safety import STREAM_SAFETY_NOTICE

if TYPE_CHECKING:
    from app.auth.models import UserRecord

logger = get_logger(__name__)

_TOOL_IO_MAX = 8000
_THINKING_MAX = 16000


def _sse(payload: dict) -> str:
    return f"data: {json.dumps(payload, ensure_ascii=False)}\n\n"


def _truncate(s: str, max_len: int) -> str:
    if len(s) <= max_len:
        return s
    return s[: max_len - 1] + "…"


def _json_safe_for_sse(obj: Any, max_str: int = _TOOL_IO_MAX, depth: int = 0) -> Any:
    """将工具入参等转为可 JSON 序列化结构，并限制深度与字符串长度。"""
    if depth > 12:
        return "…"
    if obj is None or isinstance(obj, (bool, int, float)):
        return obj
    if isinstance(obj, str):
        return _truncate(obj, max_str)
    if isinstance(obj, dict):
        out: dict[str, Any] = {}
        for i, (k, v) in enumerate(obj.items()):
            if i >= 40:
                out["…"] = f"共 {len(obj)} 项，已省略"
                break
            out[str(k)[:200]] = _json_safe_for_sse(v, max_str, depth + 1)
        return out
    if isinstance(obj, (list, tuple)):
        return [_json_safe_for_sse(x, max_str, depth + 1) for x in obj[:40]]
    return _truncate(str(obj), max_str)


def _serialize_tool_output(out: Any) -> str:
    """工具结束时的 output 预览（供前端展示，非全量日志）。"""
    if out is None:
        return ""
    if isinstance(out, ToolMessage):
        c = out.content
        if isinstance(c, str):
            return _truncate(c, _TOOL_IO_MAX)
        if isinstance(c, list):
            parts: list[str] = []
            for b in c:
                if isinstance(b, dict) and b.get("type") == "text":
                    parts.append(str(b.get("text", "")))
                elif isinstance(b, str):
                    parts.append(b)
            return _truncate("".join(parts), _TOOL_IO_MAX)
        return _truncate(json.dumps(c, ensure_ascii=False), _TOOL_IO_MAX)
    if isinstance(out, AIMessage):
        return _truncate(str(out.content), _TOOL_IO_MAX)
    if hasattr(out, "content"):
        return _serialize_tool_output(getattr(out, "content"))
    return _truncate(str(out), _TOOL_IO_MAX)


def _extract_text(chunk) -> str:
    """仅提取可见回复正文（兼容旧逻辑）。"""
    content = getattr(chunk, "content", None)
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


def _iter_reasoning_delta_from_chunk(chunk: Any) -> Iterator[str]:
    """DashScope 等 OpenAI 兼容流：思考在 delta.reasoning_content，LangChain 多放在 additional_kwargs。"""
    kwargs = getattr(chunk, "additional_kwargs", None)
    if isinstance(kwargs, dict):
        for key in ("reasoning_content", "reasoning", "thinking"):
            v = kwargs.get(key)
            if v:
                yield _truncate(str(v), _THINKING_MAX)
                return
    rm = getattr(chunk, "response_metadata", None)
    if isinstance(rm, dict):
        for key in ("reasoning_content", "reasoning"):
            v = rm.get(key)
            if v:
                yield _truncate(str(v), _THINKING_MAX)
                return


def _iter_model_stream_parts(chunk) -> Iterator[tuple[str, str]]:
    """从 chat_model_stream chunk 拆出 (kind, delta)，kind 为 text 或 thinking。"""
    # 必须先处理 reasoning：若 content 为 str 时旧逻辑会提前 return，会漏掉 Qwen/DashScope 的思考流
    for r in _iter_reasoning_delta_from_chunk(chunk):
        yield "thinking", r

    content = getattr(chunk, "content", None)
    if isinstance(content, str):
        if content:
            yield "text", content
        return
    if not isinstance(content, list):
        return
    for block in content:
        if isinstance(block, dict):
            bt = str(block.get("type") or "")
            if bt == "text":
                t = str(block.get("text", ""))
                if t:
                    yield "text", t
            elif bt in (
                "thinking",
                "reasoning",
                "redacted_reasoning",
            ):
                raw = (
                    block.get("thinking")
                    or block.get("reasoning")
                    or block.get("text")
                    or ""
                )
                if raw:
                    yield "thinking", _truncate(str(raw), _THINKING_MAX)
        elif isinstance(block, str) and block:
            yield "text", block


def _history_to_lc(history: list[ChatMessage]) -> list[HumanMessage | AIMessage]:
    out: list[HumanMessage | AIMessage] = []
    for m in history:
        if m.role == "user":
            out.append(HumanMessage(content=m.content))
        else:
            out.append(AIMessage(content=m.content))
    return out


async def _messages_to_lc(session: AsyncSession, conversation_id: str) -> list[HumanMessage | AIMessage]:
    r = await session.execute(
        select(MessageRecord)
        .where(MessageRecord.conversation_id == conversation_id)
        .order_by(MessageRecord.created_at)
    )
    rows = r.scalars().all()
    out: list[HumanMessage | AIMessage] = []
    for m in rows:
        if m.role == "user":
            out.append(HumanMessage(content=m.content))
        elif m.role == "assistant":
            out.append(AIMessage(content=m.content))
        # thinking / tool 不进入模型上下文
    return out


async def _generate_title_async(msg_in: str, conv_id: str) -> str:
    """异步生成标题并更新到数据库"""
    from app.llm.chat_factory import build_chat_model
    from sqlalchemy import update

    fallback_title = _truncate(msg_in, 10)
    title = fallback_title

    try:
        model = build_chat_model()
        prompt = (
            "请根据用户的首条消息，总结出一个简短的会话标题（10个字以内）。"
            "只输出标题文本，不要包含任何标点符号、引号或额外解释。\n\n"
            f"用户消息：{msg_in}"
        )

        async def _call_model():
            res = await model.ainvoke(prompt)
            # ainvoke 返回 AIMessage 时 content 可能为 str 或 block 列表，需统一提取
            raw = _extract_text(res) if res is not None else ""
            if not raw and hasattr(res, "content"):
                raw = str(getattr(res, "content", "") or "")
            return raw.strip()

        # 略长于主对话首 token，避免慢模型误判为超时；仍由 wait_for 保证不无限阻塞
        ai_title = await asyncio.wait_for(_call_model(), timeout=12.0)
        if ai_title:
            ai_title = ai_title.strip("'\"")
            title = _truncate(ai_title, 10)
    except TimeoutError:
        logger.warning("generate conversation title timed out, using fallback")
    except Exception as e:
        logger.warning("Failed to generate title asynchronously: %s", e)
        
    try:
        async with async_session_factory() as session:
            await session.execute(
                update(ConversationRecord)
                .where(ConversationRecord.id == conv_id)
                .values(title=title)
            )
            await session.commit()
    except Exception as e:
        logger.exception("Failed to save generated title")
        
    return title


async def stream_chat(
    message: str,
    history: list[ChatMessage],
    agent_id: str | None,
    conversation_id: str | None,
    user: "UserRecord | None",
    anon_session_secret: str | None = None,
    regenerate_last_reply: bool = False,
) -> AsyncIterator[str]:
    from app.agent.executor import build_agent_graph

    user_id = user.id if user else None
    msg_in = message.strip()
    if not msg_in:
        yield _sse({"type": "error", "message": "消息不能为空"})
        yield "data: [DONE]\n\n"
        return
    if regenerate_last_reply and not conversation_id:
        yield _sse({"type": "error", "message": "重新生成需要已有会话（conversation_id）。"})
        yield "data: [DONE]\n\n"
        return

    ctx_token = chat_user_id.set(user_id)
    conv_id: str | None = conversation_id
    effective_agent_id = agent_id
    is_new_conversation = False
    title_task = None
    title_yielded = False

    try:
        yield _sse({"type": "notice", "safetyNotice": STREAM_SAFETY_NOTICE})

        anon_sec: str | None = None
        if conv_id:
            async with async_session_factory() as session:
                conv_row = await session.get(ConversationRecord, conv_id)
                if effective_agent_id is None and conv_row is not None:
                    effective_agent_id = conv_row.agent_id

                if regenerate_last_reply:
                    r = await session.execute(
                        select(MessageRecord)
                        .where(MessageRecord.conversation_id == conv_id)
                        .order_by(MessageRecord.created_at)
                    )
                    rows = r.scalars().all()
                    last_user_i = -1
                    for i, m in enumerate(rows):
                        if m.role == "user":
                            last_user_i = i
                    if last_user_i < 0:
                        yield _sse(
                            {
                                "type": "error",
                                "message": "无法重新生成：会话中没有用户消息。",
                            }
                        )
                        yield "data: [DONE]\n\n"
                        return
                    last_user_text = rows[last_user_i].content.strip()
                    if last_user_text != msg_in:
                        yield _sse(
                            {
                                "type": "error",
                                "message": "重新生成失败：内容与最后一条用户消息不一致。",
                            }
                        )
                        yield "data: [DONE]\n\n"
                        return
                    tail_ids = [m.id for m in rows[last_user_i + 1 :]]
                    if tail_ids:
                        await session.execute(
                            delete(MessageRecord).where(MessageRecord.id.in_(tail_ids))
                        )
                else:
                    session.add(
                        MessageRecord(
                            id=str(uuid.uuid4()),
                            conversation_id=conv_id,
                            role="user",
                            content=msg_in,
                        )
                    )
                await session.commit()

            async with async_session_factory() as session:
                lc_messages = await _messages_to_lc(session, conv_id)
        else:
            is_new_conversation = True
            conv_id = str(uuid.uuid4())
            title = "新会话"
            anon_sec = secrets.token_hex(32) if user_id is None else None
            async with async_session_factory() as session:
                session.add(
                    ConversationRecord(
                        id=conv_id,
                        user_id=user_id,
                        title=title,
                        agent_id=agent_id,
                        anon_session_secret=anon_sec,
                    )
                )
                session.add(
                    MessageRecord(
                        id=str(uuid.uuid4()),
                        conversation_id=conv_id,
                        role="user",
                        content=msg_in,
                    )
                )
                await session.commit()

            prior = _history_to_lc(history)
            lc_messages = prior + [HumanMessage(content=msg_in)]
            
            # 开启异步标题生成任务
            title_task = asyncio.create_task(_generate_title_async(msg_in, conv_id))

        meta_out: dict[str, Any] = {
            "type": "meta",
            "conversationId": conv_id,
            "agentId": agent_id,
            "chatModel": active_chat_model_label(),
            "safetyNotice": STREAM_SAFETY_NOTICE,
        }
        if anon_sec:
            meta_out["anonSessionSecret"] = anon_sec
        yield _sse(meta_out)

        graph = await build_agent_graph(effective_agent_id)

        assistant_parts: list[str] = []
        thinking_buf: list[str] = []
        thinking_t0: float | None = None
        #: 与 SSE on_tool_start 配对，供 on_tool_end 落库
        tool_pending_by_run: dict[str, dict[str, Any]] = {}
        tool_pending_fifo: list[dict[str, Any]] = []

        async def flush_thinking_segment() -> None:
            nonlocal thinking_buf, thinking_t0
            if not thinking_buf or thinking_t0 is None:
                return
            dur = round(time.monotonic() - thinking_t0, 2)
            text = "".join(thinking_buf)
            thinking_buf = []
            thinking_t0 = None
            async with async_session_factory() as session:
                session.add(
                    MessageRecord(
                        id=str(uuid.uuid4()),
                        conversation_id=conv_id,
                        role="thinking",
                        content=text,
                        duration_sec=dur,
                    )
                )
                await session.commit()

        async for event in graph.astream_events({"messages": lc_messages}, version="v2"):
            if title_task and not title_yielded and title_task.done():
                title_yielded = True
                try:
                    new_title = title_task.result()
                    yield _sse(
                        {"type": "title-updated", "title": new_title, "conversationId": conv_id}
                    )
                except Exception:
                    yield _sse(
                        {
                            "type": "title-updated",
                            "title": _truncate(msg_in, 10),
                            "conversationId": conv_id,
                        }
                    )

            etype = event.get("event")
            data = event.get("data") if isinstance(event.get("data"), dict) else {}
            run_id = event.get("run_id")

            if etype == "on_chat_model_stream":
                chunk = data.get("chunk")
                if chunk:
                    streamed = False
                    for kind, delta in _iter_model_stream_parts(chunk):
                        if not delta:
                            continue
                        streamed = True
                        if kind == "text":
                            await flush_thinking_segment()
                            assistant_parts.append(delta)
                            yield _sse({"type": "text-delta", "textDelta": delta})
                        else:
                            if thinking_t0 is None:
                                thinking_t0 = time.monotonic()
                            thinking_buf.append(delta)
                            yield _sse({"type": "thinking-delta", "textDelta": delta})
                    if not streamed:
                        delta = _extract_text(chunk)
                        if delta:
                            await flush_thinking_segment()
                            assistant_parts.append(delta)
                            yield _sse({"type": "text-delta", "textDelta": delta})

            elif etype == "on_tool_start":
                await flush_thinking_segment()
                name = event.get("name") or ""
                raw_in = data.get("input")
                if raw_in is None:
                    raw_in = data.get("tool_input")
                if run_id is not None:
                    tool_pending_by_run[str(run_id)] = {
                        "name": name,
                        "input": _json_safe_for_sse(raw_in) if raw_in is not None else None,
                    }
                else:
                    tool_pending_fifo.append(
                        {
                            "name": name,
                            "input": _json_safe_for_sse(raw_in) if raw_in is not None else None,
                        }
                    )
                payload: dict[str, Any] = {
                    "type": "tool-call",
                    "name": name,
                }
                if run_id is not None:
                    payload["runId"] = run_id
                if raw_in is not None:
                    payload["input"] = _json_safe_for_sse(raw_in)
                yield _sse(payload)

            elif etype == "on_tool_end":
                name = event.get("name") or ""
                out = data.get("output")
                preview = _serialize_tool_output(out)
                run_key = str(run_id) if run_id is not None else None
                start_meta: dict[str, Any] | None = None
                if run_key is not None and run_key in tool_pending_by_run:
                    start_meta = tool_pending_by_run.pop(run_key)
                elif tool_pending_fifo:
                    start_meta = tool_pending_fifo.pop(0)
                tr_name = (start_meta or {}).get("name") or name
                tr_input = (start_meta or {}).get("input") if start_meta else None
                tr: dict[str, Any] = {
                    "type": "tool-result",
                    "name": tr_name,
                }
                if run_id is not None:
                    tr["runId"] = run_id
                if preview:
                    tr["outputPreview"] = preview
                yield _sse(tr)

                rec: dict[str, Any] = {"name": tr_name, "outputPreview": preview}
                if tr_input is not None:
                    rec["input"] = tr_input
                if run_key:
                    rec["runId"] = run_key
                async with async_session_factory() as session:
                    session.add(
                        MessageRecord(
                            id=str(uuid.uuid4()),
                            conversation_id=conv_id,
                            role="tool",
                            content=json.dumps(rec, ensure_ascii=False),
                        )
                    )
                    await session.commit()

        await flush_thinking_segment()
        assistant_text = "".join(assistant_parts)
        _model_label = active_chat_model_label()
        async with async_session_factory() as session:
            session.add(
                MessageRecord(
                    id=str(uuid.uuid4()),
                    conversation_id=conv_id,
                    role="assistant",
                    content=assistant_text,
                    model_name=_model_label,
                )
            )
            await session.commit()

        if title_task and not title_yielded:
            try:
                new_title = await title_task
                yield _sse(
                    {"type": "title-updated", "title": new_title, "conversationId": conv_id}
                )
            except Exception:
                fb = _truncate(msg_in, 10)
                yield _sse(
                    {"type": "title-updated", "title": fb, "conversationId": conv_id}
                )

        yield "data: [DONE]\n\n"

    except Exception as exc:
        logger.exception("stream_chat error")
        if title_task and not title_yielded and is_new_conversation and conv_id:
            title_task.cancel()
            yield _sse(
                {
                    "type": "title-updated",
                    "title": _truncate(msg_in, 10),
                    "conversationId": conv_id,
                }
            )
        if conv_id:
            try:
                async with async_session_factory() as session:
                    session.add(
                        MessageRecord(
                            id=str(uuid.uuid4()),
                            conversation_id=conv_id,
                            role="assistant",
                            content="（回复生成中断，请稍后重试。）",
                            model_name=active_chat_model_label(),
                        )
                    )
                    await session.commit()
            except Exception:
                logger.exception("写入中断占位消息失败")
        yield _sse({"type": "error", "message": str(exc)})
        yield "data: [DONE]\n\n"
    finally:
        chat_user_id.reset(ctx_token)
