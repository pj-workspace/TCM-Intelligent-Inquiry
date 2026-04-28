"""知识库 ORM 模型（PostgreSQL）。"""

from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class KnowledgeBaseRecord(Base):
    """知识库元数据表；向量内容在 Qdrant 中按 collection `kb_<id>` 存储。

    新增 `embedding_provider/model/dim` 用于校验后续入库与检索使用的嵌入模型一致；
    这三个字段对老库为空（dev 模式下 `metadata.create_all` 不会自动 ALTER，需要在
    `app.core.database.init_db` 中执行轻量自动迁移补列）。
    """

    __tablename__ = "knowledge_bases"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    owner_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(255))
    description: Mapped[str] = mapped_column(Text, default="")
    document_count: Mapped[int] = mapped_column(Integer, default=0)

    # 嵌入指纹（首次入库时写入；后续入库与检索若与当前配置不一致则拒绝）
    embedding_provider: Mapped[str | None] = mapped_column(String(50), nullable=True)
    embedding_model: Mapped[str | None] = mapped_column(String(120), nullable=True)
    embedding_dim: Mapped[int | None] = mapped_column(Integer, nullable=True)


class KnowledgeDocumentRecord(Base):
    """知识库文档记录：每次成功入库的文件对应一行；删除时联动 Qdrant 中归属向量。"""

    __tablename__ = "kb_documents"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    kb_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("knowledge_bases.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    filename: Mapped[str] = mapped_column(String(500))
    chunk_count: Mapped[int] = mapped_column(Integer, default=0)
    file_size: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
