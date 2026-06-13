"""Workflow schedule API tests."""

from __future__ import annotations

from unittest.mock import patch

import pytest

from ops.core.registry.workflow_registry import WorkflowRegistry
import ops.core.services.workflow_service as workflow_service


@pytest.fixture()
def isolated_registry(tmp_path, monkeypatch):
    reg = WorkflowRegistry(tmp_path / "wf_sched.db")
    monkeypatch.setattr(workflow_service, "_registry", reg)
    return reg


def test_set_schedule_requires_cron(isolated_registry):
    org = "demo"
    isolated_registry.upsert(org, {
        "id": "wf1",
        "label": "Test",
        "description": "",
        "category": "mixed",
        "cron_hint": "",
        "enabled": True,
        "steps": [{"id": "a", "action": "automation.lint_wiki", "params": {}}],
    }, yaml_source="")

    with pytest.raises(ValueError, match="cron_hint"):
        workflow_service.set_workflow_schedule(org, "wf1", enabled=True)


def test_set_schedule_enables(isolated_registry):
    org = "demo"
    isolated_registry.upsert(org, {
        "id": "wf2",
        "label": "Test",
        "description": "",
        "category": "mixed",
        "cron_hint": "0 3 * * *",
        "enabled": True,
        "steps": [{"id": "a", "action": "automation.lint_wiki", "params": {}}],
    }, yaml_source="")

    with patch.object(workflow_service, "get_workflow") as get_wf:
        get_wf.return_value = isolated_registry.get(org, "wf2")
        workflow_service.set_workflow_schedule(org, "wf2", enabled=True, user_id="u1")

    row = isolated_registry.get(org, "wf2")
    assert row["schedule_enabled"] is True
    assert row["schedule_user_id"] == "u1"
