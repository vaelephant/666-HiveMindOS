"""经验召回 — SQLite + Qdrant 语义检索（Phase 1.5）。"""

from __future__ import annotations

from knowledge_base import config
from agent_engine.registry.experience_registry import ExperienceRegistry
from knowledge_base.core.vector.experience_vector_store import get_experience_vector_store

_registry = ExperienceRegistry(config.TASK_DB)


def recall_for_planner(
    org_id: str,
    task_type: str,
    goal: str,
    *,
    limit: int = 2,
) -> list[dict]:
    """Planner 输入：优先向量相似经验，否则取最近高分记录。"""
    store = get_experience_vector_store()
    if store.is_available():
        hits = store.search(org_id, task_type, goal, limit=limit)
        if hits:
            return hits
    return _registry.latest_high_score(org_id, task_type, limit=limit)


def save_experience_with_vector(
    org_id: str,
    task_type: str,
    goal: str,
    *,
    success: bool,
    score: int | None,
    workflow: list,
    reflection: dict | None = None,
    final_output: str | None = None,
) -> str:
    exp_id = _registry.save(
        org_id,
        task_type,
        goal,
        success=success,
        score=score,
        workflow=workflow,
        reflection=reflection,
        final_output=final_output,
    )
    if success and score is not None:
        get_experience_vector_store().upsert(
            exp_id, org_id, task_type, goal, workflow, score,
        )
    return exp_id
