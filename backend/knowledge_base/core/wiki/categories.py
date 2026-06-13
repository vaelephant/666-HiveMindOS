"""Wiki category metadata — 读取 settings/wiki.yaml，不再硬编码。"""

from __future__ import annotations

from knowledge_base.core.domain.wiki_meta import folder_meta

__all__ = ["category_meta"]


def category_meta(key: str) -> dict:
    return folder_meta(key)
