"""对话服务：LangGraph 流式输出 + 会话/消息持久化。"""

import json
import secrets
import time
import uuid
import asyncio
from collections.abc import AsyncIterator, Iterator
from typing import TYPE_CHECKING, Any, Literal

from app.chat.turn_resolve import ResolvedChatTurn
from app.chat.vl_image_sanitize import (
    collect_unique_image_urls_from_messages,
    ensure_urls_probed,
    filter_image_urls_by_probe_cache,
    sanitize_messages_for_vl_images,
)

from app.agent.executor import build_agent_graph_for_chat_request

from langchain_core.messages import AIMessage, HumanMessage, ToolMessage
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.chat.group_service import assert_own_group
from app.chat.models import ConversationRecord, MessageRecord
from app.chat.schemas import ChatMessage
from app.core.chat_context import chat_agent_kb_id, chat_user_id
from app.core.database import async_session_factory
from app.core.logging import get_logger
from app.core.config import active_chat_model_label, get_settings, primary_qwen_chat_model
from app.core.safety import STREAM_SAFETY_NOTICE

if TYPE_CHECKING:
    from app.auth.models import UserRecord

logger = get_logger(__name__)


def _meta_chat_model_label(rt: ResolvedChatTurn) -> str:
    s = get_settings()
    if (s.llm_provider or "").strip().lower() != "qwen":
        return active_chat_model_label()
    mid = (rt.llm_chat_model_id or "").strip()
    return active_chat_model_label(mid or None)


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


def _persist_user_turn_content(text: str, image_urls: list[str]) -> str:
    """入库：无图则仍为纯文案；含图则用 JSON v1（供多模态还原）。"""
    urls = [u for u in image_urls if isinstance(u, str) and u.strip()]
    if not urls:
        return text
    return json.dumps({"v": 1, "text": text, "images": urls}, ensure_ascii=False)


def _parse_user_turn_content(raw: str) -> tuple[str, list[str]]:
    s = (raw or "").strip()
    if not s.startswith("{"):
        return raw, []
    try:
        j = json.loads(s)
        if not isinstance(j, dict) or j.get("v") != 1:
            return raw, []
        imgs = j.get("images")
        if not isinstance(imgs, list):
            return raw, []
        urls = [str(x).strip() for x in imgs if isinstance(x, str) and x.strip()]
        txt = j.get("text")
        tx = "" if txt is None else str(txt)
        if not urls:
            return (tx if tx else raw), []
        return tx, urls
    except json.JSONDecodeError:
        return raw, []


def _lc_human_user_from_storage(raw: str) -> HumanMessage:
    text, imgs = _parse_user_turn_content(raw)
    if imgs:
        blocks: list[dict[str, Any]] = [
            {"type": "image_url", "image_url": {"url": u}} for u in imgs
        ]
        t = (text or "").strip() or "（附图）"
        return HumanMessage(content=[{"type": "text", "text": t}] + blocks)
    raw_s = (raw or "").strip()
    # v1 JSON 但当前无 URL（例如占位），用解析出的正文
    if raw_s.startswith("{") and isinstance(text, str) and text != raw:
        return HumanMessage(content=text or raw)
    return HumanMessage(content=raw)


def _user_message_text_for_regenerate_compare(raw: str) -> str:
    tx, imgs = _parse_user_turn_content(raw)
    if imgs:
        return tx.strip() if tx.strip() else "（附图）"
    return (tx or "").strip()


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
            out.append(_lc_human_user_from_storage(m.content))
        elif m.role == "assistant":
            out.append(AIMessage(content=m.content))
        # thinking / tool 不进入模型上下文
    return out


async def _generate_title_async(
    msg_in: str,
    conv_id: str,
    *,
    chat_model_id: str | None = None,
) -> str:
    """异步生成标题并更新到数据库"""
    from app.llm.chat_factory import build_chat_model

    from sqlalchemy import update

    fallback_title = _truncate(msg_in, 10)
    title = fallback_title

    try:
        s = get_settings()
        ov: str | None = None
        if (s.llm_provider or "").strip().lower() == "qwen":
            qs = primary_qwen_chat_model(s)
            ov = ((chat_model_id or "").strip() or qs)

        model = build_chat_model(
            enable_thinking=False,
            chat_model_override=ov,
        )
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
    *,
    resolved: ResolvedChatTurn,
    web_search_mode: Literal["force", "auto"] = "force",
    group_id: str | None = None,
    image_urls: list[str] | None = None,
) -> AsyncIterator[str]:
    vl_ok_cache: dict[str, bool] = {}

    raw_urls = [u.strip() for u in (image_urls or ()) if isinstance(u, str) and u.strip()]
    had_request_images = bool(raw_urls)

    user_id = user.id if user else None

    if raw_urls:
        await ensure_urls_probed(list(dict.fromkeys(raw_urls)), ok_cache=vl_ok_cache)
        urls = filter_image_urls_by_probe_cache(raw_urls, vl_ok_cache)
    else:
        urls = []

    msg_in = message.strip()
    if not msg_in and urls:
        msg_in = "（附图）"
    if not msg_in and not urls:
        if had_request_images:
            yield _sse(
                {
                    "type": "error",
                    "message": "所附图片尺寸过小或无法读取，模型无法处理，请更换每张宽、高均大于 10 像素的图片后重试。",
                }
            )
        else:
            yield _sse({"type": "error", "message": "消息不能为空"})
        yield "data: [DONE]\n\n"
        return

    persist_user_body = _persist_user_turn_content(msg_in, urls)
    if regenerate_last_reply and not conversation_id:
        yield _sse({"type": "error", "message": "重新生成需要已有会话（conversation_id）。"})
        yield "data: [DONE]\n\n"
        return
    # 匿名会话不能使用分组（新建会话时才读 group_id）
    if group_id is not None and not conversation_id and user is None:
        yield _sse({"type": "error", "message": "请先登录后再在分组内新建会话。"})
        yield "data: [DONE]\n\n"
        return

    ctx_token = chat_user_id.set(user_id)
    kb_ctx_token: object | None = None
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
                    if _user_message_text_for_regenerate_compare(rows[last_user_i].content) != msg_in:
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
                            content=persist_user_body,
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

            gid_for_conv: str | None = None
            if group_id is not None:
                assert user is not None
                async with async_session_factory() as session:
                    await assert_own_group(session, group_id, user)
                gid_for_conv = group_id

            async with async_session_factory() as session:
                session.add(
                    ConversationRecord(
                        id=conv_id,
                        user_id=user_id,
                        title=title,
                        agent_id=agent_id,
                        anon_session_secret=anon_sec,
                        group_id=gid_for_conv,
                    )
                )
                session.add(
                    MessageRecord(
                        id=str(uuid.uuid4()),
                        conversation_id=conv_id,
                        role="user",
                        content=persist_user_body,
                    )
                )
                await session.commit()

            prior = _history_to_lc(history)
            lc_messages = prior + [_lc_human_user_from_storage(persist_user_body)]
            
            # 开启异步标题生成任务
            title_task = asyncio.create_task(
                _generate_title_async(msg_in, conv_id, chat_model_id=resolved.llm_chat_model_id)
            )

        meta_out: dict[str, Any] = {
            "type": "meta",
            "conversationId": conv_id,
            "agentId": agent_id,
            "chatModel": _meta_chat_model_label(resolved),
            "safetyNotice": STREAM_SAFETY_NOTICE,
        }
        if anon_sec:
            meta_out["anonSessionSecret"] = anon_sec
        yield _sse(meta_out)

        agent_kb_id: str | None = None
        if effective_agent_id:
            from app.agent.models import AgentRecord

            async with async_session_factory() as session:
                arow = await session.get(AgentRecord, effective_agent_id)
                if arow is not None and getattr(arow, "default_kb_id", None):
                    agent_kb_id = str(arow.default_kb_id).strip() or None
        kb_ctx_token = chat_agent_kb_id.set(agent_kb_id)

        graph = await build_agent_graph_for_chat_request(
            effective_agent_id,
            chat_model_override=resolved.llm_chat_model_id,
            effective_deep_think=resolved.effective_deep_think,
            effective_web_search=resolved.effective_web_search,
            web_search_mode=web_search_mode,
            effective_tool_calling=resolved.effective_tool_calling,
        )

        uniq_in_messages = collect_unique_image_urls_from_messages(lc_messages)
        await ensure_urls_probed(uniq_in_messages, ok_cache=vl_ok_cache)
        lc_messages = sanitize_messages_for_vl_images(lc_messages, vl_ok_cache)

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

        async def flush_assistant_segment() -> None:
            """正文与工具交替时需在中间落库多条 assistant，否则刷新后 trace 会被 group 整条挤到正文上方。"""
            nonlocal assistant_parts
            if not assistant_parts:
                return
            text = "".join(assistant_parts)
            assistant_parts.clear()
            lbl = _meta_chat_model_label(resolved)
            async with async_session_factory() as session:
                session.add(
                    MessageRecord(
                        id=str(uuid.uuid4()),
                        conversation_id=conv_id,
                        role="assistant",
                        content=text,
                        model_name=lbl,
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
                            if assistant_parts:
                                await flush_assistant_segment()
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
                await flush_assistant_segment()
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
                # 从 ToolMessage.status 读取工具真实执行状态，避免前端用正则猜测
                tool_status: str = "success"
                if isinstance(out, ToolMessage):
                    tool_status = out.status or "success"
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
                    "status": tool_status,
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
        await flush_assistant_segment()

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
                            model_name=_meta_chat_model_label(resolved),
                        )
                    )
                    await session.commit()
            except Exception:
                logger.exception("写入中断占位消息失败")
        yield _sse({"type": "error", "message": str(exc)})
        yield "data: [DONE]\n\n"
    finally:
        if kb_ctx_token is not None:
            chat_agent_kb_id.reset(kb_ctx_token)
        chat_user_id.reset(ctx_token)
