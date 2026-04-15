"""Qdrant 向量库适配器。

每个知识库对应一个 collection，命名：`kb_<uuid>`（连字符替换为下划线）。
"""

from functools import lru_cache

from langchain_core.documents import Document
from langchain_qdrant import QdrantVectorStore
from qdrant_client import QdrantClient
from qdrant_client.http import models as qmodels

from app.core.config import get_settings
from app.core.logging import get_logger
from app.llm.registry import get_embeddings

logger = get_logger(__name__)


@lru_cache(maxsize=8)
def _qdrant_client_for_url(qdrant_url: str) -> QdrantClient:
    # 与 docker 内 Qdrant 主版本可能不一致时仅告警，不阻断
    return QdrantClient(url=qdrant_url, check_compatibility=False)


def _qdrant_client() -> QdrantClient:
    return _qdrant_client_for_url(get_settings().qdrant_url)


def _collection_name(kb_id: str) -> str:
    return f"kb_{kb_id.replace('-', '_')}"


def _vector_store(kb_id: str) -> QdrantVectorStore:
    # 首次入库前 collection 可能尚未创建，关闭启动时校验
    return QdrantVectorStore(
        client=_qdrant_client(),
        collection_name=_collection_name(kb_id),
        embedding=get_embeddings(),
        validate_collection_config=False,
    )


def _ensure_collection(kb_id: str) -> None:
    """若 Qdrant 中尚无该知识库 collection，则按当前嵌入维度创建（Cosine）。"""
    client = _qdrant_client()
    name = _collection_name(kb_id)
    if client.collection_exists(collection_name=name):
        return
    emb = get_embeddings()
    dim = len(emb.embed_query("ping"))
    client.create_collection(
        collection_name=name,
        vectors_config=qmodels.VectorParams(size=dim, distance=qmodels.Distance.COSINE),
    )
    logger.info("qdrant created collection=%s dim=%s", name, dim)


async def upsert_documents(kb_id: str, documents: list[Document]) -> int:
    """写入分块文档（由 Qdrant 调用嵌入模型生成向量）。"""
    if not documents:
        return 0
    _ensure_collection(kb_id)
    store = _vector_store(kb_id)
    await store.aadd_documents(documents)
    logger.info("qdrant upsert kb_id=%s chunks=%d", kb_id, len(documents))
    return len(documents)


async def similarity_search(
    kb_id: str, query: str, top_k: int = 5
) -> list[tuple[Document, float]]:
    """语义检索，返回 (Document, score)；score 越小通常表示越相似（取决于距离度量）。"""
    store = _vector_store(kb_id)
    try:
        pairs = await store.asimilarity_search_with_score(query, k=top_k)
    except Exception as exc:
        logger.warning("qdrant search kb_id=%s: %s", kb_id, exc)
        return []
    return pairs


async def delete_kb_vectors(kb_id: str) -> None:
    """删除知识库对应的 Qdrant collection。"""
    name = _collection_name(kb_id)
    client = _qdrant_client()
    if not client.collection_exists(collection_name=name):
        logger.debug("qdrant collection absent, skip: %s", name)
        return
    client.delete_collection(collection_name=name)
    logger.info("qdrant deleted collection=%s", name)
