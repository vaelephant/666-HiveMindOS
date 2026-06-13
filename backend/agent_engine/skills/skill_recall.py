"""Select org Skills (SKILL.md) relevant to a chat question for context injection."""

from __future__ import annotations

import re
from dataclasses import dataclass
from pathlib import Path

from agent_engine.skills.experience_to_skill import skills_root
from server.logging_config import get_logger
from chat_layer.settings import load

log = get_logger("hivemind.skills.recall")


@dataclass(frozen=True)
class SkillEntry:
    name: str
    description: str
    body: str
    path: str
    score: float = 0.0


def _skills_cfg() -> dict:
    return load("recall").get("skills") or {}


def _keywords(text: str) -> list[str]:
    tokens: list[str] = []
    for run in re.findall(r"[\u4e00-\u9fff]+", text):
        if len(run) >= 2:
            tokens.append(run)
        for i in range(len(run) - 1):
            tokens.append(run[i : i + 2])
    latin = re.findall(r"[a-zA-Z0-9]{2,}", text.lower())
    tokens.extend(latin)
    seen: set[str] = set()
    out: list[str] = []
    for t in tokens:
        if len(t) >= 2 and t not in seen:
            seen.add(t)
            out.append(t)
    return out


def _parse_skill_file(skill_file: Path) -> SkillEntry | None:
    try:
        text = skill_file.read_text(encoding="utf-8")
    except OSError:
        return None

    name = skill_file.parent.name
    description = ""
    body = text.strip()

    if text.startswith("---"):
        parts = text.split("---", 2)
        if len(parts) >= 3:
            frontmatter = parts[1]
            body = parts[2].strip()
            m = re.search(r"^description:\s*(.+)$", frontmatter, re.M)
            if m:
                description = m.group(1).strip().strip('"').strip("'")

    return SkillEntry(
        name=name,
        description=description,
        body=body,
        path=str(skill_file),
    )


def load_skill_catalog(org_id: str) -> list[SkillEntry]:
    root = skills_root(org_id)
    if not root.is_dir():
        return []
    entries: list[SkillEntry] = []
    for skill_dir in sorted(root.iterdir()):
        if not skill_dir.is_dir():
            continue
        skill_file = skill_dir / "SKILL.md"
        if not skill_file.is_file():
            continue
        entry = _parse_skill_file(skill_file)
        if entry:
            entries.append(entry)
    return entries


def _score_skill(question: str, skill: SkillEntry) -> float:
    scenario = ""
    m = re.search(r"## 适用场景\s*\n(.*?)(?=\n## |\Z)", skill.body, re.S)
    if m:
        scenario = m.group(1).strip()

    blob = f"{skill.name} {skill.description} {scenario} {skill.body[:400]}"
    blob_lower = blob.lower()
    kw_score = 0.0
    for token in _keywords(question):
        tl = token.lower()
        if tl in blob_lower or token in blob:
            kw_score += 0.22
        if token in skill.name or tl in skill.name.lower():
            kw_score += 0.4
        if token in skill.description:
            kw_score += 0.35
    return kw_score


def _steps_excerpt(body: str, max_chars: int) -> str:
    m = re.search(r"## 推荐步骤\s*\n(.*?)(?=\n## |\Z)", body, re.S)
    chunk = m.group(1).strip() if m else body[:max_chars]
    if len(chunk) > max_chars:
        return chunk[: max_chars - 12] + "\n…（已截断）"
    return chunk


def select_relevant_skills(org_id: str, question: str, *, limit: int | None = None) -> list[SkillEntry]:
    cfg = _skills_cfg()
    if cfg.get("enabled") is False:
        return []

    catalog = load_skill_catalog(org_id)
    if not catalog:
        return []

    max_skills = limit if limit is not None else int(cfg.get("max_skills") or 2)
    threshold = float(cfg.get("keyword_threshold") or 0.35)

    scored = [(_score_skill(question, s), s) for s in catalog]
    scored.sort(key=lambda x: x[0], reverse=True)

    selected: list[SkillEntry] = []
    for score, skill in scored:
        if score < threshold:
            continue
        selected.append(SkillEntry(
            name=skill.name,
            description=skill.description,
            body=skill.body,
            path=skill.path,
            score=round(score, 3),
        ))
        if len(selected) >= max_skills:
            break

    if not selected and scored[0][0] > 0:
        score, skill = scored[0]
        selected.append(SkillEntry(
            name=skill.name,
            description=skill.description,
            body=skill.body,
            path=skill.path,
            score=round(score, 3),
        ))

    if selected:
        log.info(
            "[skills] recall  org=%s  hits=%s",
            org_id,
            ", ".join(f"{s.name}({s.score})" for s in selected),
        )
    return selected


def format_skills_block(skills: list[SkillEntry]) -> str:
    if not skills:
        return ""

    cfg = _skills_cfg()
    excerpt_chars = int(cfg.get("excerpt_chars") or 650)
    lines = ["## 本轮相关 Skill（组织沉淀的可复用做法，可参考步骤勿逐步复述）"]
    for s in skills:
        title = s.description.split("：")[-1][:80] if s.description else s.name
        lines.append(f"### Skill: {s.name}")
        if s.description:
            lines.append(f"- 说明：{s.description[:200]}")
        steps = _steps_excerpt(s.body, excerpt_chars)
        if steps:
            lines.append("- 推荐步骤：")
            lines.append(steps)
    return "\n".join(lines)


def skills_used_payload(skills: list[SkillEntry]) -> list[dict]:
    return [
        {
            "name": s.name,
            "description": s.description,
            "score": s.score,
            "path": s.path,
        }
        for s in skills
    ]
