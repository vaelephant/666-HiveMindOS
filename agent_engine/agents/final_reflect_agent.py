"""FinalReflect — 生成任务收尾 Markdown 报告与总分。"""

from __future__ import annotations

import json
import re

from memory_layer.knowledge_base import config
from memory_layer.knowledge_base.app.logging_config import get_logger
from agent_engine.domain.rubric import format_rubric_for_prompt, load_rubric
from memory_layer.knowledge_base.core.parsers.llm_json import parse_json_object
from memory_layer.knowledge_base.prompts import get, render
from model_layer import client as llm

log = get_logger("hivemind.agent.final_reflect")

_FINAL = get("agents.final_reflect")


def _extract_score(text: str) -> int:
    matches = re.findall(r'\{[^{}]*"score"\s*:\s*(\d+)[^{}]*\}', text)
    if matches:
        return min(100, max(0, int(matches[-1])))
    return 75


def _fallback_report(goal: str, steps: list[dict], reflections: list[dict], score: int) -> str:
    lines = [f"# 任务执行报告\n", f"**目标：** {goal}\n", f"**总分：** {score}\n", "## 执行摘要\n"]
    for s in steps:
        lines.append(f"- **{s.get('task_id')}** `{s.get('action')}` — {s.get('status')}")
        ref = s.get("reflection") or {}
        if ref.get("reason"):
            lines.append(f"  - {ref['reason']}")
    if reflections:
        problems = []
        for r in reflections:
            problems.extend(r.get("problems") or [])
        if problems:
            lines.append("\n## 待关注\n")
            for p in problems:
                lines.append(f"- {p}")
    return "\n".join(lines)


class FinalReflectAgent:
    def run(
        self,
        *,
        goal: str,
        success_criteria: list[str],
        steps: list[dict],
        reflections: list[dict],
        rubric_id: str,
    ) -> tuple[str, int]:
        rubric = load_rubric(rubric_id)
        summary = json.dumps(
            {"steps": steps, "reflections": reflections},
            ensure_ascii=False,
        )[:12000]

        try:
            prompt = render(
                "agents.final_reflect",
                goal=goal,
                success_criteria=json.dumps(success_criteria, ensure_ascii=False),
                execution_summary=summary,
                rubric=format_rubric_for_prompt(rubric),
            )
            report = llm.complete(prompt, system=_FINAL.system, model=_FINAL.resolve_model(config))
            score = _extract_score(report)
            report = report.strip()
            report = re.sub(r'```json\s*\{[^{}]*"score"[^`]*```\s*$', "", report, flags=re.DOTALL)
            report = re.sub(r'\{[^{}]*"score"\s*:\s*\d+[^{}]*\}\s*$', "", report.strip())
            return report, score
        except Exception as exc:
            log.warning("[final_reflect] LLM failed: %s", exc)
            refl_scores = [int(r.get("score") or 70) for r in reflections if isinstance(r, dict)]
            score = sum(refl_scores) // max(len(refl_scores), 1) if refl_scores else 70
            return _fallback_report(goal, steps, reflections, score), score
