"""知识库管理 API 的请求/响应模型。"""

from typing import Any

from pydantic import BaseModel, Field


class DocumentMetadata(BaseModel):
    source: str = Field(..., description="原始文件名或来源标识")
    chunk_count: int = Field(default=0, description="已索引分块数量")


class KnowledgeBaseResponse(BaseModel):
    id: str
    owner_id: str = Field(..., description="所属用户 ID")
    name: str
    description: str
    document_count: int
    embedding_provider: str | None = Field(
        default=None,
        description="知识库首次入库时记录的嵌入厂商，例如 qwen / openai；老库可能为空",
    )
    embedding_model: str | None = Field(
        default=None,
        description="知识库首次入库时记录的嵌入模型名；老库可能为空",
    )
    embedding_dim: int | None = Field(
        default=None,
        description="知识库首次入库时记录的向量维度；老库可能为空",
    )
    metadata: dict = Field(default_factory=dict)


class KnowledgeBaseCreateRequest(BaseModel):
    name: str = Field(..., min_length=1, description="知识库名称")
    description: str = Field(default="", description="知识库说明")


class KnowledgeBaseUpdateRequest(BaseModel):
    """部分更新知识库元数据；仅传入字段会被写入。"""

    name: str | None = Field(default=None, min_length=1, max_length=255)
    description: str | None = Field(default=None, max_length=2000)


class KnowledgeBaseListResponse(BaseModel):
    knowledge_bases: list[KnowledgeBaseResponse]
    total: int


class IngestResponse(BaseModel):
    kb_id: str
    filename: str
    chunk_count: int
    message: str


class IngestJobCreateResponse(BaseModel):
    job_id: str
    status: str = "pending"
    celery_task_id: str | None = Field(
        default=None,
        description="Celery 任务 ID（仅 celery_ingest_enabled=true 时有值）",
    )


class IngestJobStatusResponse(BaseModel):
    job_id: str
    status: str
    result: dict[str, Any] | None = None
    error: str | None = None


class SearchRequest(BaseModel):
    query: str = Field(..., min_length=1, description="检索问题")
    top_k: int = Field(default=5, ge=1, le=20, description="返回片段数量")


class SearchResult(BaseModel):
    content: str
    source: str
    score: float = Field(
        ...,
        description="相关度分数：开启重排时为模型相关分（通常越大越好）；仅向量时为距离/相似度（依 Qdrant 度量）",
    )


class SearchResponse(BaseModel):
    results: list[SearchResult]
    query: str


class KnowledgeDocumentResponse(BaseModel):
    """单个已入库文档的元数据视图。"""

    id: str
    kb_id: str
    filename: str
    chunk_count: int
    file_size: int
    created_at: str = Field(..., description="ISO8601 时间字符串")


class KnowledgeDocumentListResponse(BaseModel):
    documents: list[KnowledgeDocumentResponse]
    total: int
