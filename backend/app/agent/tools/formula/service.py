"""方剂查询与症状/证型推荐逻辑。"""

from __future__ import annotations

import uuid
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.agent.tools.formula.models import FormulaRecord

_NS = uuid.UUID("6ba7b810-9dad-11d1-80b4-00c04fd430c8")


def _stable_id(name: str) -> str:
    return str(uuid.uuid5(_NS, name.strip()))


def _as_str_list(raw: Any) -> list[str]:
    if not isinstance(raw, list):
        return []
    return [str(x).strip() for x in raw if str(x).strip()]


def _format_formula_block(row: FormulaRecord, rank: int | None = None) -> str:
    head = f"【{row.name}】"
    if rank is not None:
        head = f"[{rank}] {head}"
    aliases = _as_str_list(row.aliases)
    alias_line = f"别名：{'、'.join(aliases)}" if aliases else ""
    patterns = _as_str_list(row.pattern_tags)
    pat_line = f"常见证型/病机标签：{'、'.join(patterns)}" if patterns else ""
    src = (row.source_ref or "").strip()
    src_line = f"文献出处：{src}" if src else ""
    parts = [
        head,
        f"组成：{row.composition.strip()}",
        f"功效：{row.efficacy.strip()}",
        f"主治：{row.indications.strip()}",
    ]
    if alias_line:
        parts.append(alias_line)
    if pat_line:
        parts.append(pat_line)
    if src_line:
        parts.append(src_line)
    parts.append(
        "（以上内容仅供中医药文化与知识学习参考，不构成诊疗方案，不适请就医。）"
    )
    return "\n".join(parts)


async def lookup_formula_by_name(session: AsyncSession, formula_name: str) -> str:
    q = (formula_name or "").strip()
    if not q:
        return "请提供方剂名称。"

    r = await session.execute(
        select(FormulaRecord).where(FormulaRecord.name.ilike(f"%{q}%"))
    )
    by_id: dict[str, FormulaRecord] = {row.id: row for row in r.scalars().all()}
    if not by_id:
        r2 = await session.execute(select(FormulaRecord))
        for row in r2.scalars().all():
            for al in _as_str_list(row.aliases):
                if q in al or al in q:
                    by_id[row.id] = row
                    break
    rows = list(by_id.values())
    if not rows:
        return (
            f"未在本地方剂库中找到与「{q}」匹配的条目。"
            "可尝试更常用的方名，或使用 recommend_formulas 按症状/证型检索。"
        )

    if len(rows) > 1:
        lines = [f"找到 {len(rows)} 条相关方剂，请择一参考或缩小方名："]
        for i, row in enumerate(rows[:8], start=1):
            lines.append(_format_formula_block(row, rank=i))
        if len(rows) > 8:
            lines.append(f"... 另有 {len(rows) - 8} 条未列出。")
        return "\n\n".join(lines)

    return _format_formula_block(rows[0])


def _score_row(row: FormulaRecord, query: str, pattern_hint: str | None) -> float:
    q = (query or "").strip()
    hint = (pattern_hint or "").strip()
    score = 0.0
    for kw in _as_str_list(row.symptom_keywords):
        if kw and kw in q:
            score += 2.0
    for kw in _as_str_list(row.pattern_tags):
        if kw and (kw in q or (hint and (kw in hint or hint in kw))):
            score += 2.5
    if hint:
        for kw in _as_str_list(row.pattern_tags):
            if kw and kw in hint:
                score += 3.0
    # 主治、功效中的子串弱匹配
    blob = f"{row.indications}{row.efficacy}"
    if hint and hint in blob:
        score += 1.0
    for seg in (row.indications, row.efficacy):
        for i in range(0, len(q) - 1, 2):
            chunk = q[i : i + 4]
            if len(chunk) >= 2 and chunk in seg:
                score += 0.3
    return score


async def recommend_formulas_for_clinical(
    session: AsyncSession,
    clinical_query: str,
    pattern_type: str | None,
    top_k: int,
) -> str:
    q = (clinical_query or "").strip()
    if len(q) < 2:
        return "请用一两句话描述症状、体征或就诊诉求，便于检索相关方剂（仅供学习参考）。"

    r = await session.execute(select(FormulaRecord))
    rows = list(r.scalars().all())
    if not rows:
        return (
            "本地方剂库暂无数据。请由运维执行种子导入或检查数据库迁移。"
        )

    k = max(1, min(int(top_k), 15))
    scored: list[tuple[float, FormulaRecord]] = []
    for row in rows:
        s = _score_row(row, q, pattern_type)
        if s > 0:
            scored.append((s, row))

    scored.sort(key=lambda x: (-x[0], x[1].name))
    if not scored:
        # 弱兜底：按主治文本包含查询中任意连续2字
        fallback: list[tuple[float, FormulaRecord]] = []
        for row in rows:
            hit = 0.0
            for i in range(len(q) - 1):
                bi = q[i : i + 2]
                if bi and bi in row.indications:
                    hit += 0.5
            if hit > 0:
                fallback.append((hit, row))
        fallback.sort(key=lambda x: -x[0])
        scored = fallback[:k]

    if not scored:
        return (
            f"根据描述「{q[:80]}」未匹配到高相关方剂条目。"
            "可补充证型、舌苔脉象或改用更典型症状关键词后再试。"
        )

    lines = [
        f"按症状/证型线索从本地方剂库推荐以下条目（相关性仅供参考，不可替代医师辨证）：",
        "",
    ]
    for i, (sc, row) in enumerate(scored[:k], start=1):
        lines.append(_format_formula_block(row, rank=i))
        lines.append("")
    return "\n".join(lines).strip()
