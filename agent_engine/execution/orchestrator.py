"""任务编排主循环 — Execute → StepReflect → Replan。"""

from __future__ import annotations

from datetime import datetime, timezone

from memory_layer.knowledge_base.app.logging_config import get_logger
from agent_engine.agents.final_reflect_agent import FinalReflectAgent
from agent_engine.agents.replan_agent import ReplanAgent
from agent_engine.agents.step_reflect_agent import StepReflectAgent
from agent_engine.execution.exceptions import ApprovalRequired
from agent_engine.execution.executor_engine import ExecutorEngine
from agent_engine.models.plan import Plan, QueueTask
from agent_engine.settings import load

log = get_logger("hivemind.orchestrator")


def _now() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def _gates() -> dict:
    return load("task_gates")


class TaskOrchestrator:
    def __init__(
        self,
        org_id: str,
        user_id: str = "demo",
        on_step=None,
    ):
        self._org_id = org_id
        self._user_id = user_id
        self._executor = ExecutorEngine(org_id, user_id)
        self._reflect = StepReflectAgent()
        self._replan = ReplanAgent()
        self._final = FinalReflectAgent()
        self._on_step = on_step

    def run(
        self,
        plan: Plan,
        queue: list[QueueTask],
        *,
        goal_text: str,
        resume_from: str | None = None,
        skip_final: bool = False,
    ) -> dict:
        cfg = _gates()
        max_retries = int(cfg.get("max_retries") or 2)
        max_add = int(cfg.get("max_add_tasks") or 3)
        max_steps = int(cfg.get("max_total_steps") or 20)

        steps_log: list[dict] = []
        reflections: list[dict] = []
        checkpoints: dict = {}
        added_count = 0
        total_executed = 0
        skipping_until = resume_from
        queue_by_id = {t.id: t for t in queue}

        while True:
            pending = [t for t in queue if t.status == "pending"]
            if not pending:
                break
            if total_executed >= max_steps:
                log.warning("[orchestrator] max steps reached")
                break

            task = pending[0]
            if skipping_until:
                if task.id != skipping_until:
                    task.status = "skipped"
                    continue
                skipping_until = None

            task.status = "running"
            started = _now()
            step_record = {
                "task_id": task.id,
                "name": task.name,
                "action": task.action,
                "status": "running",
                "started_at": started,
            }

            try:
                raw_result, summary = self._executor.run_step(task, checkpoints)
                if summary.get("skipped"):
                    task.status = "skipped"
                    step_record["status"] = "skipped"
                    step_record["result_summary"] = summary
                    steps_log.append(step_record)
                    checkpoints[task.id] = summary
                    if self._on_step:
                        self._on_step(step_record)
                    continue

                checkpoints[task.id] = summary
                if task.action == "llm_generate" and summary.get("text"):
                    checkpoints["_deliverable"] = summary["text"]
                reflection = self._reflect.run(
                    goal=goal_text,
                    task=task,
                    result=raw_result,
                    rubric_id=plan.rubric_id,
                )
                reflections.append(reflection.to_dict())
                step_record["reflection"] = reflection.to_dict()
                step_record["result_summary"] = summary
                step_record["result_raw"] = str(raw_result)[:4000]

                status = reflection.status
                if status == "pass":
                    task.status = "done"
                    step_record["status"] = "done"
                elif status == "retry" and task.retry_count < max_retries:
                    task.retry_count += 1
                    task.status = "pending"
                    step_record["status"] = "retry"
                elif status == "add_task" and added_count < max_add:
                    existing = {t.id for t in queue}
                    new_tasks = self._replan.normalize(reflection.new_tasks, existing_ids=existing)
                    queue.extend(new_tasks)
                    for nt in new_tasks:
                        queue_by_id[nt.id] = nt
                    added_count += len(new_tasks)
                    task.status = "done"
                    step_record["status"] = "done"
                elif status == "fail":
                    task.status = "failed"
                    step_record["status"] = "failed"
                else:
                    task.status = "done"
                    step_record["status"] = "done"

            except ApprovalRequired as exc:
                task.status = "pending"
                step_record["status"] = "awaiting_approval"
                step_record["error"] = exc.reason
                steps_log.append(step_record)
                if self._on_step:
                    self._on_step(step_record)
                exc.queue = [t.to_dict() for t in queue]
                exc.checkpoints = checkpoints
                raise

            except Exception as exc:
                log.error("[orchestrator] step failed  task=%s  err=%s", task.id, exc)
                task.status = "failed"
                step_record["status"] = "error"
                step_record["error"] = str(exc)

            step_record["completed_at"] = _now()
            steps_log.append(step_record)
            total_executed += 1
            if self._on_step:
                self._on_step(step_record)

        report, score = "", None
        if not skip_final:
            report, score = self._final.run(
                goal=goal_text,
                success_criteria=plan.success_criteria,
                steps=steps_log,
                reflections=reflections,
                rubric_id=plan.rubric_id,
            )

        return {
            "steps": steps_log,
            "checkpoints": checkpoints,
            "reflections": reflections,
            "queue": [t.to_dict() for t in queue],
            "report": report,
            "score": score,
            "workflow": [{"id": t.id, "action": t.action, "name": t.name} for t in queue],
        }
