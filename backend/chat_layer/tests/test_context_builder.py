"""Context builder tests (pinned + session search formatting)."""

from __future__ import annotations

from unittest.mock import MagicMock, patch

from chat_layer.core.services.context_builder import (
    build_pinned_block,
    format_session_search_block,
)
from memory_layer.models.memory import Memory


def _memory(**kwargs) -> Memory:
    defaults = dict(
        id=1,
        org_id="org1",
        user_id="demo",
        memory_type="preference",
        title="偏好",
        content="喜欢简洁回答",
        importance=0.9,
        status="active",
        source_type="chat",
        source_id=None,
        created_at="2026-01-01",
        updated_at="2026-01-01",
    )
    defaults.update(kwargs)
    return Memory(**defaults)


def test_build_pinned_block_includes_playbook():
    with patch("chat_layer.core.services.context_builder._registry") as reg:
        reg.list_active.return_value = [_memory()]
        block, pinned = build_pinned_block("org1", "demo")
    assert "Playbook" in block or "playbook" in block.lower() or "组织" in block
    assert len(pinned) >= 1


def test_format_session_search_block():
    hits = [
        {"role": "user", "content": "上次讨论报价", "session_title": "销售", "session_id": "s1"},
    ]
    block = format_session_search_block(hits)
    assert "历史对话" in block
    assert "报价" in block


def test_experience_to_skill_import():
    from agent_engine.skills.experience_to_skill import experience_to_skill_md as skill_md

    name, body = skill_md(
        task_type="research",
        goal="分析竞品定价",
        score=85,
        workflow=[{"action": "search_wiki"}, {"action": "summarize"}],
    )
    assert name
    assert "agentskills" in body or "name:" in body
    assert "分析竞品" in body
