"""从内置 JSON 种子导入方剂（幂等）。"""

from __future__ import annotations

import json
from pathlib import Path

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.agent.tools.formula.models import FormulaRecord
from app.agent.tools.formula.service import _stable_id
from app.core.logging import get_logger

logger = get_logger(__name__)

# backend/data/formulas_seed.json（相对本文件：formula → tools → agent → app → backend）
_SEED_PATH = (
    Path(__file__).resolve().parent.parent.parent.parent.parent
    / "data"
    / "formulas_seed.json"
)


async def seed_formulas_if_empty(session: AsyncSession) -> int:
    """若 `formulas` 表为空则加载种子数据。返回新增条数。"""
    n = await session.scalar(select(func.count()).select_from(FormulaRecord))
    if (n or 0) > 0:
        return 0

    if not _SEED_PATH.is_file():
        logger.warning("方剂种子文件不存在: %s，跳过导入", _SEED_PATH)
        return 0

    raw = json.loads(_SEED_PATH.read_text(encoding="utf-8"))
    if not isinstance(raw, list):
        logger.warning("方剂种子格式应为 JSON 数组，跳过导入")
        return 0

    added = 0
    for item in raw:
        if not isinstance(item, dict):
            continue
        name = str(item.get("name", "")).strip()
        if not name:
            continue
        fid = str(item.get("id", "") or "").strip() or _stable_id(name)
        row = FormulaRecord(
            id=fid,
            name=name,
            aliases=item.get("aliases") or [],
            composition=str(item.get("composition", "")),
            efficacy=str(item.get("efficacy", "")),
            indications=str(item.get("indications", "")),
            pattern_tags=item.get("pattern_tags") or [],
            symptom_keywords=item.get("symptom_keywords") or [],
            source_ref=str(item.get("source_ref", "")),
        )
        session.add(row)
        added += 1

    if added:
        await session.flush()
        logger.info("已导入方剂种子 %s 条", added)
    return added
