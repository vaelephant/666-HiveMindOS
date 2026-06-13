"""工作流 cron 调度 — 进程内 tick 或 CLI 脚本。"""

from __future__ import annotations

import asyncio
import os
from concurrent.futures import ThreadPoolExecutor

from server.logging_config import get_logger
from knowledge_base.core.services import workflow_service

log = get_logger("hivemind.workflow.scheduler")

_executor = ThreadPoolExecutor(max_workers=2, thread_name_prefix="wf-scheduler")
_task: asyncio.Task | None = None


def _tick_seconds() -> int:
    try:
        return max(15, int(os.environ.get("WORKFLOW_SCHEDULER_TICK_SECONDS", "60")))
    except ValueError:
        return 60


def run_scheduled_tick(org_id: str | None = None) -> list[dict]:
    """
    扫描已启用 schedule 的工作流并执行到期项。
    org_id 可选，限制单 org（CLI 用）。
    """
    due_items = workflow_service.list_due_scheduled(org_id)
    results: list[dict] = []

    for item in due_items:
        org = item["org_id"]
        wf_id = item["id"]
        slot = item["cron_slot"]
        user_id = item.get("schedule_user_id") or "demo"
        slot_iso = slot.isoformat() if slot else None

        log.info(
            "[workflow.scheduler] firing  org=%s  wf=%s  slot=%s",
            org, wf_id, slot_iso,
        )
        try:
            if slot_iso:
                workflow_service.mark_cron_slot(org, wf_id, slot_iso)
            outcome = workflow_service.run_workflow(
                org, wf_id, user_id=user_id, trigger="cron",
            )
            results.append({
                "org_id": org,
                "workflow_id": wf_id,
                "ok": outcome.get("ok", False),
                "run_id": (outcome.get("run") or {}).get("id"),
                "error": outcome.get("error"),
            })
        except Exception as exc:
            log.error(
                "[workflow.scheduler] failed  org=%s  wf=%s  err=%s",
                org, wf_id, exc,
            )
            results.append({
                "org_id": org,
                "workflow_id": wf_id,
                "ok": False,
                "error": str(exc),
            })

    if results:
        log.info("[workflow.scheduler] tick done  fired=%d", len(results))
    return results


async def _loop() -> None:
    interval = _tick_seconds()
    log.info("[workflow.scheduler] started  tick=%ds", interval)
    while True:
        try:
            await asyncio.get_event_loop().run_in_executor(_executor, run_scheduled_tick)
        except Exception as exc:
            log.error("[workflow.scheduler] tick error: %s", exc)
        await asyncio.sleep(interval)


def start_scheduler() -> asyncio.Task:
    """在 FastAPI lifespan 中启动后台调度。"""
    global _task
    if _task is not None and not _task.done():
        return _task
    _task = asyncio.create_task(_loop(), name="workflow-scheduler")
    return _task


async def stop_scheduler() -> None:
    global _task
    if _task is None:
        return
    _task.cancel()
    try:
        await _task
    except asyncio.CancelledError:
        pass
    _task = None
    log.info("[workflow.scheduler] stopped")
