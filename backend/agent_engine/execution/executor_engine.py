"""ExecutorNode — 单步 Tool 执行与 gate 检查。"""

from __future__ import annotations

import copy
import json

from agent_engine.execution.condition_eval import eval_when
from agent_engine.execution.exceptions import ApprovalRequired
from knowledge_base.core.services.candidate_service import get_candidate_stats
from agent_engine.tools.task_toolkit import TaskToolExecutor
from agent_engine.models.plan import QueueTask
from agent_engine.settings import load
from knowledge_base.core.services import audit_service


def _audit_task_action(
    org_id: str,
    user_id: str,
    task: QueueTask,
    summary: dict,
    *,
    status: str,
) -> None:
    category = "communicate" if task.action == "wechat_work_send" else "task"
    if task.action == "save_deliverable":
        category = "deliverable"
    elif task.action in ("compile_candidates", "resolve_candidates", "enqueue_candidates"):
        category = "candidate"
    elif task.action in ("search_wiki", "read_page"):
        category = "wiki"

    parts = [task.name or task.action]
    if summary.get("merged"):
        parts.append(f"merged={summary['merged']}")
    if summary.get("wiki_path"):
        parts.append(summary["wiki_path"])
    if summary.get("to_user"):
        parts.append(f"→ {summary['to_user']}")
    if summary.get("error"):
        parts.append(str(summary["error"])[:120])

    audit_service.log_event(
        org_id,
        user_id=user_id,
        category=category,
        action=f"task.{task.action}",
        resource_type="task_step",
        resource_id=task.id,
        status=status,
        summary=" · ".join(parts),
        detail={
            "task_name": task.name,
            "action": task.action,
            "gate": task.gate,
            **{k: v for k, v in summary.items() if k != "text"},
        },
    )


def _gates_cfg() -> dict:
    return load("task_gates")


def _resolve_value(value, checkpoints: dict):
    if isinstance(value, str) and value.startswith("$"):
        ref = value[1:]
        if ref in checkpoints:
            return checkpoints[ref]
        if "." in ref:
            step_id, field = ref.split(".", 1)
            ck = checkpoints.get(step_id) or {}
            return ck.get(field)
    return value


def resolve_params(params: dict, checkpoints: dict) -> dict:
    out = {}
    for k, v in (params or {}).items():
        if isinstance(v, str) and v.startswith("$"):
            resolved = _resolve_value(v, checkpoints)
            if isinstance(resolved, dict) and k == "facts" and "facts" in resolved:
                out[k] = resolved["facts"]
            else:
                out[k] = copy.deepcopy(resolved)
        elif isinstance(v, list):
            resolved_list = []
            for i in v:
                if isinstance(i, str) and i.startswith("$"):
                    ref = i[1:]
                    resolved_list.append(copy.deepcopy(checkpoints.get(ref, {})))
                else:
                    resolved_list.append(i)
            out[k] = resolved_list
        else:
            out[k] = v
    return out


def check_gate(task: QueueTask, org_id: str, user_id: str) -> None:
    cfg = _gates_cfg()
    gate = task.gate or "auto"
    forced = (cfg.get("action_gates") or {}).get(task.action)
    if forced:
        gate = forced
    if gate in ("auto", "step_human"):
        if gate == "step_human":
            raise ApprovalRequired(task.id, "步骤需人工批准")
        return

    if gate == "human":
        raise ApprovalRequired(task.id, "任务需人工批准")

    if gate == "auto_if_low_risk" and task.action == "compile_candidates":
        stats = get_candidate_stats(org_id, user_id)
        if int(stats.get("conflict") or 0) > 0:
            raise ApprovalRequired(task.id, "存在冲突候选，需人工审核")
        high_risk = set(cfg.get("high_risk_categories") or [])
        if int(cfg.get("default_tier") or 1) < 2:
            raise ApprovalRequired(task.id, "档 1 策略：编译进 Wiki 需人工确认")


class ExecutorEngine:
    def __init__(self, org_id: str, user_id: str = "demo"):
        self._tools = TaskToolExecutor(org_id, user_id)
        self._org_id = org_id
        self._user_id = user_id

    def run_step(
        self,
        task: QueueTask,
        checkpoints: dict,
    ) -> tuple[dict, dict]:
        if not eval_when(task.when, checkpoints):
            summary = {"skipped": True, "reason": f"when not met: {task.when}"}
            return summary, summary

        check_gate(task, self._org_id, self._user_id)
        params = resolve_params(task.params, checkpoints)
        try:
            result = self._tools.execute(task.action, params)
            summary = _summarize(result)
            _audit_task_action(
                self._org_id, self._user_id, task, summary, status="success",
            )
            return result, summary
        except Exception as exc:
            _audit_task_action(
                self._org_id, self._user_id, task,
                {"error": str(exc)}, status="error",
            )
            raise


def _summarize(result: dict) -> dict:
    if not isinstance(result, dict):
        return {"raw": str(result)[:500]}
    keys = (
        "count", "created", "skipped", "approved", "conflict", "merged",
        "compiled", "resolved", "facts", "first_url", "provider", "ok", "chars",
        "wiki_path", "to_user", "msg_type",
    )
    summary = {k: result[k] for k in keys if k in result}
    if "text" in result and result["text"]:
        summary["text"] = str(result["text"])[:80000]
    if "facts" in result and isinstance(result["facts"], list):
        summary["count"] = len(result["facts"])
    if "items" in result and "count" not in summary:
        summary["count"] = len(result.get("items") or [])
    if result.get("ok") is False and result.get("error"):
        summary["error"] = result["error"]
    return summary
