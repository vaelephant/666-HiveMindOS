"""从执行步骤中提取用户-facing 交付物（与 FinalReflect 复盘报告分离）。"""

from __future__ import annotations

import ast
import json
import re


def _text_from_step(step: dict) -> str | None:
    summary = step.get("result_summary") or {}
    if isinstance(summary, dict) and summary.get("text"):
        return str(summary["text"]).strip()

    raw = step.get("result_raw") or ""
    if not raw:
        return None
    for parser in (json.loads, ast.literal_eval):
        try:
            data = parser(raw)
            if isinstance(data, dict) and data.get("text"):
                return str(data["text"]).strip()
        except (json.JSONDecodeError, SyntaxError, ValueError, TypeError):
            continue
    return None


def _wiki_deliverable_markdown(goal: str, steps: list[dict]) -> str | None:
    lines = [f"# {goal}", "", "## Wiki 变更摘要", ""]
    found = False
    for step in steps:
        if step.get("action") != "compile_candidates":
            continue
        summary = step.get("result_summary") or {}
        items = summary.get("items") or []
        merged = int(summary.get("merged") or 0)
        if merged or items:
            found = True
            lines.append(f"- 编译 {summary.get('compiled', len(items))} 条候选，写入 Wiki {merged} 条")
            for it in items[:20]:
                if isinstance(it, dict) and it.get("title"):
                    lines.append(f"  - {it.get('title')}")
    return "\n".join(lines) if found else None


def extract_deliverable(
    goal: str,
    steps: list[dict],
    task_type: str = "generic_goal",
    checkpoints: dict | None = None,
) -> str | None:
    """
    优先取最后一次 llm_generate 的正文作为交付物。
    Wiki 整理类任务则生成变更摘要。
    """
    if checkpoints and checkpoints.get("_deliverable"):
        text = str(checkpoints["_deliverable"]).strip()
        if len(text) > 80:
            if text.lstrip().startswith("#"):
                return text
            return f"# {goal}\n\n{text}"

    for step in reversed(steps):
        if step.get("status") not in (None, "done", "skipped"):
            continue
        if step.get("action") != "llm_generate":
            continue
        text = _text_from_step(step)
        if text and len(text) > 80:
            if text.lstrip().startswith("#"):
                return text
            title = (step.get("name") or goal).strip()
            return f"# {title}\n\n{text}"

    if task_type == "wiki_organize_decisions":
        return _wiki_deliverable_markdown(goal, steps)

    return None
