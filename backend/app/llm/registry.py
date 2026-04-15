"""LLM 注册表：统一入口，屏蔽底层 provider 差异。

新增 provider 只需：
  1. 在 app/llm/providers/ 下添加对应文件
  2. 在 Settings 里加 llm_provider 字段
  3. 在此处 match 分支中注册

其他业务域只需 from app.llm.registry import get_chat_model, get_embeddings。
"""

from langchain_community.embeddings import DashScopeEmbeddings
from langchain_openai import ChatOpenAI


def get_chat_model() -> ChatOpenAI:
    from app.llm.providers.qwen import get_chat_model as _qwen_chat

    return _qwen_chat()


def get_embeddings() -> DashScopeEmbeddings:
    from app.llm.providers.qwen import get_embeddings as _qwen_emb

    return _qwen_emb()
