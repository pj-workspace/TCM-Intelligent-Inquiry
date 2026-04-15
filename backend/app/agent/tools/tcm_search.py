"""中医知识检索工具（当前为骨架，后续接入向量库）。"""

from langchain_core.tools import tool

from app.agent.tools.registry import tool_registry
from app.llm.registry import get_embeddings


@tool_registry.register
@tool
def search_tcm_knowledge(query: str) -> str:
    """检索中医知识库，返回与查询最相关的文献片段。

    当前为骨架：验证千问向量编码可用性，尚未接入真实文档索引。
    """
    query = query.strip()
    if not query:
        return "请提供有效的检索内容。"
    emb = get_embeddings()
    vec = emb.embed_query(query)
    return (
        "（骨架提示）知识库尚未导入文档；已使用通义千问向量模型对查询编码。"
        f" 向量维度: {len(vec)}。后续可在此接入 Qdrant 等向量库。"
    )
