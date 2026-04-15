"""方剂 ORM。"""

from sqlalchemy import String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class FormulaRecord(Base):
    """经典方剂条目；用于方名检索与症状/证型推荐。"""

    __tablename__ = "formulas"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    name: Mapped[str] = mapped_column(String(128))
    aliases: Mapped[list] = mapped_column(JSONB, default=list)
    composition: Mapped[str] = mapped_column(Text)
    efficacy: Mapped[str] = mapped_column(Text)
    indications: Mapped[str] = mapped_column(Text)
    pattern_tags: Mapped[list] = mapped_column(JSONB, default=list)
    symptom_keywords: Mapped[list] = mapped_column(JSONB, default=list)
    source_ref: Mapped[str] = mapped_column(String(256), default="")
