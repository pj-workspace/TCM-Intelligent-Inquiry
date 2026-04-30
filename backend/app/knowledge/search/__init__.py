"""语义检索：Qdrant 向量库、召回与重排序。"""

from app.knowledge.search.retrieval import retrieve_kb_chunks
from app.knowledge.search.vectorstore import VectorStoreUnavailable

__all__ = ["VectorStoreUnavailable", "retrieve_kb_chunks"]
