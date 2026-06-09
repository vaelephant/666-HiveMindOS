from memory_layer.knowledge_base.core.domain.committee_config import (
    committee_roles,
    committee_roles_for_ui,
    fallback_risk_for_task_type,
    reload_committee_config,
    role_labels,
    should_trigger_committee,
    trigger_sources,
)


def test_load_roles_from_yaml():
    roles = committee_roles()
    assert len(roles) == 3
    assert roles[0].id == "domain"
    assert roles[-1].synthesizes_plan is True
    assert roles[-1].id == "chair"


def test_role_labels():
    labels = role_labels()
    assert labels["domain"] == "领域顾问"
    assert labels["chair"] == "主持人"


def test_trigger_sources():
    assert "chat_upgrade" in trigger_sources()
    assert "task_center" in trigger_sources()
    assert should_trigger_committee({"source": "task_center"}) is True
    assert should_trigger_committee({"source": "api"}) is False


def test_committee_roles_for_ui():
    ui = committee_roles_for_ui()
    assert ui[0]["id"] == "domain"
    assert "label" in ui[0]
    assert "description" in ui[0]


def test_fallback_risk_wiki():
    fb = fallback_risk_for_task_type("wiki_organize_decisions")
    assert fb["estimated_risk"] == "medium"
    assert any(o.get("step_action") == "compile_candidates" for o in fb["gate_overrides"])


def test_reload():
    reload_committee_config()
    assert len(committee_roles()) == 3
