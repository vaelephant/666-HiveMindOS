"""Wiki 目录与页面元数据 — 读取 settings/wiki.yaml。"""

from __future__ import annotations

from functools import lru_cache

from knowledge_base.settings import load


@lru_cache(maxsize=1)
def _cfg() -> dict:
    return load("wiki")


@lru_cache(maxsize=1)
def _folder_to_category() -> dict[str, str]:
    return {folder: cat for cat, folder in _cfg()["category_folders"].items()}


def category_folder(category: str) -> str:
    return _cfg()["category_folders"].get(category, _cfg().get("default_folder", "digests"))


def folder_to_category(folder: str) -> str:
    return _folder_to_category().get(folder, "other")


def folder_meta(key: str) -> dict:
    known = _cfg()["folders"].get(key)
    if known:
        return {"key": key, **known}
    return {"key": key, "label": key, "description": "", "order": 99}


def folder_kind(folder: str) -> str | None:
    entry = _cfg()["folders"].get(folder)
    return entry.get("kind") if entry else None


def kind_label(kind: str) -> str:
    return _cfg()["kind_labels"].get(kind, "知识页")


def source_type_label(source_type: str) -> str:
    labels = _cfg().get("source_type_labels") or {}
    return labels.get(source_type, source_type.upper())


def page_pipeline_stages() -> list[dict[str, str]]:
    return list(_cfg().get("page_pipeline") or [])
