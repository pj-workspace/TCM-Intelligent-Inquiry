"""中医文档智能分块策略。

中医文献（如《伤寒论》《本草纲目》）有独特结构，不宜按固定字数切割：
- 条文型文献：按条文编号/段落分割
- 本草类文献：按药材条目分割
- 现代医书：按章节/标题分割

当前为递归字符分块兜底，后续可按文献类型扩展。
"""

from langchain_core.documents import Document
from langchain_text_splitters import RecursiveCharacterTextSplitter

# 中医文献常见分隔符优先级（从粗到细）
_TCM_SEPARATORS = [
    "\n## ",    # 二级标题
    "\n# ",     # 一级标题
    "\n【",     # 条目起始（如【主治】）
    "\n第",     # 章节（如第一章）
    "。\n",     # 句末换行
    "。",       # 句号
    "\n",
    " ",
    "",
]


def chunk_documents(
    docs: list[Document],
    chunk_size: int = 512,
    chunk_overlap: int = 64,
) -> list[Document]:
    """将文档列表切分为适合向量索引的小块。"""
    splitter = RecursiveCharacterTextSplitter(
        separators=_TCM_SEPARATORS,
        chunk_size=chunk_size,
        chunk_overlap=chunk_overlap,
        length_function=len,
    )
    return splitter.split_documents(docs)
