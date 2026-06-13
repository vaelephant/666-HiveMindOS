"""L3 文档智慧提炼 — MemoryCandidate 解析。"""

from __future__ import annotations

from knowledge_base.core.domain.taxonomy import ingest_l3_memory_types
from knowledge_base.core.parsers.llm_json import parse_json_object
from knowledge_base.models.memory import MemoryCandidate


def parse_doc_memory_items(raw: str) -> list[MemoryCandidate]:
    allowed_types = ingest_l3_memory_types()
    try:
        data = parse_json_object(raw)
        items = data.get("memories") or []
    except (ValueError, TypeError):
        return []

    results: list[MemoryCandidate] = []
    for item in items:
        if not isinstance(item, dict):
            continue
        action = item.get("action", "create")
        if action != "create":
            continue
        mtype = item.get("memory_type", "")
        if mtype not in allowed_types:
            continue
        title = (item.get("title") or "").strip()
        content = (item.get("content") or "").strip()
        if not title or not content:
            continue
        importance = max(0.0, min(1.0, float(item.get("importance", 0.5))))
        results.append(MemoryCandidate(
            action="create",
            memory_type=mtype,
            title=title,
            content=content,
            importance=importance,
            match_title=None,
        ))
    return results
