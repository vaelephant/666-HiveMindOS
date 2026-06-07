import uuid
from concurrent.futures import ThreadPoolExecutor
from dataclasses import asdict
from datetime import datetime, timezone

from fastapi import APIRouter, BackgroundTasks, HTTPException
from pydantic import BaseModel

from memory_layer.knowledge_base import config
from memory_layer.knowledge_base.app.logging_config import get_logger
from memory_layer.knowledge_base.core.agents.task_agent import TaskAgent
from memory_layer.knowledge_base.core.graph.memory_graph import MemoryGraph
from memory_layer.knowledge_base.core.registry.task_registry import TaskRegistry
from memory_layer.knowledge_base.core.wiki.wiki_manager import WikiManager
from memory_layer.knowledge_base.models.task import Task

router = APIRouter()
log = get_logger("hivemind.tasks")

_registry = TaskRegistry(config.TASK_DB)
_pool = ThreadPoolExecutor(max_workers=4, thread_name_prefix="task-worker")


class TaskRequest(BaseModel):
    input: str


def _run_task(task_id: str, org_id: str):
    _registry.update(task_id, status="running")
    log.info("[task] running  id=%s", task_id[:8])
    try:
        wiki = WikiManager(config.WIKI_ROOT)
        graph = MemoryGraph(config.GRAPH_ROOT / org_id / "graph.db")
        task = _registry.get(task_id)

        accumulated_steps: list[dict] = []

        def on_step(step: dict):
            accumulated_steps.append(step)
            _registry.update(task_id, steps=list(accumulated_steps))
            log.debug("[task] step  tool=%s  args=%s", step["tool"], step["args"])

        answer, steps = TaskAgent(wiki, graph).run(task, on_step=on_step)
        _registry.update(
            task_id,
            status="done",
            result=answer,
            steps=steps,
            completed_at=datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        )
    except Exception as exc:
        log.error("[task] error  id=%s  err=%s", task_id[:8], exc)
        _registry.update(
            task_id,
            status="error",
            error=str(exc),
            completed_at=datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        )


@router.post("/orgs/{org_id}/tasks")
def create_task(org_id: str, req: TaskRequest, background_tasks: BackgroundTasks):
    task = Task(
        id=str(uuid.uuid4()),
        org_id=org_id,
        input=req.input,
        status="pending",
        created_at=datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
    )
    _registry.add(task)
    background_tasks.add_task(_run_task, task.id, org_id)
    log.info("[task] created  id=%s  org=%s", task.id[:8], org_id)
    return asdict(task)


@router.get("/orgs/{org_id}/tasks")
def list_tasks(org_id: str, limit: int = 20):
    tasks = _registry.list(org_id, limit)
    return {"tasks": [asdict(t) for t in tasks]}


@router.get("/orgs/{org_id}/tasks/{task_id}")
def get_task(org_id: str, task_id: str):
    task = _registry.get(task_id)
    if not task or task.org_id != org_id:
        raise HTTPException(status_code=404, detail="任务不存在")
    return asdict(task)


@router.delete("/orgs/{org_id}/tasks/{task_id}")
def delete_task(org_id: str, task_id: str):
    task = _registry.get(task_id)
    if not task or task.org_id != org_id:
        raise HTTPException(status_code=404, detail="任务不存在")
    with _registry._conn() as conn:
        conn.execute("DELETE FROM tasks WHERE id = ?", (task_id,))
    return {"deleted": task_id}
