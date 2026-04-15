"""LLM 注册表：统一入口，屏蔽底层 provider 差异。

新增厂商：在 `app/llm/chat_factory.py` 的 `build_chat_model` 中增加分支，
并在 `Settings` / `.env` 中增加对应 API Key 与模型名。

向量嵌入与 `llm_provider` 对齐：`qwen` 使用 DashScope，`openai` 使用 OpenAI Embeddings；
其他对话厂商若未单独配置嵌入，请在知识库场景下改用 `qwen` 或 `openai`。
"""

from langchain_core.embeddings import Embeddings
from langchain_core.language_models.chat_models import BaseChatModel

from app.core.config import get_settings


def get_chat_model() -> BaseChatModel:
    """按当前配置构造对话模型（无进程级缓存，改 .env 后下一轮请求生效）。"""
    from app.llm.chat_factory import build_chat_model

    return build_chat_model()


def get_embeddings() -> Embeddings:
    """按当前 `llm_provider` 构造向量嵌入客户端。"""
    s = get_settings()
    p = (s.llm_provider or "qwen").strip().lower()

    if p == "qwen":
        from app.llm.providers.qwen import get_embeddings as _qwen_emb

        return _qwen_emb()

    if p == "openai":
        from langchain_openai import OpenAIEmbeddings

        key = (s.openai_api_key or "").strip()
        if not key:
            raise ValueError("llm_provider=openai 时请配置 OPENAI_API_KEY（知识库向量嵌入）")
        base = (s.openai_base_url or "").strip() or "https://api.openai.com/v1"
        return OpenAIEmbeddings(
            model=s.openai_embedding_model,
            api_key=key,
            base_url=base.rstrip("/"),
        )

    raise ValueError(
        f"当前 llm_provider={p!r} 未配置向量嵌入实现，知识库请使用 llm_provider=qwen 或 openai"
    )
