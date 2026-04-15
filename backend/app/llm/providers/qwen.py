"""通义千问（DashScope）LLM 与 Embedding 提供者。

对话模型使用 OpenAI 兼容接口，向量模型使用 DashScope 原生 SDK。
"""

from functools import lru_cache

from langchain_community.embeddings import DashScopeEmbeddings
from langchain_openai import ChatOpenAI

from app.core.config import get_settings


@lru_cache
def get_chat_model() -> ChatOpenAI:
    s = get_settings()
    return ChatOpenAI(
        model=s.qwen_chat_model,
        api_key=s.dashscope_api_key,
        base_url=s.dashscope_base_url,
        temperature=0.2,
    )


@lru_cache
def get_embeddings() -> DashScopeEmbeddings:
    s = get_settings()
    return DashScopeEmbeddings(
        model=s.qwen_embedding_model,
        dashscope_api_key=s.dashscope_api_key,
    )
