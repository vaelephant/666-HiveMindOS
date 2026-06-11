"""Skill recall tests."""

from __future__ import annotations

from pathlib import Path
from unittest.mock import patch

from agent_engine.skills.skill_recall import (
    format_skills_block,
    select_relevant_skills,
    skills_used_payload,
)


def _write_skill(root: Path, name: str, description: str, body_extra: str = "") -> None:
    skill_dir = root / name
    skill_dir.mkdir(parents=True, exist_ok=True)
    content = f"""---
name: {name}
description: {description}
---

# Title

## 适用场景

- 竞品报价与对标分析
- 用户提到：竞品、报价、华东

## 推荐步骤

1. query_wiki — 检索竞品档案
2. write_summary — 输出对比表

{body_extra}
"""
    (skill_dir / "SKILL.md").write_text(content, encoding="utf-8")


def test_select_relevant_skills_matches_question(tmp_path):
    org = "test-org"
    skills_root = tmp_path / "skills" / org
    _write_skill(skills_root, "research-竞品报价", "竞品报价分析 skill")
    _write_skill(skills_root, "ops-日报", "每日运营日报汇总")

    with patch("agent_engine.skills.skill_recall.skills_root", return_value=skills_root):
        hits = select_relevant_skills(org, "帮我整理三家竞品在华东区的报价对比")

    assert len(hits) >= 1
    assert hits[0].name == "research-竞品报价"
    assert hits[0].score > 0


def test_format_skills_block_includes_steps(tmp_path):
    org = "test-org"
    skills_root = tmp_path / "skills" / org
    _write_skill(skills_root, "research-竞品报价", "竞品报价分析")

    with patch("agent_engine.skills.skill_recall.skills_root", return_value=skills_root):
        skills = select_relevant_skills(org, "竞品报价", limit=1)
        block = format_skills_block(skills)
        payload = skills_used_payload(skills)

    assert "本轮相关 Skill" in block
    assert "query_wiki" in block
    assert payload[0]["name"] == "research-竞品报价"


def test_build_context_includes_skills_block(tmp_path):
    from memory_layer.knowledge_base.core.services.context_builder import build_context

    org = "org-skills"
    skills_root = tmp_path / "skills" / org
    _write_skill(skills_root, "research-竞品报价", "竞品报价分析")

    with patch("agent_engine.skills.skill_recall.skills_root", return_value=skills_root):
        with patch("memory_layer.knowledge_base.core.services.context_builder._registry") as reg:
            reg.list_active.return_value = []
            block, memories, skills = build_context(org, "demo", "竞品报价对标")

    assert "本轮相关 Skill" in block
    assert len(skills) >= 1
    assert isinstance(memories, list)
