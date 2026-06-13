from agent_engine.agents.planner_agent import validate_plan


def test_plan_validation_rejects_unknown_action():
    bad = {
        "goal": "x",
        "tasks": [{"id": "t1", "action": "hack_shell", "params": {}}],
    }
    assert validate_plan(bad) is False


def test_plan_validation_accepts_valid():
    good = {
        "goal": "整理",
        "tasks": [{"id": "t1", "action": "search_memories", "params": {}}],
    }
    assert validate_plan(good) is True
