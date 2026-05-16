"""LLM 注册表：统一入口，屏蔽底层 provider 差异。

新增厂商：在 `app/llm/chat_factory.py` 的 `build_chat_model` 中增加分支，
并在 `Settings` / `.env` 中增加对应 API Key 与模型名。

向量嵌入由 `embedding_provider` 决定；留空时：
- `llm_provider` 为 qwen/openai 时与其一致；
- 为 deepseek/glm/anthropic 时自动选用 qwen（若已配置 DASHSCOPE_API_KEY）或 openai（若已配置 OPENAI_API_KEY），
  否则仍走 qwen 并由底层校验 Key。
仅实现 `qwen`（DashScope）与 `openai`（OpenAI Embeddings）。
"""

from langchain_core.embeddings import Embeddings
from langchain_core.language_models.chat_models import BaseChatModel

from app.core.config import get_settings


def resolved_embedding_provider() -> str:
    """解析实际用于知识库向量嵌入的厂商 id（qwen | openai）。"""
    s = get_settings()
    raw = (s.embedding_provider or "").strip().lower()
    if raw:
        return raw
    lp = (s.llm_provider or "qwen").strip().lower()
    if lp in ("qwen", "openai"):
        return lp
    if lp in ("deepseek", "anthropic", "glm"):
        if (s.dashscope_api_key or "").strip():
            return "qwen"
        if (s.openai_api_key or "").strip():
            return "openai"
        return "qwen"
    return lp


def get_chat_model(
    enable_thinking: bool = False,
    chat_model_override: str | None = None,
    *,
    llm_provider: str | None = None,
) -> BaseChatModel:
    """按当前配置构造对话模型（无进程级缓存，改 .env 后下一轮请求生效）。

    enable_thinking: True 时对支持思考通道的模型注入厂商特定参数（如 Qwen extra_body、DeepSeek thinking）。
    chat_model_override: qwen / deepseek 等为具体 model id；不传则用各厂商默认主模型。
    llm_provider: 显式指定厂商（与 Settings.llm_provider 无关）；None 时使用 Settings。
    """
    from app.llm.chat_factory import build_chat_model

    return build_chat_model(
        enable_thinking=enable_thinking,
        chat_model_override=chat_model_override,
        llm_provider=llm_provider,
    )


def get_embeddings() -> Embeddings:
    """构造向量嵌入客户端（厂商由 `resolved_embedding_provider()` 决定）。"""
    s = get_settings()
    p = resolved_embedding_provider()

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
        f"当前 embedding 厂商={p!r} 未实现向量嵌入，请在 EMBEDDING_PROVIDER 或 LLM_PROVIDER 中使用 qwen 或 openai"
    )
