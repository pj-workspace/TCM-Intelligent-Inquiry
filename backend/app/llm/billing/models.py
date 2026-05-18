"""用量事件与余额快照 ORM。"""

from __future__ import annotations

from datetime import datetime
from typing import Any

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class LlmUsageEventRecord(Base):
    """单次上游 Chat Completion 用量（与 SSE llm-usage 一一对应）。"""

    __tablename__ = "llm_usage_events"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
    )
    user_id: Mapped[str | None] = mapped_column(
        String(36),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    conversation_id: Mapped[str | None] = mapped_column(
        String(36),
        ForeignKey("conversations.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    provider_id: Mapped[str] = mapped_column(String(32), nullable=False, index=True)
    chat_model: Mapped[str | None] = mapped_column(String(256), nullable=True)
    graph_run_id: Mapped[str | None] = mapped_column(String(128), nullable=True)

    prompt_tokens: Mapped[int | None] = mapped_column(Integer, nullable=True)
    completion_tokens: Mapped[int | None] = mapped_column(Integer, nullable=True)
    total_tokens: Mapped[int | None] = mapped_column(Integer, nullable=True)
    reasoning_tokens: Mapped[int | None] = mapped_column(Integer, nullable=True)
    cached_prompt_tokens: Mapped[int | None] = mapped_column(Integer, nullable=True)

    usage_raw: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False)
    usage_normalized: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False)


class ProviderBalanceSnapshotRecord(Base):
    """余额查询成功快照（审计）。"""

    __tablename__ = "provider_balance_snapshots"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
    )
    provider_id: Mapped[str] = mapped_column(String(32), nullable=False, index=True)
    fetched_by_user_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    is_available: Mapped[bool | None] = mapped_column(Boolean, nullable=True)
    payload: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False)
