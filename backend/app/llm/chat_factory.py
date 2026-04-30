"""按配置组装对话模型（多厂商）。"""

from langchain_core.language_models.chat_models import BaseChatModel
from langchain_openai import ChatOpenAI

from app.core.config import get_settings


def build_chat_model(
    enable_thinking: bool = False,
    chat_model_override: str | None = None,
) -> BaseChatModel:
    s = get_settings()
    p = (s.llm_provider or "qwen").strip().lower()

    if p == "qwen":
        from app.llm.providers.qwen import build_qwen_chat

        return build_qwen_chat(
            enable_thinking=enable_thinking,
            chat_model_override=chat_model_override,
        )

    if p == "openai":
        key = (s.openai_api_key or "").strip()
        if not key:
            raise ValueError("llm_provider=openai 时请配置 OPENAI_API_KEY")
        base = (s.openai_base_url or "").strip() or "https://api.openai.com/v1"
        return ChatOpenAI(
            model=s.openai_chat_model,
            api_key=key,
            base_url=base.rstrip("/"),
            temperature=0.2,
        )

    if p == "anthropic":
        from langchain_anthropic import ChatAnthropic

        key = (s.anthropic_api_key or "").strip()
        if not key:
            raise ValueError("llm_provider=anthropic 时请配置 ANTHROPIC_API_KEY")
        if enable_thinking:
            # Claude extended thinking 要求 temperature=1，budget_tokens 建议 ≥ 1024
            return ChatAnthropic(
                model=s.anthropic_chat_model,
                api_key=key,
                temperature=1,
                thinking={"type": "enabled", "budget_tokens": 8000},
            )
        return ChatAnthropic(
            model=s.anthropic_chat_model,
            api_key=key,
            temperature=0.2,
        )

    if p == "glm":
        key = (s.zhipu_api_key or "").strip()
        if not key:
            raise ValueError("llm_provider=glm 时请配置 ZHIPU_API_KEY（智谱 AI）")
        base = (s.glm_base_url or "").strip() or "https://open.bigmodel.cn/api/paas/v4"
        return ChatOpenAI(
            model=s.glm_chat_model,
            api_key=key,
            base_url=base.rstrip("/"),
            temperature=0.2,
        )

    if p == "deepseek":
        key = (s.deepseek_api_key or "").strip()
        if not key:
            raise ValueError("llm_provider=deepseek 时请配置 DEEPSEEK_API_KEY")
        base = (s.deepseek_base_url or "").strip() or "https://api.deepseek.com/v1"
        # deepseek-reasoner 是独立的推理模型，深度思考时自动切换
        model = "deepseek-reasoner" if enable_thinking else s.deepseek_chat_model
        return ChatOpenAI(
            model=model,
            api_key=key,
            base_url=base.rstrip("/"),
            temperature=0.2,
        )

    raise ValueError(
        f"不支持的 llm_provider: {p!r}，可选: qwen, openai, anthropic, glm, deepseek"
    )
