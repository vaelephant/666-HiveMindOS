"""Convert high-score task experiences to agentskills.io SKILL.md files."""

from __future__ import annotations

import re
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from shared import config
from server.logging_config import get_logger

log = get_logger("hivemind.skills")


def _slug(text: str, max_len: int = 48) -> str:
    s = re.sub(r"[^\w\u4e00-\u9fff]+", "-", text.strip().lower())
    s = re.sub(r"-+", "-", s).strip("-")
    return (s[:max_len] or "task-skill").rstrip("-")


def skills_root(org_id: str) -> Path:
    root = config.SKILLS_ROOT / org_id
    root.mkdir(parents=True, exist_ok=True)
    return root


def experience_to_skill_md(
    *,
    task_type: str,
    goal: str,
    score: int,
    workflow: list | dict,
    reflection: dict | None = None,
    final_output: str | None = None,
) -> tuple[str, str]:
    """
    Render agentskills.io-compatible SKILL.md content.
    Returns (skill_name, markdown_body).
    """
    name = _slug(f"{task_type}-{goal[:30]}")
    steps = workflow if isinstance(workflow, list) else workflow.get("steps") or []
    step_lines = []
    for i, step in enumerate(steps, 1):
        if isinstance(step, dict):
            action = step.get("action") or step.get("title") or step.get("description") or str(step)
            step_lines.append(f"{i}. {action}")
        else:
            step_lines.append(f"{i}. {step}")

    reflect_notes = ""
    if reflection:
        refs = reflection.get("reflections") or []
        if refs:
            reflect_notes = "\n".join(
                f"- {r.get('summary') or r.get('note') or str(r)[:200]}"
                for r in refs[:5]
                if isinstance(r, dict)
            )

    body = f"""---
name: {name}
description: 从成功任务沉淀（{task_type}，评分 {score}）：{goal[:120]}
metadata:
  source: hivemind-task-engine
  task_type: {task_type}
  score: {score}
  created_at: {datetime.now(timezone.utc).isoformat()}
---

# {goal[:80]}

## 适用场景

- 任务类型：`{task_type}`
- 当用户提出类似目标时可参考本 Skill 的执行路径

## 推荐步骤

{chr(10).join(step_lines) if step_lines else "（无结构化步骤记录）"}

## 反思要点

{reflect_notes or "（无）"}

## 产出示例

{(final_output or "")[:800]}
"""
    return name, body.strip()


def write_skill_from_experience(
    org_id: str,
    *,
    task_type: str,
    goal: str,
    score: int,
    workflow: list | dict,
    reflection: dict | None = None,
    final_output: str | None = None,
    experience_id: str | None = None,
) -> dict[str, Any]:
    """Persist SKILL.md under storage/skills/{org_id}/{name}/SKILL.md."""
    name, content = experience_to_skill_md(
        task_type=task_type,
        goal=goal,
        score=score,
        workflow=workflow,
        reflection=reflection,
        final_output=final_output,
    )
    skill_dir = skills_root(org_id) / name
    skill_dir.mkdir(parents=True, exist_ok=True)
    path = skill_dir / "SKILL.md"
    path.write_text(content, encoding="utf-8")
    log.info("[skills] wrote  org=%s  name=%s  exp=%s", org_id, name, (experience_id or "")[:8])
    return {
        "skill_name": name,
        "path": str(path),
        "experience_id": experience_id,
    }


def list_skills(org_id: str) -> list[dict]:
    root = skills_root(org_id)
    out: list[dict] = []
    for skill_dir in sorted(root.iterdir()):
        if not skill_dir.is_dir():
            continue
        skill_file = skill_dir / "SKILL.md"
        if not skill_file.is_file():
            continue
        text = skill_file.read_text(encoding="utf-8")
        out.append({
            "name": skill_dir.name,
            "path": str(skill_file),
            "preview": text[:300],
        })
    return out


def manual_skill_md(
    *,
    title: str,
    description: str,
    steps: list[str],
    scenario: list[str] | None = None,
) -> tuple[str, str]:
    """Render SKILL.md for a user-created skill. Returns (skill_name, markdown)."""
    name = _slug(title)
    step_lines = [f"{i}. {s.strip()}" for i, s in enumerate(steps, 1) if s.strip()]
    scenario_lines = [f"- {s.strip()}" for s in (scenario or []) if s.strip()]
    if not scenario_lines:
        scenario_lines = ["- 当用户提出与标题类似的目标时可参考本 Skill"]

    body = f"""---
name: {name}
description: {description[:200]}
metadata:
  source: hivemind-manual
  created_at: {datetime.now(timezone.utc).isoformat()}
---

# {title[:80]}

## 适用场景

{chr(10).join(scenario_lines)}

## 推荐步骤

{chr(10).join(step_lines) if step_lines else "1. （请补充步骤）"}
"""
    return name, body.strip()


def write_manual_skill(
    org_id: str,
    *,
    title: str,
    description: str,
    steps: list[str],
    scenario: list[str] | None = None,
) -> dict[str, Any]:
    """Create SKILL.md from user input. Raises FileExistsError if name collides."""
    name, content = manual_skill_md(
        title=title,
        description=description,
        steps=steps,
        scenario=scenario,
    )
    skill_dir = skills_root(org_id) / name
    path = skill_dir / "SKILL.md"
    if path.is_file():
        raise FileExistsError(name)
    skill_dir.mkdir(parents=True, exist_ok=True)
    path.write_text(content, encoding="utf-8")
    log.info("[skills] manual create  org=%s  name=%s", org_id, name)
    return {"skill_name": name, "path": str(path), "content": content}
