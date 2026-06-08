"""知识管线阶段与状态文案 — 读取 settings/pipeline.yaml。"""

from __future__ import annotations

from functools import lru_cache

from memory_layer.knowledge_base.settings import load


@lru_cache(maxsize=1)
def _cfg() -> dict:
    return load("pipeline")


def stage_meta() -> list[tuple[str, str, str]]:
    return [(s["id"], s["label"], s["description"]) for s in _cfg()["stages"]]


def memory_event_label(event_type: str) -> str:
    return _cfg()["memory_event_labels"].get(event_type, event_type)


def candidate_status_label(status: str) -> str:
    return _cfg()["candidate_status_labels"].get(status, status)
