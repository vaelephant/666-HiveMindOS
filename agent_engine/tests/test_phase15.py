from agent_engine.agents.planner_agent import _fallback_plan, validate_plan
from agent_engine.tools.task_toolkit import list_actions
from agent_engine.models.plan import Plan


def test_sales_proposal_fallback_plan():
    raw = _fallback_plan("分析中康尚德并生成销售方案", "sales_proposal")
    plan = Plan.from_dict(raw)
    actions = [t.action for t in plan.tasks]
    assert "web_search" in actions
    assert "llm_generate" in actions
    assert actions.count("llm_generate") >= 2
    assert validate_plan(raw)


def test_phase15_actions_registered():
    actions = list_actions()
    assert "web_search" in actions
    assert "read_url" in actions
