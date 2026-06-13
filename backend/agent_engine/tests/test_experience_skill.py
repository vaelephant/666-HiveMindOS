"""Experience → Skill conversion tests."""

import pytest

from agent_engine.skills.experience_to_skill import (
    experience_to_skill_md,
    write_manual_skill,
    write_skill_from_experience,
)


def test_experience_to_skill_md_frontmatter():
    name, body = experience_to_skill_md(
        task_type="analysis",
        goal="整理 Q2 销售数据",
        score=90,
        workflow=["query_wiki", "write_summary"],
        final_output="已完成摘要",
    )
    assert name.startswith("analysis") or "q2" in name.lower() or name
    assert "name:" in body
    assert "Q2" in body or "销售" in body


def test_write_skill_from_experience(tmp_path, monkeypatch):
    import knowledge_base.config as cfg

    monkeypatch.setattr(cfg, "STORAGE_ROOT", tmp_path)
    result = write_skill_from_experience(
        "org-test",
        task_type="demo",
        goal="测试任务",
        score=88,
        workflow=[{"action": "step_one"}],
        experience_id="exp-1",
    )
    assert result["skill_name"]
    from pathlib import Path
    path = Path(result["path"])
    assert path.is_file()
    assert "测试任务" in path.read_text(encoding="utf-8")


def test_write_manual_skill(tmp_path, monkeypatch):
    import knowledge_base.config as cfg

    monkeypatch.setattr(cfg, "STORAGE_ROOT", tmp_path)
    result = write_manual_skill(
        "org-test",
        title="整理竞品报价",
        description="快速产出竞品对比表",
        steps=["检索 Wiki", "输出表格"],
        scenario=["销售售前场景"],
    )
    assert result["skill_name"]
    text = open(result["path"], encoding="utf-8").read()
    assert "hivemind-manual" in text
    assert "检索 Wiki" in text

    with pytest.raises(FileExistsError):
        write_manual_skill(
            "org-test",
            title="整理竞品报价",
            description="重复",
            steps=["一步"],
        )
