"""Playbook save invalidates frozen session context."""

from __future__ import annotations

from unittest.mock import patch

from memory_layer.knowledge_base.core.services.playbook_service import (
    preview_playbook,
    reset_playbook,
    save_playbook,
)
from memory_layer.knowledge_base.models.memory import Memory


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


def test_save_playbook_clears_pinned_sessions(tmp_path):
    org = "org-pb"
    override = tmp_path / "orgs" / org / "playbook.md"

    with patch("memory_layer.knowledge_base.core.services.playbook_service.config") as cfg:
        cfg.STORAGE_ROOT = tmp_path
        with patch(
            "memory_layer.knowledge_base.core.services.playbook_service._chat_registry"
        ) as reg:
            reg.clear_pinned_context_for_org.return_value = 3
            with patch(
                "memory_layer.knowledge_base.core.services.playbook_service._load_playbook",
                return_value="## Playbook",
            ):
                result = save_playbook(org, "## 新守则\n- 简洁")

    assert override.is_file()
    assert "新守则" in override.read_text(encoding="utf-8")
    reg.clear_pinned_context_for_org.assert_called_once_with(org)
    assert result["pinned_sessions_cleared"] == 3
    assert result["source"] == "override"


def test_reset_playbook_clears_pinned_sessions(tmp_path):
    org = "org-pb"
    override = tmp_path / "orgs" / org / "playbook.md"
    override.parent.mkdir(parents=True)
    override.write_text("old", encoding="utf-8")

    with patch("memory_layer.knowledge_base.core.services.playbook_service.config") as cfg:
        cfg.STORAGE_ROOT = tmp_path
        with patch(
            "memory_layer.knowledge_base.core.services.playbook_service._chat_registry"
        ) as reg:
            reg.clear_pinned_context_for_org.return_value = 1
            with patch(
                "memory_layer.knowledge_base.core.services.playbook_service._load_playbook",
                return_value="## Default",
            ):
                result = reset_playbook(org)

    assert not override.is_file()
    reg.clear_pinned_context_for_org.assert_called_once_with(org)
    assert result["pinned_sessions_cleared"] == 1


def test_preview_playbook_uses_draft_content():
    with patch("memory_layer.knowledge_base.core.services.context_builder._registry") as reg:
        reg.list_active.return_value = [_memory()]
        result = preview_playbook("org1", "demo", "## 草稿守则\n- 测试")

    assert "草稿守则" in result["block"]
    assert result["memories_count"] == 1
    assert result["memories"][0]["title"] == "偏好"
