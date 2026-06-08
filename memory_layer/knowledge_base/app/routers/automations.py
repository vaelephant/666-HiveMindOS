from typing import Any

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

from memory_layer.knowledge_base.app.logging_config import get_logger
from memory_layer.knowledge_base.core.services.automation_service import (
    delete_job,
    delete_run,
    list_jobs,
    list_runs,
    reseed_deleted_builtins,
    restore_job,
    run_job,
    update_job,
)

router = APIRouter()
log = get_logger("hivemind.automations")


@router.get("/orgs/{org_id}/automations")
def get_automations(org_id: str):
    """列出自动化任务定义及最近一次运行记录。"""
    try:
        return {"jobs": list_jobs(org_id)}
    except Exception as exc:
        log.error("[automation] list failed: %s", exc)
        raise HTTPException(status_code=503, detail=str(exc)) from exc


@router.get("/orgs/{org_id}/automations/runs")
def get_automation_runs(
    org_id: str,
    job_id: str | None = Query(default=None),
    limit: int = Query(default=50, ge=1, le=200),
):
    try:
        return {"runs": list_runs(org_id, job_id=job_id, limit=limit)}
    except Exception as exc:
        log.error("[automation] runs failed: %s", exc)
        raise HTTPException(status_code=503, detail=str(exc)) from exc


class UpdateAutomationRequest(BaseModel):
    label: str | None = None
    description: str | None = None
    category: str | None = None
    cron_hint: str | None = None
    defaults: dict[str, Any] | None = None


@router.put("/orgs/{org_id}/automations/{job_id}")
def patch_automation(org_id: str, job_id: str, req: UpdateAutomationRequest):
    """修改自动化任务配置（名称、描述、调度、默认参数）。"""
    try:
        job = update_job(org_id, job_id, req.model_dump(exclude_none=True))
        return {"job": job}
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except Exception as exc:
        log.error("[automation] update failed: %s", exc)
        raise HTTPException(status_code=503, detail=str(exc)) from exc


@router.delete("/orgs/{org_id}/automations/{job_id}")
def remove_automation(org_id: str, job_id: str):
    """删除（隐藏）自动化任务；内置任务可 POST restore 恢复。"""
    try:
        delete_job(org_id, job_id)
        return {"ok": True, "job_id": job_id}
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except Exception as exc:
        log.error("[automation] delete failed: %s", exc)
        raise HTTPException(status_code=503, detail=str(exc)) from exc


@router.post("/orgs/{org_id}/automations/reseed")
def reseed_automations(org_id: str):
    """恢复所有已删除的内置任务。"""
    try:
        jobs = reseed_deleted_builtins(org_id)
        return {"restored": jobs, "count": len(jobs)}
    except Exception as exc:
        log.error("[automation] reseed failed: %s", exc)
        raise HTTPException(status_code=503, detail=str(exc)) from exc


@router.post("/orgs/{org_id}/automations/{job_id}/restore")
def restore_automation(org_id: str, job_id: str):
    """将内置任务恢复为 YAML 默认配置。"""
    try:
        job = restore_job(org_id, job_id)
        return {"job": job}
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except Exception as exc:
        log.error("[automation] restore failed: %s", exc)
        raise HTTPException(status_code=503, detail=str(exc)) from exc


class RunAutomationRequest(BaseModel):
    user_id: str = "demo"
    params: dict[str, Any] = {}


@router.post("/orgs/{org_id}/automations/{job_id}/run")
def trigger_automation(org_id: str, job_id: str, req: RunAutomationRequest):
    """手动触发一条自动化任务。"""
    try:
        result = run_job(org_id, job_id, user_id=req.user_id, params=req.params)
        if not result.get("ok"):
            raise HTTPException(status_code=500, detail=result.get("error", "执行失败"))
        return result
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except HTTPException:
        raise
    except Exception as exc:
        log.error("[automation] run failed: %s", exc)
        raise HTTPException(status_code=503, detail=str(exc)) from exc


@router.delete("/orgs/{org_id}/automations/runs/{run_id}")
def remove_automation_run(org_id: str, run_id: str):
    """删除一条运行记录。"""
    try:
        delete_run(org_id, run_id)
        return {"ok": True, "run_id": run_id}
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except Exception as exc:
        log.error("[automation] delete run failed: %s", exc)
        raise HTTPException(status_code=503, detail=str(exc)) from exc
