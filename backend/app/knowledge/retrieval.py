"""知识库检索：向量召回 + 可选重排序，供 API 与 Agent 工具共用。"""

from langchain_core.documents import Document

from app.core.config import get_settings
from app.core.exceptions import ValidationError
from app.core.logging import get_logger
from app.knowledge.rerank import rerank_document_pairs
from app.knowledge.vectorstore import (
    VectorStoreUnavailable,
    similarity_search as vector_similarity_search,
)

logger = get_logger(__name__)


async def retrieve_kb_chunks(
    kb_id: str,
    query: str,
    top_k: int,
) -> list[tuple[Document, float]]:
    """先向量召回较多候选，再按需 gte-rerank，截断为 top_k。

    向量库故障（连接失败、调用异常）由 :class:`VectorStoreUnavailable` 表示，
    在此统一翻译为 :class:`ValidationError`，HTTP 层会返回 422 + 友好提示。
    "集合不存在" 不会被翻译——`vector_similarity_search` 已视为空结果。
    """
    s = get_settings()
    k = max(1, min(int(top_k), 20))

    if s.rerank_enabled:
        mult = max(2, s.rerank_candidate_multiplier)
        fetch_n = min(max(k * mult, k + 5), s.rerank_max_candidates)
    else:
        fetch_n = k

    try:
        pairs = await vector_similarity_search(kb_id, query, fetch_n)
    except VectorStoreUnavailable as exc:
        raise ValidationError(
            f"知识库检索暂不可用：{exc}；请稍后重试或检查 Qdrant / 嵌入模型配置。"
        ) from exc

    if not pairs:
        return []

    if not s.rerank_enabled or len(pairs) <= k:
        return pairs[:k]

    return await rerank_document_pairs(query, pairs, k)
