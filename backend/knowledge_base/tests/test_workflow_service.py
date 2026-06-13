"""Workflow engine tests."""

from __future__ import annotations

from unittest.mock import patch

import pytest

from knowledge_base.core.registry.workflow_registry import WorkflowRegistry
from knowledge_base.core.services import workflow_service


@pytest.fixture()
def isolated_registry(tmp_path, monkeypatch):
    reg = WorkflowRegistry(tmp_path / "workflows_test.db")
    monkeypatch.setattr(workflow_service, "_registry", reg)
    return reg


def test_resolve_step_params_from_checkpoint():
    checkpoints = {"recap": {"sessions_recapped": 3, "approved": 2}}
    params = workflow_service.resolve_step_params(
        {"limit": "$recap.approved", "note": "ok"},
        checkpoints,
        {},
    )
    assert params["limit"] == 2
    assert params["note"] == "ok"


def test_run_workflow_skips_when_condition_not_met(isolated_registry):
    org = "test-org"
    isolated_registry.upsert(org, {
        "id": "test_flow",
        "label": "Test",
        "description": "",
        "category": "mixed",
        "cron_hint": "",
        "enabled": True,
        "steps": [
            {"id": "first", "action": "automation.resolve_candidates", "params": {"limit": 1}},
            {
                "id": "second",
                "action": "automation.compile_candidates",
                "when": "$first.approved >= 99",
                "params": {"limit": 1},
            },
        ],
    }, yaml_source="")

    calls: list[str] = []

    def fake_dispatch(org_id, user_id, action, params):
        calls.append(action)
        return {"resolved": 1, "approved": 0, "conflict": 0}

    with patch.object(workflow_service, "dispatch_action", side_effect=fake_dispatch):
        with patch.object(workflow_service, "get_workflow") as get_wf:
            get_wf.return_value = isolated_registry.get(org, "test_flow")
            result = workflow_service.run_workflow(org, "test_flow", user_id="u1")

    assert result["ok"] is True
    assert calls == ["automation.resolve_candidates"]
    steps = result["run"]["summary"]["steps"]
    assert any(s["status"] == "skipped" for s in steps)


def test_run_workflow_executes_all_steps(isolated_registry):
    org = "org2"
    isolated_registry.upsert(org, {
        "id": "simple",
        "label": "Simple",
        "description": "",
        "category": "wiki",
        "enabled": True,
        "steps": [
            {"id": "lint", "action": "automation.lint_wiki", "params": {}},
        ],
    }, yaml_source="")

    with patch.object(
        workflow_service,
        "dispatch_action",
        return_value={"total_pages": 5, "issues_found": 0},
    ):
        with patch.object(workflow_service, "get_workflow") as get_wf:
            get_wf.return_value = isolated_registry.get(org, "simple")
            result = workflow_service.run_workflow(org, "simple")

    assert result["ok"] is True
    assert result["run"]["status"] == "done"
