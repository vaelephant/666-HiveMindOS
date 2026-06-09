from agent_engine.agents.planning_committee import adapt_plan_for_chat_upgrade
from agent_engine.domain.committee_config import is_chat_upgrade, should_trigger_committee
from agent_engine.models.plan import Plan


def test_is_chat_upgrade():
    assert is_chat_upgrade({"source": "chat_upgrade"}) is True
    assert is_chat_upgrade({"source": "manual"}) is False
    assert is_chat_upgrade(None) is False


def test_should_trigger_committee():
    assert should_trigger_committee({"source": "chat_upgrade"}) is True
    assert should_trigger_committee({"source": "task_center"}) is True
    assert should_trigger_committee({}) is False


def test_adapt_skips_redundant_search_wiki():
    plan = {
        "goal": "整理",
        "tasks": [
            {"id": "t1", "action": "search_wiki", "params": {}},
            {"id": "t2", "action": "extract_facts", "params": {}},
        ],
    }
    constraints = {
        "source": "chat_upgrade",
        "context": {"wiki_paths": ["/a", "/b"], "turns": []},
    }
    out = adapt_plan_for_chat_upgrade(plan, constraints)
    actions = [t["action"] for t in out["tasks"]]
    assert "search_wiki" not in actions
    assert "extract_facts" in actions


def test_plan_roundtrip_with_minutes():
    d = {
        "goal": "x",
        "task_type": "generic_goal",
        "rubric_id": "generic_goal",
        "success_criteria": ["ok"],
        "estimated_risk": "low",
        "planning_mode": "committee",
        "planning_minutes": [
            {"role": "domain", "label": "领域顾问", "summary": "建议 3 步"},
        ],
        "tasks": [{"id": "t1", "action": "search_wiki", "params": {}}],
    }
    p = Plan.from_dict(d)
    back = p.to_dict()
    assert back["planning_mode"] == "committee"
    assert len(back["planning_minutes"]) == 1
