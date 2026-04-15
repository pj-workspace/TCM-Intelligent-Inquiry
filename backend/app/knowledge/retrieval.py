"""知识库检索：向量召回 + 可选重排序，供 API 与 Agent 工具共用。"""

from langchain_core.documents import Document

from app.core.config import get_settings
from app.core.logging import get_logger
from app.knowledge.rerank import rerank_document_pairs
from app.knowledge.vectorstore import similarity_search as vector_similarity_search

logger = get_logger(__name__)


async def retrieve_kb_chunks(
    kb_id: str,
    query: str,
    top_k: int,
) -> list[tuple[Document, float]]:
    """先向量召回较多候选，再按需 gte-rerank，截断为 top_k。"""
    s = get_settings()
    k = max(1, min(int(top_k), 20))

    if s.rerank_enabled:
        mult = max(2, s.rerank_candidate_multiplier)
        fetch_n = min(max(k * mult, k + 5), s.rerank_max_candidates)
    else:
        fetch_n = k

    pairs = await vector_similarity_search(kb_id, query, fetch_n)
    if not pairs:
        return []

    if not s.rerank_enabled or len(pairs) <= k:
        return pairs[:k]

    return await rerank_document_pairs(query, pairs, k)
