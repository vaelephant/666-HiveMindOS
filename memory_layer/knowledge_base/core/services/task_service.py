"""Goal 任务服务 — Plan → Execute → Reflect → Memory 编排。"""

from __future__ import annotations

from datetime import datetime, timezone

from memory_layer.knowledge_base import config
from memory_layer.knowledge_base.app.logging_config import get_logger
from memory_layer.knowledge_base.core.agents.planner_agent import PlannerAgent
from memory_layer.knowledge_base.core.agents.planning_committee import PlanningCommittee
from memory_layer.knowledge_base.core.domain.committee_config import (
    committee_roles_for_ui,
    should_trigger_committee,
)
from memory_layer.knowledge_base.core.domain.rubric import match_task_type
from memory_layer.knowledge_base.core.execution.exceptions import ApprovalRequired
from memory_layer.knowledge_base.core.execution.orchestrator import TaskOrchestrator
from memory_layer.knowledge_base.core.registry.task_registry import TaskRegistry
from memory_layer.knowledge_base.core.services.experience_service import (
    recall_for_planner,
    save_experience_with_vector,
)
from memory_layer.knowledge_base.models.plan import Plan, QueueTask
from memory_layer.knowledge_base.settings import load

log = get_logger("hivemind.task.service")

_registry = TaskRegistry(config.TASK_DB)


def _now() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def run_goal(task_id: str, org_id: str, *, resume_from: str | None = None) -> None:
    task = _registry.get(task_id)
    if not task or task.org_id != org_id:
        raise ValueError("任务不存在")

    def on_step(step: dict):
        current = _registry.get(task_id)
        if not current:
            return
        steps = list(current.steps or [])
        steps.append(step)
        _registry.update(task_id, steps=steps)

    try:
        needs_planning = task.phase in ("pending", "planning") and not task.queue
        if needs_planning:
            _registry.update(task_id, status="running", phase="planning")
            task_type = match_task_type(task.input)
            exp = recall_for_planner(org_id, task_type, task.input, limit=2)

            def on_committee_progress(minutes: list[dict], active_role: str | None) -> None:
                _registry.update(
                    task_id,
                    plan={
                        "goal": task.input,
                        "task_type": task_type,
                        "rubric_id": task_type,
                        "success_criteria": [],
                        "estimated_risk": "medium",
                        "tasks": [],
                        "planning_mode": "committee",
                        "planning_minutes": minutes,
                        "planning_active_role": active_role,
                        "committee_roles": committee_roles_for_ui(),
                    },
                )

            if should_trigger_committee(task.constraints):
                log.info("[task] planning committee  id=%s", task_id[:8])
                plan = PlanningCommittee().run(
                    task.input,
                    org_id,
                    constraints=task.constraints,
                    experience=exp,
                    on_progress=on_committee_progress,
                )
            else:
                plan = PlannerAgent().run(
                    task.input,
                    org_id,
                    constraints=task.constraints,
                    experience=exp,
                )
            queue = [t.to_dict() for t in plan.tasks]
            _registry.update(
                task_id,
                phase="planned",
                plan=plan.to_dict(),
                queue=queue,
                task_type=plan.task_type,
                rubric_id=plan.rubric_id,
            )
            task = _registry.get(task_id)

        plan = Plan.from_dict(task.plan or {})
        if task.queue:
            queue = [QueueTask.from_dict(q) for q in task.queue]
        else:
            queue = list(plan.tasks)

        _registry.update(task_id, phase="executing", status="running")

        orchestrator = TaskOrchestrator(org_id, on_step=on_step)
        outcome = orchestrator.run(
            plan,
            queue,
            goal_text=task.input,
            resume_from=resume_from or task.pending_step_id,
        )

        _registry.update(
            task_id,
            phase="reflecting",
            queue=outcome["queue"],
            checkpoints=outcome["checkpoints"],
            reflections=outcome["reflections"],
            pending_step_id=None,
        )

        score = outcome.get("score")
        report = outcome.get("report") or ""
        exp_id = None
        min_score = int(load("task_gates").get("experience_min_score") or 80)
        if score is not None and score >= min_score:
            exp_id = save_experience_with_vector(
                org_id,
                plan.task_type,
                task.input,
                success=True,
                score=score,
                workflow=outcome.get("workflow") or [],
                reflection={"reflections": outcome.get("reflections")},
                final_output=report[:500],
            )

        _registry.update(
            task_id,
            phase="done",
            status="done",
            result=report,
            score=score,
            experience_id=exp_id,
            completed_at=_now(),
        )
        log.info("[task] done  id=%s  score=%s", task_id[:8], score)

    except ApprovalRequired as exc:
        patch = {
            "phase": "awaiting_approval",
            "status": "running",
            "pending_step_id": exc.step_id,
            "error": exc.reason,
        }
        if exc.queue:
            patch["queue"] = exc.queue
        if exc.checkpoints:
            patch["checkpoints"] = exc.checkpoints
        _registry.update(task_id, **patch)
        log.info("[task] awaiting approval  id=%s  step=%s", task_id[:8], exc.step_id)

    except Exception as exc:
        log.error("[task] error  id=%s  err=%s", task_id[:8], exc)
        _registry.update(
            task_id,
            phase="error",
            status="error",
            error=str(exc),
            completed_at=_now(),
        )


def list_experiences(org_id: str, task_type: str | None = None, limit: int = 20) -> list[dict]:
    from memory_layer.knowledge_base.core.registry.experience_registry import ExperienceRegistry

    reg = ExperienceRegistry(config.TASK_DB)
    if task_type:
        return reg.latest_high_score(org_id, task_type, min_score=0, limit=limit)
    return reg.list_recent(org_id, limit=limit)
