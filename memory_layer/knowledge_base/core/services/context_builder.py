"""
Context Builder — HiveMind 核心能力：Chat 回答前召回相关智慧。

与智慧提取（memory_service）形成闭环：
  对话 → 提取沉淀 → 本模块召回 → 注入 ChatAgent → 用户感受「系统记得我」

P3: Qdrant 语义检索（优先）
P2 fallback: 关键词 + 召回意图 + 重要度
"""

from __future__ import annotations

import re

from memory_layer.knowledge_base.app.logging_config import get_logger
from memory_layer.knowledge_base.core.registry.memory_registry import MemoryRegistry
from memory_layer.knowledge_base.core.vector.memory_vector_store import get_vector_store
from memory_layer.knowledge_base.core.domain.taxonomy import memory_type_label
from memory_layer.knowledge_base.models.memory import Memory
from memory_layer.knowledge_base.settings import load

log = get_logger("hivemind.context")

_registry = MemoryRegistry()


def _recall_cfg() -> dict:
    return load("recall")


def _keywords(text: str) -> list[str]:
    cjk = re.findall(r"[\u4e00-\u9fff]{2,}", text)
    latin = re.findall(r"[a-zA-Z0-9]{2,}", text.lower())
    return cjk + latin


def _has_recall_intent(question: str) -> bool:
    return any(h in question for h in _recall_cfg()["hints"])


def _keyword_score(question: str, memory: Memory) -> float:
    blob = f"{memory.title} {memory.content}"
    blob_lower = blob.lower()
    kw_score = 0.0
    for token in _keywords(question):
        tl = token.lower()
        if tl in blob_lower or token in blob:
            kw_score += 0.25
        if token in memory.title or tl in memory.title.lower():
            kw_score += 0.35
    base = memory.importance * 0.45 + kw_score
    if _has_recall_intent(question):
        base += 0.45
    return base


def _select_keyword(
    org_id: str,
    user_id: str,
    question: str,
    limit: int,
) -> list[Memory]:
    memories = _registry.list_active(org_id, user_id)
    if not memories:
        return []

    scored = [(_keyword_score(question, m), m) for m in memories]
    scored.sort(key=lambda x: x[0], reverse=True)

    if _has_recall_intent(question):
        selected = [m for s, m in scored if s >= _recall_cfg()["keyword_threshold"]][:limit]
        if not selected:
            selected = [m for _, m in scored[:limit]]
    else:
        selected = [m for s, m in scored if s >= _recall_cfg()["keyword_threshold"]][:limit]

    return selected


def _select_semantic(
    org_id: str,
    user_id: str,
    question: str,
    limit: int,
) -> list[Memory]:
    store = get_vector_store()
    if not store.is_available():
        return []

    hits = store.search(org_id, user_id, question, limit=limit * 2)
    if not hits:
        return []

    memories = _registry.get_by_ids(org_id, [h.memory_id for h in hits])
    by_id = {m.id: m for m in memories}

    scored: list[tuple[float, Memory]] = []
    for hit in hits:
        memory = by_id.get(hit.memory_id)
        if not memory:
            continue
        kw = min(_keyword_score(question, memory) * 0.25, 0.2)
        final = 0.65 * hit.score + 0.2 * memory.importance + kw
        if _has_recall_intent(question):
            final += 0.08
        scored.append((final, memory))

    scored.sort(key=lambda x: x[0], reverse=True)
    threshold = _recall_cfg()["semantic_threshold"] - (0.08 if _has_recall_intent(question) else 0.0)
    selected = [m for s, m in scored if s >= threshold][:limit]

    if selected:
        log.info(
            "[context] semantic=%d  org=%s  q=%s…  titles=%s",
            len(selected),
            org_id,
            question[:40],
            [m.title for m in selected],
        )
    return selected


def select_relevant_memories(
    org_id: str,
    user_id: str,
    question: str,
    limit: int | None = None,
) -> list[Memory]:
    if limit is None:
        limit = _recall_cfg()["max_memories"]
    semantic = _select_semantic(org_id, user_id, question, limit)
    if semantic:
        return semantic

    selected = _select_keyword(org_id, user_id, question, limit)
    if selected:
        log.info(
            "[context] keyword=%d  org=%s  q=%s…  titles=%s",
            len(selected),
            org_id,
            question[:40],
            [m.title for m in selected],
        )
    return selected


def format_memory_block(memories: list[Memory]) -> str:
    if not memories:
        return ""
    lines = ["## 用户长期智慧（从过往对话自动沉淀，回答时可结合使用）"]
    for m in memories:
        label = memory_type_label(m.memory_type)
        lines.append(f"- [{label}] {m.title}：{m.content}")
    return "\n".join(lines)


def build_context(org_id: str, user_id: str, question: str) -> tuple[str, list[dict]]:
    """Returns (prompt_block, memories_used dicts for API response)."""
    selected = select_relevant_memories(org_id, user_id, question)
    block = format_memory_block(selected)
    used = [
        {
            "id": m.id,
            "memory_type": m.memory_type,
            "title": m.title,
            "content": m.content,
            "importance": m.importance,
        }
        for m in selected
    ]
    return block, used
