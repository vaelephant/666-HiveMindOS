import uuid
from concurrent.futures import ThreadPoolExecutor
from dataclasses import asdict
from datetime import datetime, timezone

from fastapi import APIRouter, BackgroundTasks, HTTPException
from pydantic import BaseModel

from agent_engine.domain.task_present import task_to_api_dict
from agent_engine.models.task import Task
from agent_engine.registry.task_registry import TaskRegistry
from agent_engine.services.task_service import list_experiences, run_goal
from knowledge_base import config
from server.logging_config import get_logger

router = APIRouter()
log = get_logger("hivemind.tasks")

_registry = TaskRegistry(config.TASK_DB)
_pool = ThreadPoolExecutor(max_workers=4, thread_name_prefix="task-worker")


class TaskRequest(BaseModel):
    input: str
    constraints: dict | None = None
    user_id: str | None = None
    auto_run: bool = True


class ApproveRequest(BaseModel):
    from_task: str | None = None


def _run_task(task_id: str, org_id: str, resume_from: str | None = None):
    run_goal(task_id, org_id, resume_from=resume_from)


@router.post("/orgs/{org_id}/tasks")
def create_task(org_id: str, req: TaskRequest, background_tasks: BackgroundTasks):
    constraints = dict(req.constraints or {})
    if req.user_id:
        constraints["user_id"] = req.user_id
    task = Task(
        id=str(uuid.uuid4()),
        org_id=org_id,
        input=req.input,
        status="pending",
        phase="pending",
        constraints=constraints,
        created_at=datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
    )
    _registry.add(task)
    if req.auto_run:
        background_tasks.add_task(_run_task, task.id, org_id)
    log.info("[task] created  id=%s  org=%s", task.id[:8], org_id)
    return asdict(_registry.get(task.id))


@router.get("/orgs/{org_id}/tasks")
def list_tasks(org_id: str, limit: int = 20):
    tasks = _registry.list(org_id, limit)
    return {"tasks": [task_to_api_dict(t) for t in tasks]}


@router.get("/orgs/{org_id}/tasks/{task_id}")
def get_task(org_id: str, task_id: str):
    task = _registry.get(task_id)
    if not task or task.org_id != org_id:
        raise HTTPException(status_code=404, detail="任务不存在")
    return task_to_api_dict(task)


@router.post("/orgs/{org_id}/tasks/{task_id}/approve")
def approve_task(org_id: str, task_id: str, req: ApproveRequest, background_tasks: BackgroundTasks):
    task = _registry.get(task_id)
    if not task or task.org_id != org_id:
        raise HTTPException(status_code=404, detail="任务不存在")
    if task.phase != "awaiting_approval":
        raise HTTPException(status_code=400, detail="任务不在待批准状态")
    from_task = req.from_task or task.pending_step_id
    background_tasks.add_task(_run_task, task_id, org_id, from_task)
    return asdict(_registry.get(task_id))


@router.post("/orgs/{org_id}/tasks/{task_id}/cancel")
def cancel_task(org_id: str, task_id: str):
    task = _registry.get(task_id)
    if not task or task.org_id != org_id:
        raise HTTPException(status_code=404, detail="任务不存在")
    _registry.update(
        task_id,
        phase="error",
        status="error",
        error="用户取消",
        completed_at=datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
    )
    return {"cancelled": task_id}


@router.delete("/orgs/{org_id}/tasks/{task_id}")
def delete_task(org_id: str, task_id: str):
    task = _registry.get(task_id)
    if not task or task.org_id != org_id:
        raise HTTPException(status_code=404, detail="任务不存在")
    with _registry._conn() as conn:
        conn.execute("DELETE FROM tasks WHERE id = ?", (task_id,))
    return {"deleted": task_id}


@router.get("/orgs/{org_id}/experiences")
def get_experiences(org_id: str, task_type: str | None = None, limit: int = 20):
    return {"experiences": list_experiences(org_id, task_type=task_type, limit=limit)}
