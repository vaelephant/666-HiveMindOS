"""自动化任务编排 — YAML 种子 + SQLite 可修改/删除。"""

from __future__ import annotations

from typing import Any

from knowledge_base import config
from server.logging_config import get_logger
from knowledge_base.core.domain.automation_meta import (
    category_label,
    get_job_def,
    list_job_defs,
)
from knowledge_base.core.registry.automation_registry import AutomationRegistry
from knowledge_base.core.services.candidate_service import (
    compile_approved_candidates,
    resolve_pending_candidates,
)
from knowledge_base.core.services.memory_service import (
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
    "daily_digest",
    "lint_wiki",
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


def execute_automation_job(
    job_id: str,
    org_id: str,
    user_id: str,
    params: dict[str, Any],
) -> dict:
    """供工作流引擎调用的自动化单步执行（不写 automation_runs）。"""
    return _execute(job_id, org_id, user_id, params)


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

    if job_id == "daily_digest":
        return _run_daily_digest(org_id, user_id, params)

    if job_id == "lint_wiki":
        return _run_lint_wiki(org_id, user_id)

    raise ValueError(f"未实现的任务: {job_id}")


def _run_lint_wiki(org_id: str, user_id: str) -> dict:
    from knowledge_base.core.pipelines.lint_agent import LintAgent
    from knowledge_base.core.services import audit_service
    from knowledge_base.core.wiki.wiki_manager import WikiManager

    wiki = WikiManager(config.WIKI_ROOT)
    report = LintAgent(wiki).run(org_id)
    issues = report.get("issues") or []
    warnings = sum(1 for i in issues if i.get("severity") == "warning")
    audit_service.log_event(
        org_id,
        user_id=user_id,
        category="lint",
        action="wiki.lint",
        resource_type="wiki",
        summary=(
            f"检查了 {report.get('total_pages', 0)} 篇 Wiki"
            + (f"，发现 {len(issues)} 处提示" if issues else "，未发现明显问题")
        ),
        detail={
            "total_pages": report.get("total_pages"),
            "issues_found": report.get("issues_found"),
            "issues": issues[:30],
        },
    )
    return report


def _run_daily_digest(org_id: str, user_id: str, params: dict[str, Any]) -> dict:
    """Agent-style digest: summarize recent memories + chat activity."""
    from knowledge_base.core.registry.chat_registry import ChatRegistry
    from knowledge_base.core.registry.memory_registry import MemoryRegistry
    from model_layer import client as llm

    days = int(params.get("days") or 1)
    mem_reg = MemoryRegistry()
    chat_reg = ChatRegistry()
    memories = mem_reg.list_active(org_id, user_id, limit=15)
    stats = chat_reg.get_org_stats(org_id, user_id)

    mem_lines = [
        f"- [{m.memory_type}] {m.title}: {m.content[:120]}"
        for m in memories[:10]
    ]
    prompt = f"""你是 HiveMind 每日摘要助手。根据以下数据写一段 150~300 字的中文摘要，面向企业用户，突出新智慧与使用概况。

统计（近 {days} 天语境）：
- 活跃会话数：{stats.get('session_count', 0)}
- 消息总数：{stats.get('message_count', 0)}
- 近 7 日新会话：{stats.get('sessions_week', 0)}

近期智慧（最多 10 条）：
{chr(10).join(mem_lines) if mem_lines else "（暂无）"}

只输出摘要正文，不要标题。"""

    from knowledge_base.core.services.model_settings_service import get_settings as get_model_settings
    from model_layer.usage import track_usage

    fast_profile = get_model_settings(org_id, user_id).fast_profile
    with track_usage(org_id, user_id, "automation", job_id):
        digest = llm.complete(prompt=prompt, profile=fast_profile).strip()
    result: dict[str, Any] = {
        "digest": digest,
        "memories_count": len(memories),
        "stats": stats,
    }

    if params.get("deliver_wechat") and params.get("wechat_userid"):
        try:
            from integrations.wechat_work.client import WeChatWorkClient
            from integrations.wechat_work.registry import WeChatWorkRegistry

            wx_reg = WeChatWorkRegistry()
            cfg = wx_reg.get_org_config(org_id)
            if cfg and cfg.enabled:
                client = WeChatWorkClient(cfg.corp_id, cfg.secret)
                client.send_text(cfg.agent_id, str(params["wechat_userid"]), digest[:2000])
                result["wechat_delivered"] = True
            else:
                result["wechat_delivered"] = False
                result["wechat_error"] = "企微未启用"
        except Exception as exc:
            result["wechat_delivered"] = False
            result["wechat_error"] = str(exc)

    return result
