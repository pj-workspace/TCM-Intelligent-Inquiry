"""中医知识检索工具：调用 Qdrant 向量库做语义检索。"""

from langchain_core.tools import tool

from app.agent.tools.registry import tool_registry
from app.core.chat_context import chat_agent_kb_id, chat_user_id
from app.core.config import get_settings
from app.core.database import async_session_factory
from app.core.exceptions import ValidationError
from app.knowledge.models import KnowledgeBaseRecord
from app.knowledge.retrieval import retrieve_kb_chunks
from app.knowledge.vectorstore import VectorStoreUnavailable
from sqlalchemy import select


async def _kb_visible_to_user(kb_id: str, user_id: str | None) -> bool:
    async with async_session_factory() as session:
        row = await session.get(KnowledgeBaseRecord, kb_id)
        if row is None:
            return False
        if user_id is None:
            return False
        return row.owner_id == user_id


async def _resolve_kb_id(explicit_kb_id: str | None) -> str | None:
    uid = chat_user_id.get()
    s = get_settings()
    default_kid = s.default_knowledge_base_id.strip()

    agent_kb = chat_agent_kb_id.get()
    if agent_kb and agent_kb.strip() and not (explicit_kb_id and explicit_kb_id.strip()):
        explicit_kb_id = agent_kb.strip()

    if explicit_kb_id and explicit_kb_id.strip():
        kid = explicit_kb_id.strip()
        if uid is None:
            # 未登录仅允许显式指定与环境变量一致的共享库 ID
            if default_kid and kid == default_kid:
                async with async_session_factory() as session:
                    row = await session.get(KnowledgeBaseRecord, kid)
                return kid if row is not None else None
            return None
        if not await _kb_visible_to_user(kid, uid):
            return None
        return kid

    if uid is None:
        # 未登录：仅允许环境变量中的全局默认库（只读共享）
        if default_kid:
            async with async_session_factory() as session:
                row = await session.get(KnowledgeBaseRecord, default_kid)
            return default_kid if row is not None else None
        return None

    if default_kid:
        if await _kb_visible_to_user(default_kid, uid):
            return default_kid

    async with async_session_factory() as session:
        r = await session.execute(
            select(KnowledgeBaseRecord.id)
            .where(KnowledgeBaseRecord.owner_id == uid)
            .order_by(KnowledgeBaseRecord.name)
            .limit(1)
        )
        return r.scalar_one_or_none()


@tool_registry.register
@tool
async def search_tcm_knowledge(
    query: str,
    kb_id: str | None = None,
    top_k: int = 5,
) -> str:
    """检索已入库的中医知识库文档片段（Qdrant 向量检索）。

    参数：
    - query: 检索问题或关键词。
    - kb_id: 可选，指定知识库 ID；不传则优先使用当前 Agent 绑定的默认知识库，否则按环境变量/用户名下第一个自有库解析。
    - top_k: 返回片段条数，默认 5。
    """
    q = (query or "").strip()
    if not q:
        return "请提供有效的检索内容。"

    uid = chat_user_id.get()
    s = get_settings()
    if uid is None and not s.default_knowledge_base_id.strip():
        return "知识库检索需要登录后使用；或请配置 DEFAULT_KNOWLEDGE_BASE_ID 作为匿名可读共享库。"

    resolved = await _resolve_kb_id(kb_id)
    if not resolved:
        return (
            "当前没有可用的知识库：请先登录后在「知识库管理」中创建并导入文档，"
            "或联系管理员配置 DEFAULT_KNOWLEDGE_BASE_ID；"
            "若已指定 kb_id，请确认该库归您所有。"
        )

    try:
        k = max(1, min(int(top_k), 20))
    except (TypeError, ValueError):
        k = 5
    try:
        pairs = await retrieve_kb_chunks(resolved, q, k)
    except (VectorStoreUnavailable, ValidationError) as exc:
        # 工具层不应让 Agent 崩溃；返回提示文本，由模型决定是否换用其他工具
        return (
            f"知识库 `{resolved}` 当前不可用（{exc}），"
            "请稍后重试，或联系管理员检查 Qdrant / 嵌入模型配置。"
        )
    if not pairs:
        return (
            f"在知识库 `{resolved}` 中未检索到与「{q}」相关的片段；"
            "请确认已上传文档或尝试换用其他关键词。"
        )

    lines: list[str] = []
    for i, (doc, score) in enumerate(pairs, start=1):
        src = doc.metadata.get("source", "")
        lines.append(f"[{i}]（相关分数 {score:.4f}，来源: {src}）\n{doc.page_content.strip()}")
    return "\n\n".join(lines)
