"""工作流模板元数据 — 读取 settings/workflow_templates.yaml。"""

from __future__ import annotations

from functools import lru_cache

from knowledge_base.settings import load


@lru_cache(maxsize=1)
def _cfg() -> dict:
    return load("workflow_templates")


def list_templates() -> list[dict]:
    return list(_cfg().get("templates") or [])


def get_template(template_id: str) -> dict | None:
    for tpl in list_templates():
        if tpl["id"] == template_id:
            return tpl
    return None


def category_label(category: str) -> str:
    return (_cfg().get("category_labels") or {}).get(category, category)
