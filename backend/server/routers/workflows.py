from typing import Any

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

from server.logging_config import get_logger
from knowledge_base.core.services.workflow_service import (
    create_from_template,
    create_from_yaml,
    delete_run,
    delete_workflow,
    get_workflow,
    list_runs,
    list_workflow_templates,
    list_workflows,
    restore_workflow,
    run_workflow,
    set_workflow_schedule,
    update_workflow_yaml,
)
from knowledge_base.core.parsers.workflow_yaml import workflow_to_yaml

router = APIRouter()
log = get_logger("hivemind.workflows")


@router.get("/orgs/{org_id}/workflows")
def get_workflows(org_id: str):
    try:
        return {"workflows": list_workflows(org_id)}
    except Exception as exc:
        log.error("[workflow] list failed: %s", exc)
        raise HTTPException(status_code=503, detail=str(exc)) from exc


@router.get("/orgs/{org_id}/workflows/templates")
def get_workflow_templates():
    return {"templates": list_workflow_templates()}


@router.get("/orgs/{org_id}/workflows/runs")
def get_workflow_runs(
    org_id: str,
    workflow_id: str | None = Query(default=None),
    limit: int = Query(default=50, ge=1, le=200),
):
    try:
        return {"runs": list_runs(org_id, workflow_id=workflow_id, limit=limit)}
    except Exception as exc:
        log.error("[workflow] runs failed: %s", exc)
        raise HTTPException(status_code=503, detail=str(exc)) from exc


@router.get("/orgs/{org_id}/workflows/{workflow_id}")
def get_one_workflow(org_id: str, workflow_id: str):
    wf = get_workflow(org_id, workflow_id)
    if not wf:
        raise HTTPException(status_code=404, detail="工作流不存在")
    yaml_source = wf.get("yaml_source") or workflow_to_yaml(wf)
    return {"workflow": wf, "yaml": yaml_source}


class WorkflowYamlRequest(BaseModel):
    yaml: str


@router.post("/orgs/{org_id}/workflows")
def create_workflow(org_id: str, req: WorkflowYamlRequest):
    try:
        wf = create_from_yaml(org_id, req.yaml)
        return {"workflow": wf}
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        log.error("[workflow] create failed: %s", exc)
        raise HTTPException(status_code=503, detail=str(exc)) from exc


@router.post("/orgs/{org_id}/workflows/from-template/{template_id}")
def create_workflow_from_template(org_id: str, template_id: str):
    try:
        wf = create_from_template(org_id, template_id)
        return {"workflow": wf}
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        log.error("[workflow] from-template failed: %s", exc)
        raise HTTPException(status_code=503, detail=str(exc)) from exc


@router.put("/orgs/{org_id}/workflows/{workflow_id}")
def patch_workflow(org_id: str, workflow_id: str, req: WorkflowYamlRequest):
    try:
        wf = update_workflow_yaml(org_id, workflow_id, req.yaml)
        return {"workflow": wf}
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        log.error("[workflow] update failed: %s", exc)
        raise HTTPException(status_code=503, detail=str(exc)) from exc


@router.delete("/orgs/{org_id}/workflows/{workflow_id}")
def remove_workflow(org_id: str, workflow_id: str):
    try:
        delete_workflow(org_id, workflow_id)
        return {"ok": True, "workflow_id": workflow_id}
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except Exception as exc:
        log.error("[workflow] delete failed: %s", exc)
        raise HTTPException(status_code=503, detail=str(exc)) from exc


@router.post("/orgs/{org_id}/workflows/{workflow_id}/restore")
def restore_builtin_workflow(org_id: str, workflow_id: str):
    try:
        wf = restore_workflow(org_id, workflow_id)
        return {"workflow": wf}
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except Exception as exc:
        log.error("[workflow] restore failed: %s", exc)
        raise HTTPException(status_code=503, detail=str(exc)) from exc


class RunWorkflowRequest(BaseModel):
    user_id: str = "demo"
    params: dict[str, Any] = {}


class ScheduleWorkflowRequest(BaseModel):
    enabled: bool
    user_id: str = "demo"


@router.patch("/orgs/{org_id}/workflows/{workflow_id}/schedule")
def patch_workflow_schedule(org_id: str, workflow_id: str, req: ScheduleWorkflowRequest):
    try:
        wf = set_workflow_schedule(
            org_id,
            workflow_id,
            enabled=req.enabled,
            user_id=req.user_id,
        )
        return {"workflow": wf}
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        log.error("[workflow] schedule failed: %s", exc)
        raise HTTPException(status_code=503, detail=str(exc)) from exc


@router.post("/orgs/{org_id}/workflows/{workflow_id}/run")
def trigger_workflow(org_id: str, workflow_id: str, req: RunWorkflowRequest):
    try:
        result = run_workflow(
            org_id,
            workflow_id,
            user_id=req.user_id,
            params=req.params,
        )
        if not result.get("ok"):
            raise HTTPException(status_code=500, detail=result.get("error", "执行失败"))
        return result
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except HTTPException:
        raise
    except Exception as exc:
        log.error("[workflow] run failed: %s", exc)
        raise HTTPException(status_code=503, detail=str(exc)) from exc


@router.delete("/orgs/{org_id}/workflows/runs/{run_id}")
def remove_workflow_run(org_id: str, run_id: str):
    try:
        delete_run(org_id, run_id)
        return {"ok": True, "run_id": run_id}
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except Exception as exc:
        log.error("[workflow] delete run failed: %s", exc)
        raise HTTPException(status_code=503, detail=str(exc)) from exc
