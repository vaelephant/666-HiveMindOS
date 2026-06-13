"""YAML 工作流编排 — 触发 → 条件 → 动作（automation / tool）。"""

from __future__ import annotations

import copy
from typing import Any

from knowledge_base import config
from server.logging_config import get_logger
from agent_engine.execution.condition_eval import eval_when
from agent_engine.tools.task_toolkit import TaskToolExecutor
from knowledge_base.core.domain.workflow_cron import cron_is_due, next_cron_run, validate_cron
from knowledge_base.core.domain.workflow_meta import category_label, get_template, list_templates
from knowledge_base.core.parsers.workflow_yaml import (
    normalize_workflow_dict,
    parse_workflow_yaml,
    workflow_to_yaml,
)
from knowledge_base.core.registry.workflow_registry import WorkflowRegistry
from knowledge_base.core.services import audit_service
from knowledge_base.core.services.automation_service import execute_automation_job

log = get_logger("hivemind.workflow")

_registry = WorkflowRegistry(config.WORKFLOW_DB)


def _ensure_seeded(org_id: str) -> None:
    existing = {w["id"] for w in _registry.list_workflows(org_id)}
    for tpl in list_templates():
        if tpl["id"] not in existing:
            yaml_src = workflow_to_yaml(tpl)
            _registry.upsert(org_id, tpl, yaml_source=yaml_src, builtin=True)


def _workflow_payload(org_id: str, wf: dict) -> dict:
    last = _registry.last_run(org_id, wf["id"])
    cat = wf.get("category") or "mixed"
    cron_hint = wf.get("cron_hint") or ""
    next_run = None
    if cron_hint:
        nxt = next_cron_run(cron_hint)
        if nxt:
            next_run = nxt.isoformat()
    return {
        **wf,
        "category_label": category_label(cat),
        "step_count": len(wf.get("steps") or []),
        "last_run": last,
        "next_run_at": next_run,
    }


def list_workflows(org_id: str) -> list[dict]:
    _ensure_seeded(org_id)
    return [_workflow_payload(org_id, w) for w in _registry.list_workflows(org_id)]


def get_workflow(org_id: str, workflow_id: str) -> dict | None:
    _ensure_seeded(org_id)
    wf = _registry.get(org_id, workflow_id)
    return _workflow_payload(org_id, wf) if wf else None


def list_workflow_templates() -> list[dict]:
    return [
        {
            **tpl,
            "category_label": category_label(tpl.get("category") or "mixed"),
            "step_count": len(tpl.get("steps") or []),
            "yaml": workflow_to_yaml(tpl),
        }
        for tpl in list_templates()
    ]


def create_from_yaml(org_id: str, yaml_text: str) -> dict:
    wf = parse_workflow_yaml(yaml_text)
    if _registry.get(org_id, wf["id"], include_deleted=True):
        raise ValueError(f"工作流 id 已存在: {wf['id']}")
    _registry.upsert(org_id, wf, yaml_source=yaml_text.strip(), builtin=False)
    log.info("[workflow] created  id=%s  org=%s", wf["id"], org_id)
    return get_workflow(org_id, wf["id"]) or wf


def create_from_template(org_id: str, template_id: str) -> dict:
    tpl = get_template(template_id)
    if not tpl:
        raise ValueError(f"未知模板: {template_id}")
    yaml_text = workflow_to_yaml(tpl)
    wf = normalize_workflow_dict(copy.deepcopy(tpl))
    if _registry.get(org_id, wf["id"], include_deleted=True):
        raise ValueError(f"工作流 {wf['id']} 已存在，请直接编辑或换 id")
    _registry.upsert(org_id, wf, yaml_source=yaml_text, builtin=False)
    return get_workflow(org_id, wf["id"]) or wf


def update_workflow_yaml(org_id: str, workflow_id: str, yaml_text: str) -> dict:
    wf = parse_workflow_yaml(yaml_text)
    if wf["id"] != workflow_id:
        raise ValueError("YAML 内 id 与路径 workflow_id 不一致")
    if not _registry.get(org_id, workflow_id):
        raise ValueError(f"工作流不存在: {workflow_id}")
    _registry.upsert(org_id, wf, yaml_source=yaml_text.strip(), builtin=False)
    log.info("[workflow] updated  id=%s  org=%s", workflow_id, org_id)
    return get_workflow(org_id, workflow_id) or wf


def delete_workflow(org_id: str, workflow_id: str) -> bool:
    if not _registry.delete(org_id, workflow_id):
        raise ValueError(f"工作流不存在: {workflow_id}")
    log.info("[workflow] deleted  id=%s  org=%s", workflow_id, org_id)
    return True


def restore_workflow(org_id: str, workflow_id: str) -> dict:
    tpl = get_template(workflow_id)
    if not tpl:
        raise ValueError(f"无内置模板可恢复: {workflow_id}")
    yaml_src = workflow_to_yaml(tpl)
    _registry.restore_builtin(org_id, tpl, yaml_src)
    return get_workflow(org_id, workflow_id) or tpl


def list_runs(org_id: str, workflow_id: str | None = None, limit: int = 50) -> list[dict]:
    return _registry.list_runs(org_id, workflow_id=workflow_id, limit=limit)


def delete_run(org_id: str, run_id: str) -> bool:
    if not _registry.delete_run(org_id, run_id):
        raise ValueError(f"运行记录不存在: {run_id}")
    return True


def set_workflow_schedule(
    org_id: str,
    workflow_id: str,
    *,
    enabled: bool,
    user_id: str | None = None,
) -> dict:
    wf = _registry.get(org_id, workflow_id)
    if not wf:
        raise ValueError(f"工作流不存在: {workflow_id}")
    if enabled:
        if not (wf.get("cron_hint") or "").strip():
            raise ValueError("请先在工作流 YAML 中配置 cron_hint")
        validate_cron(wf["cron_hint"])
    updated = _registry.set_schedule(
        org_id, workflow_id, enabled=enabled, user_id=user_id,
    )
    if not updated:
        raise ValueError(f"工作流不存在: {workflow_id}")
    log.info(
        "[workflow] schedule  id=%s  org=%s  enabled=%s",
        workflow_id, org_id, enabled,
    )
    return get_workflow(org_id, workflow_id) or updated


def list_due_scheduled(org_id: str | None = None) -> list[dict]:
    """返回当前 tick 应触发的工作流（含 cron_slot）。"""
    due: list[dict] = []
    for wf in _registry.list_scheduled(org_id):
        is_due, slot = cron_is_due(wf.get("cron_hint") or "", wf.get("last_cron_at"))
        if is_due and slot:
            due.append({**wf, "cron_slot": slot})
    return due


def mark_cron_slot(org_id: str, workflow_id: str, slot_iso: str) -> None:
    _registry.mark_cron_slot(org_id, workflow_id, slot_iso)


def _resolve_value(value: Any, checkpoints: dict, run_params: dict) -> Any:
    if isinstance(value, str) and value.startswith("$"):
        ref = value[1:]
        if ref in checkpoints:
            return copy.deepcopy(checkpoints[ref])
        if "." in ref:
            step_id, field = ref.split(".", 1)
            ck = checkpoints.get(step_id) or {}
            if field in ck:
                return copy.deepcopy(ck[field])
        if ref in run_params:
            return copy.deepcopy(run_params[ref])
    return value


def resolve_step_params(params: dict, checkpoints: dict, run_params: dict) -> dict:
    out: dict[str, Any] = {}
    for k, v in (params or {}).items():
        if isinstance(v, dict):
            out[k] = resolve_step_params(v, checkpoints, run_params)
        elif isinstance(v, list):
            out[k] = [_resolve_value(i, checkpoints, run_params) for i in v]
        else:
            out[k] = _resolve_value(v, checkpoints, run_params)
    return out


def _flatten_result(result: dict) -> dict:
    if not isinstance(result, dict):
        return {"raw": str(result)[:500]}
    keys = (
        "count", "created", "skipped", "approved", "conflict", "merged",
        "compiled", "resolved", "sessions_recapped", "synced", "digest",
        "total_pages", "issues_found", "ok", "wiki_path", "error",
    )
    summary = {k: result[k] for k in keys if k in result}
    if "items" in result and "count" not in summary:
        summary["count"] = len(result.get("items") or [])
    if result.get("ok") is False and result.get("error"):
        summary["error"] = result["error"]
    return summary


def dispatch_action(org_id: str, user_id: str, action: str, params: dict) -> dict:
    if action.startswith("automation."):
        job_id = action.split(".", 1)[1]
        return execute_automation_job(job_id, org_id, user_id, params)
    if action.startswith("tool."):
        tool_name = action.split(".", 1)[1]
        return TaskToolExecutor(org_id, user_id).execute(tool_name, params)
    raise ValueError(f"未知 action: {action}")


def run_workflow(
    org_id: str,
    workflow_id: str,
    user_id: str = "demo",
    params: dict[str, Any] | None = None,
    trigger: str = "manual",
) -> dict:
    wf = get_workflow(org_id, workflow_id)
    if not wf:
        raise ValueError(f"未知工作流: {workflow_id}")
    if not wf.get("enabled", True):
        raise ValueError(f"工作流已禁用: {workflow_id}")

    run_params = dict(params or {})
    run_id = _registry.start(org_id, workflow_id, trigger=trigger)
    checkpoints: dict[str, dict] = {}
    steps_log: list[dict] = []

    try:
        for step in wf.get("steps") or []:
            step_id = step["id"]
            action = step["action"]
            when = step.get("when")

            if not eval_when(when, checkpoints):
                entry = {
                    "step_id": step_id,
                    "action": action,
                    "status": "skipped",
                    "reason": f"when not met: {when}" if when else "skipped",
                }
                steps_log.append(entry)
                continue

            step_params = resolve_step_params(step.get("params") or {}, checkpoints, run_params)
            result = dispatch_action(org_id, user_id, action, step_params)
            summary = _flatten_result(result)
            checkpoints[step_id] = summary
            steps_log.append({
                "step_id": step_id,
                "action": action,
                "status": "done",
                "result": summary,
            })

        run_summary = {
            "workflow_id": workflow_id,
            "steps": steps_log,
            "checkpoints": checkpoints,
        }
        _registry.finish(run_id, status="done", summary=run_summary)
        done = sum(1 for s in steps_log if s["status"] == "done")
        skipped = sum(1 for s in steps_log if s["status"] == "skipped")
        label = wf.get("label") or workflow_id
        trigger_cn = {"manual": "手动", "cron": "定时"}.get(trigger, trigger)
        summary = f"{trigger_cn}运行「{label}」：{done} 步完成"
        if skipped:
            summary += f"，{skipped} 步跳过"
        audit_service.log_event(
            org_id,
            user_id=user_id,
            category="task",
            action="workflow.run",
            resource_type="workflow",
            resource_id=workflow_id,
            summary=summary,
            detail={
                "run_id": run_id,
                "trigger": trigger,
                "workflow_label": label,
                "steps_done": done,
                "steps_skipped": skipped,
                "steps": steps_log,
            },
        )
        log.info("[workflow] done  id=%s  org=%s  run=%s", workflow_id, org_id, run_id[:8])
        return {"ok": True, "run": _registry.get_run(run_id)}
    except Exception as exc:
        _registry.finish(
            run_id,
            status="error",
            summary={"steps": steps_log, "checkpoints": checkpoints},
            error=str(exc),
        )
        audit_service.log_event(
            org_id,
            user_id=user_id,
            category="task",
            action="workflow.run",
            resource_type="workflow",
            resource_id=workflow_id,
            status="error",
            summary=str(exc)[:200],
            detail={"run_id": run_id},
        )
        log.error("[workflow] failed  id=%s  org=%s  err=%s", workflow_id, org_id, exc)
        run = _registry.get_run(run_id)
        return {"ok": False, "run": run, "error": str(exc)}
