"""通义千问（DashScope）LLM 与 Embedding 提供者。

对话模型使用 OpenAI 兼容接口，向量模型使用 DashScope 原生 SDK。
"""

from langchain_community.embeddings import DashScopeEmbeddings
from langchain_openai import ChatOpenAI

from app.core.config import get_settings

# 嵌入模型按「Key + 模型名」指纹缓存，避免每次检索新建客户端；配置变更后自动换新实例
_emb_fp: str | None = None
_emb_singleton: DashScopeEmbeddings | None = None


def build_qwen_chat() -> ChatOpenAI:
    s = get_settings()
    key = (s.dashscope_api_key or "").strip()
    if not key:
        raise ValueError("llm_provider=qwen 时请配置 DASHSCOPE_API_KEY")
    return ChatOpenAI(
        model=s.qwen_chat_model,
        api_key=key,
        base_url=s.dashscope_base_url,
        temperature=0.2,
    )


def get_embeddings() -> DashScopeEmbeddings:
    global _emb_fp, _emb_singleton
    s = get_settings()
    key = (s.dashscope_api_key or "").strip()
    if not key:
        raise ValueError("知识库向量嵌入需要 DASHSCOPE_API_KEY（DashScope 嵌入模型）")
    fp = f"{key}|{s.qwen_embedding_model}"
    if _emb_singleton is not None and fp == _emb_fp:
        return _emb_singleton
    _emb_singleton = DashScopeEmbeddings(
        model=s.qwen_embedding_model,
        dashscope_api_key=key,
    )
    _emb_fp = fp
    return _emb_singleton
