"""自动化任务编排 — YAML 种子 + SQLite 可修改/删除。"""

from __future__ import annotations

from typing import Any

from memory_layer.knowledge_base import config
from memory_layer.knowledge_base.app.logging_config import get_logger
from memory_layer.knowledge_base.core.domain.automation_meta import (
    category_label,
    get_job_def,
    list_job_defs,
)
from memory_layer.knowledge_base.core.registry.automation_registry import AutomationRegistry
from memory_layer.knowledge_base.core.services.candidate_service import (
    compile_approved_candidates,
    resolve_pending_candidates,
)
from memory_layer.knowledge_base.core.services.memory_service import (
    recap_idle_sessions,
    sync_vectors,
)

log = get_logger("hivemind.automation")

_registry = AutomationRegistry(config.AUTOMATION_DB)

_KNOWN_HANDLERS = frozenset({
    "recap_sessions",
    "sync_vectors",
    "resolve_candidates",
    "compile_candidates",
})


def _ensure_seeded(org_id: str) -> None:
    existing = {j["id"] for j in _registry.list_jobs(org_id)}
    for job in list_job_defs():
        if job["id"] not in existing:
            _registry.ensure_job(org_id, job, builtin=True)


def _job_payload(org_id: str, job: dict) -> dict:
    last = _registry.last_run(org_id, job["id"])
    cat = job.get("category", "other")
    return {
        "id": job["id"],
        "label": job["label"],
        "description": job.get("description", ""),
        "category": cat,
        "category_label": category_label(cat),
        "cron_hint": job.get("cron_hint", ""),
        "defaults": job.get("defaults") or {},
        "builtin": bool(job.get("builtin")),
        "updated_at": job.get("updated_at"),
        "last_run": last,
    }


def list_jobs(org_id: str) -> list[dict]:
    _ensure_seeded(org_id)
    return [_job_payload(org_id, j) for j in _registry.list_jobs(org_id)]


def get_job(org_id: str, job_id: str) -> dict | None:
    _ensure_seeded(org_id)
    job = _registry.get_job(org_id, job_id)
    return _job_payload(org_id, job) if job else None


def update_job(org_id: str, job_id: str, patch: dict[str, Any]) -> dict:
    _ensure_seeded(org_id)
    if job_id not in _KNOWN_HANDLERS:
        raise ValueError(f"未知任务: {job_id}")
    if patch.get("category") and patch["category"] not in ("memory", "wiki", "other"):
        raise ValueError("category 须为 memory / wiki / other")
    updated = _registry.update_job(org_id, job_id, patch)
    if not updated:
        raise ValueError(f"任务不存在: {job_id}")
    log.info("[automation] updated  job=%s  org=%s", job_id, org_id)
    return _job_payload(org_id, updated)


def delete_job(org_id: str, job_id: str) -> bool:
    _ensure_seeded(org_id)
    if not _registry.delete_job(org_id, job_id):
        raise ValueError(f"任务不存在: {job_id}")
    log.info("[automation] deleted  job=%s  org=%s", job_id, org_id)
    return True


def reseed_deleted_builtins(org_id: str) -> list[dict]:
    """恢复所有已删除的内置任务。"""
    _ensure_seeded(org_id)
    restored: list[dict] = []
    for template in list_job_defs():
        row = _registry.get_job(org_id, template["id"], include_deleted=True)
        if row and row.get("deleted"):
            _registry.restore_job(org_id, template)
            job = _registry.get_job(org_id, template["id"])
            if job:
                restored.append(_job_payload(org_id, job))
    return restored


def restore_job(org_id: str, job_id: str) -> dict:
    """将内置任务恢复为 YAML 默认配置。"""
    template = get_job_def(job_id)
    if not template:
        raise ValueError(f"未知任务: {job_id}")
    _registry.restore_job(org_id, template)
    job = _registry.get_job(org_id, job_id)
    if not job:
        raise ValueError(f"恢复失败: {job_id}")
    return _job_payload(org_id, job)


def list_runs(org_id: str, job_id: str | None = None, limit: int = 50) -> list[dict]:
    return _registry.list_runs(org_id, job_id=job_id, limit=limit)


def delete_run(org_id: str, run_id: str) -> bool:
    if not _registry.delete_run(org_id, run_id):
        raise ValueError(f"运行记录不存在: {run_id}")
    return True


def run_job(
    org_id: str,
    job_id: str,
    user_id: str = "demo",
    params: dict[str, Any] | None = None,
    trigger: str = "manual",
) -> dict:
    job = get_job(org_id, job_id)
    if not job:
        raise ValueError(f"未知任务: {job_id}")

    merged = {**(job.get("defaults") or {}), **(params or {})}
    run_id = _registry.start(org_id, job_id, trigger=trigger)

    try:
        summary = _execute(job_id, org_id, user_id, merged)
        _registry.finish(run_id, status="done", summary=summary)
        log.info("[automation] done  job=%s  org=%s  run=%s", job_id, org_id, run_id[:8])
        run = _registry.get(run_id)
        return {"ok": True, "run": run}
    except Exception as exc:
        _registry.finish(run_id, status="error", error=str(exc))
        log.error("[automation] failed  job=%s  org=%s  err=%s", job_id, org_id, exc)
        run = _registry.get(run_id)
        return {"ok": False, "run": run, "error": str(exc)}


def _execute(job_id: str, org_id: str, user_id: str, params: dict[str, Any]) -> dict:
    if job_id == "recap_sessions":
        results = recap_idle_sessions(
            org_id,
            user_id,
            idle_hours=int(params.get("idle_hours", 24)),
            limit=int(params.get("limit", 10)),
        )
        return {
            "sessions_recapped": len(results),
            "sessions": [
                {
                    "session_id": r.session_id,
                    "summary": (r.summary or "")[:200],
                    "memories_updated": len(r.memory_ids),
                    "wiki_suggestions": len(r.wiki_suggestions),
                }
                for r in results
            ],
        }

    if job_id == "sync_vectors":
        result = sync_vectors(org_id, user_id, limit=int(params.get("limit", 200)))
        if not result.get("available"):
            raise RuntimeError("Qdrant 或 Embedding 服务不可用")
        return result

    if job_id == "resolve_candidates":
        results = resolve_pending_candidates(
            org_id, user_id, limit=int(params.get("limit", 30)),
        )
        approved = sum(1 for r in results if r.get("status") == "approved")
        conflict = sum(1 for r in results if r.get("status") == "conflict")
        return {
            "resolved": len(results),
            "approved": approved,
            "conflict": conflict,
            "items": results,
        }

    if job_id == "compile_candidates":
        results = compile_approved_candidates(
            org_id, user_id, limit=int(params.get("limit", 20)),
        )
        merged = sum(1 for r in results if r.get("status") == "merged")
        return {"compiled": len(results), "merged": merged, "items": results}

    raise ValueError(f"未实现的任务: {job_id}")
