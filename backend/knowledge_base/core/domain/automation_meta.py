"""自动化任务元数据 — 读取 settings/automations.yaml。"""

from __future__ import annotations

from functools import lru_cache

from knowledge_base.settings import load


@lru_cache(maxsize=1)
def _cfg() -> dict:
    return load("automations")


def list_job_defs() -> list[dict]:
    return list(_cfg().get("jobs") or [])


def get_job_def(job_id: str) -> dict | None:
    for job in list_job_defs():
        if job["id"] == job_id:
            return job
    return None


def category_label(category: str) -> str:
    return (_cfg().get("category_labels") or {}).get(category, category)
