"""记忆 / 候选 / Wiki 分类词汇表 — 读取 settings/taxonomy.yaml。"""

from __future__ import annotations

from functools import lru_cache

from memory_layer.knowledge_base.settings import load


@lru_cache(maxsize=1)
def _cfg() -> dict:
    return load("taxonomy")


def p1_memory_types() -> tuple[str, ...]:
    return tuple(_cfg()["memory_types"]["p1"])


def ingest_l3_memory_types() -> tuple[str, ...]:
    return tuple(_cfg()["memory_types"]["ingest_l3"])


def memory_type_label(memory_type: str) -> str:
    return _cfg()["memory_types"]["labels"].get(memory_type, memory_type)


def memory_type_labels() -> dict[str, str]:
    return dict(_cfg()["memory_types"]["labels"])


def memory_type_to_category(memory_type: str) -> str:
    return _cfg()["memory_to_category"].get(memory_type, "other")


def category_to_memory_type(category: str) -> str:
    return _cfg()["category_to_memory"].get(category, "fact")


def normalize_category(category: str) -> str:
    """归一化候选分类（含 L2 复盘的 entities/workflows 等别名）。"""
    aliases = _cfg().get("category_aliases") or {}
    return aliases.get(category, category)


def wiki_categories() -> frozenset[str]:
    return frozenset(_cfg()["wiki_categories"])


def is_wiki_category(category: str) -> bool:
    return normalize_category(category) in wiki_categories()


def category_label(category: str) -> str:
    norm = normalize_category(category)
    return _cfg()["category_labels"].get(norm, norm)


def category_labels() -> dict[str, str]:
    return dict(_cfg()["category_labels"])
