"""方剂推荐打分与格式（无数据库）。"""

from types import SimpleNamespace

from app.agent.tools.formula.service import _format_formula_block, _score_row


def test_score_row_matches_keywords():
    row = SimpleNamespace(
        symptom_keywords=["口苦", "咽干"],
        pattern_tags=["少阳证"],
        indications="往来寒热",
        efficacy="和解少阳",
    )
    assert _score_row(row, "口苦咽干不想吃饭", None) > 0
    assert _score_row(row, "往来寒热胸胁苦满", "少阳证") > _score_row(row, "无关描述", None)


def test_format_block_contains_disclaimer():
    row = SimpleNamespace(
        name="测试方",
        aliases=[],
        composition="药A、药B",
        efficacy="测试功效",
        indications="测试主治",
        pattern_tags=["测试证型"],
        symptom_keywords=[],
        source_ref="",
    )
    text = _format_formula_block(row)
    assert "测试方" in text
    assert "学习参考" in text or "不构成" in text
