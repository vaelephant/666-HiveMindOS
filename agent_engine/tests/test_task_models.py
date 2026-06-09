from agent_engine.models.plan import Plan, QueueTask
from agent_engine.models.reflection import StepReflectResult
from agent_engine.models.task import Task


def test_queue_task_from_dict():
    t = QueueTask.from_dict({
        "id": "t1",
        "name": "检索记忆",
        "action": "search_memories",
        "params": {"category": "decision"},
        "status": "pending",
    })
    assert t.action == "search_memories"


def test_plan_from_dict():
    raw = {
        "goal": "整理决策",
        "task_type": "wiki_organize_decisions",
        "success_criteria": ["检索完成"],
        "tasks": [{"id": "t1", "name": "搜", "action": "search_memories", "params": {}}],
    }
    plan = Plan.from_dict(raw)
    assert plan.task_type == "wiki_organize_decisions"
    assert len(plan.tasks) == 1


def test_step_reflect_result():
    r = StepReflectResult.from_dict({
        "score": 82,
        "passed": True,
        "status": "pass",
        "reason": "ok",
        "problems": [],
        "next_action": "continue",
        "new_tasks": [],
    })
    assert r.status == "pass"


def test_task_goal_fields():
    t = Task(
        id="1",
        org_id="demo",
        input="test",
        task_type="wiki_organize_decisions",
        phase="planning",
        queue=[],
        reflections=[],
    )
    assert t.task_type == "wiki_organize_decisions"
