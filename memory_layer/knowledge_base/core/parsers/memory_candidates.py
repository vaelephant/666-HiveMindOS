"""L1/L2 共用的 MemoryCandidate 解析与校验。"""

from __future__ import annotations

from memory_layer.knowledge_base.core.domain.taxonomy import p1_memory_types
from memory_layer.knowledge_base.core.parsers.llm_json import parse_json_object
from memory_layer.knowledge_base.models.memory import MemoryCandidate


def _build_memory_candidates(
    items: list,
    *,
    allowed_actions: frozenset[str],
) -> list[MemoryCandidate]:
    allowed_types = p1_memory_types()
    results: list[MemoryCandidate] = []
    for item in items:
        if not isinstance(item, dict):
            continue
        action = item.get("action", "create")
        if action == "skip" or action not in allowed_actions:
            continue
        mtype = item.get("memory_type", "")
        if mtype not in allowed_types:
            continue
        title = (item.get("title") or "").strip()
        content = (item.get("content") or "").strip()
        if not title or not content:
            continue
        importance = max(0.0, min(1.0, float(item.get("importance", 0.5))))
        match_title = (item.get("match_title") or "").strip() or None
        results.append(MemoryCandidate(
            action=action,
            memory_type=mtype,
            title=title,
            content=content,
            importance=importance,
            match_title=match_title,
        ))
    return results


def parse_memory_items(
    raw: str,
    *,
    allowed_actions: frozenset[str] | None = None,
) -> list[MemoryCandidate]:
    """从 LLM JSON 响应解析 memories 数组。"""
    actions = allowed_actions or frozenset({"create", "update"})
    try:
        data = parse_json_object(raw)
        items = data.get("memories") or []
    except (ValueError, TypeError):
        return []
    return _build_memory_candidates(items, allowed_actions=actions)


def parse_memory_list(
    items: list,
    *,
    allowed_actions: frozenset[str] | None = None,
) -> list[MemoryCandidate]:
    actions = allowed_actions or frozenset({"create", "update"})
    return _build_memory_candidates(items, allowed_actions=actions)


def parse_archive_items(raw_items: list) -> list[MemoryCandidate]:
    allowed_types = p1_memory_types()
    results: list[MemoryCandidate] = []
    for item in raw_items:
        if not isinstance(item, dict):
            continue
        mtype = item.get("memory_type", "")
        if mtype not in allowed_types:
            continue
        match_title = (item.get("match_title") or "").strip()
        if not match_title:
            continue
        reason = (item.get("reason") or "会话复盘归档").strip()
        results.append(MemoryCandidate(
            action="archive",
            memory_type=mtype,
            title=match_title,
            content=reason,
            importance=0.0,
            match_title=match_title,
        ))
    return results
