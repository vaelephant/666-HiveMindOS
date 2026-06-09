"""任务 Rubric — 企业标准外置，Agent 按表检查。"""

from __future__ import annotations

from functools import lru_cache
from pathlib import Path

import yaml

_RUBRICS_DIR = Path(__file__).resolve().parents[1] / "settings" / "rubrics"


@lru_cache(maxsize=16)
def load_rubric(rubric_id: str) -> dict:
    path = _RUBRICS_DIR / f"{rubric_id}.yaml"
    if not path.is_file():
        path = _RUBRICS_DIR / "generic_goal.yaml"
    data = yaml.safe_load(path.read_text(encoding="utf-8")) or {}
    return data


def match_task_type(goal: str) -> str:
    g = goal.lower()
    if any(k in g for k in ("wiki", "整理", "决策", "decision", "编译")):
        return "wiki_organize_decisions"
    if any(k in g for k in ("销售方案", "客户分析", "客户公司", "销售")):
        return "sales_proposal"
    return "generic_goal"


def format_rubric_for_prompt(rubric: dict) -> str:
    lines = [
        f"任务类型: {rubric.get('label', rubric.get('task_type'))}",
        f"通过分数: {rubric.get('pass_score', 70)}",
        "评分维度:",
    ]
    for c in rubric.get("criteria") or []:
        lines.append(f"- {c.get('name')} (权重{c.get('weight', 0)}): {c.get('check', '')}")
    return "\n".join(lines)


def reload_rubrics() -> None:
    load_rubric.cache_clear()
