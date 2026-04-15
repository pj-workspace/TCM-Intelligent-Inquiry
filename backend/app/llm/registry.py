"""LLM 注册表：统一入口，屏蔽底层 provider 差异。

新增厂商：在 `app/llm/chat_factory.py` 的 `build_chat_model` 中增加分支，
并在 `Settings` / `.env` 中增加对应 API Key 与模型名。
"""

from langchain_community.embeddings import DashScopeEmbeddings
from langchain_core.language_models.chat_models import BaseChatModel


def get_chat_model() -> BaseChatModel:
    """按当前配置构造对话模型（无进程级缓存，改 .env 后下一轮请求生效）。"""
    from app.llm.chat_factory import build_chat_model

    return build_chat_model()


def get_embeddings() -> DashScopeEmbeddings:
    from app.llm.providers.qwen import get_embeddings as _qwen_emb

    return _qwen_emb()
