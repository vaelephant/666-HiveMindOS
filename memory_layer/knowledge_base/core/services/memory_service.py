"""
智慧提取管线 — HiveMind 核心能力（异步，不阻塞 Chat 回答）。

每轮 Chat 结束后触发：
  1. 加载已有智慧 + 最近对话语境
  2. MemoryExtractor 判断记什么（项目 / 偏好 / 决策·里程碑）
  3. 写入 PostgreSQL + 进化事件
  4. 同步 Qdrant 向量（P3 语义召回）

前端「智慧进化」页的数据来源即此管线。
"""

from __future__ import annotations

from dataclasses import asdict

from memory_layer.knowledge_base.app.logging_config import get_logger
from memory_layer.knowledge_base.core.agents.memory_extractor import MemoryExtractor
from memory_layer.knowledge_base.core.registry.chat_registry import ChatRegistry
from memory_layer.knowledge_base.core.registry.memory_registry import MemoryRegistry
from memory_layer.knowledge_base.core.vector.memory_vector_store import get_vector_store

log = get_logger("hivemind.memory.service")

_registry = MemoryRegistry()
_chat_registry = ChatRegistry()
_extractor = MemoryExtractor()

# 提取时带入最近几轮对话，避免「22号交工」脱离项目语境
_RECENT_CONTEXT_MESSAGES = 6


def extract_from_turn(
    org_id: str,
    user_id: str,
    session_id: str,
    question: str,
    answer: str,
) -> list[int]:
    """
    核心入口：从一轮 Chat 提取 0~N 条智慧。

    由 chat router 的 BackgroundTasks 在回答返回后异步调用。
    """
    try:
        existing = _registry.list_active(org_id, user_id)
        existing_dicts = [asdict(m) for m in existing]

        # 最近对话（不含本轮 user+assistant，本轮由 question/answer 单独传入）
        recent_turns = _recent_session_context(session_id)

        candidates = _extractor.run(
            question,
            answer,
            existing_dicts,
            recent_turns=recent_turns,
        )
        if not candidates:
            log.debug("[memory] nothing to extract  session=%s", session_id[:8])
            return []

        ids = _registry.apply_candidates(org_id, user_id, candidates, session_id)
        _index_memories(org_id, ids)
        log.info(
            "[memory] extracted  org=%s  session=%s  count=%d  ids=%s  types=%s",
            org_id,
            session_id[:8],
            len(ids),
            ids,
            [c.memory_type for c in candidates],
        )
        return ids
    except Exception as exc:
        log.error("[memory] extraction failed  session=%s  err=%s", session_id[:8], exc)
        return []


def _recent_session_context(session_id: str) -> list[dict]:
    """取 session 内当前轮之前的最近消息，供 Extractor 关联项目与日期。"""
    history = _chat_registry.get_history(session_id)
    if len(history) <= 2:
        return []
    prior = history[:-2]
    return prior[-_RECENT_CONTEXT_MESSAGES:]


def _index_memories(org_id: str, memory_ids: list[int]) -> None:
    store = get_vector_store()
    if not store.is_available():
        return
    for mid in memory_ids:
        memory = _registry.get_by_id(mid, org_id)
        if memory and memory.status == "active":
            store.upsert_memory(memory)


def sync_vectors(org_id: str, user_id: str, limit: int = 200) -> dict:
    """Backfill / repair Qdrant index from PostgreSQL active memories."""
    store = get_vector_store()
    if not store.is_available():
        return {"synced": 0, "total": 0, "available": False}

    memories = _registry.list_active(org_id, user_id, limit=limit)
    synced = 0
    for m in memories:
        if store.upsert_memory(m):
            synced += 1
    return {"synced": synced, "total": len(memories), "available": True}
