"""
智慧提取管线 — HiveMind 核心能力。

两级提炼：
  第一级 extract_from_turn（每轮轻量，异步）
    → 及时捕捉 project / preference / decision
  第二级 recap_session（会话复盘）
    → 总结、合并、去重、冲突检查、Wiki 建议

Wiki 编译（上传资料）由 ingest 管线负责；编译成功后的 L3 文档智慧提炼见 doc_memory_service。
"""

from __future__ import annotations

from dataclasses import asdict

from server.logging_config import get_logger
from memory_layer.core.pipelines.memory_extractor import MemoryExtractor
from memory_layer.core.pipelines.session_recap_agent import SessionRecapAgent
from chat_layer.core.registry.chat_registry import ChatRegistry
from memory_layer.core.registry.memory_registry import MemoryRegistry
from knowledge_base.core.services.candidate_service import (
    enqueue_from_memory_candidates,
    enqueue_from_wiki_suggestions,
)
from memory_layer.core.vector.memory_vector_store import get_vector_store
from memory_layer.models.memory import SessionRecapResult
from model_layer.services.model_settings_service import get_settings as get_model_settings
from model_layer.usage import track_usage

log = get_logger("hivemind.memory.service")

_registry = MemoryRegistry()
_chat_registry = ChatRegistry()
_extractor = MemoryExtractor()
_recap = SessionRecapAgent()

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
        with track_usage(org_id, user_id, "memory", session_id):
            return _extract_from_turn_inner(
                org_id, user_id, session_id, question, answer,
            )
    except Exception as exc:
        log.error("[memory] extract_from_turn failed: %s", exc)
        return []


def _extract_from_turn_inner(
    org_id: str,
    user_id: str,
    session_id: str,
    question: str,
    answer: str,
) -> list[int]:
    existing = _registry.list_active(org_id, user_id)
    existing_dicts = [asdict(m) for m in existing]

    # 最近对话（不含本轮 user+assistant，本轮由 question/answer 单独传入）
    recent_turns = _recent_session_context(session_id)

    fast_profile = get_model_settings(org_id, user_id).fast_profile
    candidates = _extractor.run(
        question,
        answer,
        existing_dicts,
        recent_turns=recent_turns,
        profile=fast_profile,
    )
    if not candidates:
        log.debug("[memory] nothing to extract  session=%s", session_id[:8])
        return []

    ids = _registry.apply_candidates(org_id, user_id, candidates, session_id)
    _index_memories(org_id, ids)
    enqueue_from_memory_candidates(org_id, user_id, session_id, candidates)
    log.info(
        "[memory] extracted  org=%s  session=%s  count=%d  ids=%s  types=%s",
        org_id,
        session_id[:8],
        len(ids),
        ids,
        [c.memory_type for c in candidates],
    )
    return ids


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


def _should_skip_recap(session_id: str, org_id: str, force: bool) -> bool:
    if force:
        return False
    stamps = _chat_registry.get_recap_timestamps(session_id, org_id)
    if not stamps:
        return False
    updated_at, recapped_at = stamps
    if not recapped_at:
        return False
    # updated_at <= recapped_at → 复盘后无新消息
    return updated_at <= recapped_at


def recap_session(
    org_id: str,
    user_id: str,
    session_id: str,
    *,
    force: bool = False,
) -> SessionRecapResult:
    """
    第二级：对整段会话做复盘提炼。

    触发：手动 API、删除会话前、定时批处理（scripts/recap_sessions.py）。
    force=True 时忽略 recapped_at（删除前复盘、手动强制重跑）。
    """
    session = _chat_registry.get_session(session_id, org_id)
    if not session:
        raise ValueError("对话不存在")

    if _should_skip_recap(session_id, org_id, force):
        log.info("[memory] recap skipped (no new messages)  session=%s", session_id[:8])
        return SessionRecapResult(
            session_id=session_id,
            summary="无新消息，已跳过复盘",
            memory_ids=[],
            archived_ids=[],
            conflicts=[],
            wiki_suggestions=[],
        )

    history = _chat_registry.get_history(session_id)
    if len(history) < 2:
        _chat_registry.mark_recapped(session_id, org_id)
        return SessionRecapResult(
            session_id=session_id,
            summary="会话过短，跳过复盘",
            memory_ids=[],
            archived_ids=[],
            conflicts=[],
            wiki_suggestions=[],
        )

    existing = _registry.list_active(org_id, user_id)
    existing_dicts = [asdict(m) for m in existing]
    session_memories = _registry.list_by_session(org_id, session_id, user_id)
    session_dicts = [asdict(m) for m in session_memories]

    with track_usage(org_id, user_id, "memory", session_id):
        plan = _recap.run(
            session_id=session_id,
            session_title=session.title,
            turns=history,
            existing=existing_dicts,
            session_memories=session_dicts,
        )

    memory_ids: list[int] = []
    archived_ids: list[int] = []

    if plan.memories:
        memory_ids = _registry.apply_candidates(
            org_id, user_id, plan.memories, session_id,
        )
        _index_memories(org_id, memory_ids)

    if plan.archives:
        archived_ids = _registry.apply_candidates(
            org_id, user_id, plan.archives, session_id,
        )

    candidate_ids: list[int] = []
    if plan.memories:
        candidate_ids.extend(
            enqueue_from_memory_candidates(org_id, user_id, session_id, plan.memories)
        )
    if plan.wiki_suggestions:
        candidate_ids.extend(
            enqueue_from_wiki_suggestions(
                org_id, user_id, session_id, plan.wiki_suggestions,
            )
        )

    _chat_registry.mark_recapped(session_id, org_id)

    log.info(
        "[memory] recap  org=%s  session=%s  updated=%d  archived=%d  wiki_hints=%d  candidates=%d",
        org_id,
        session_id[:8],
        len(memory_ids),
        len(archived_ids),
        len(plan.wiki_suggestions),
        len(candidate_ids),
    )

    return SessionRecapResult(
        session_id=session_id,
        summary=plan.summary,
        memory_ids=memory_ids,
        archived_ids=archived_ids,
        conflicts=plan.conflicts,
        wiki_suggestions=plan.wiki_suggestions,
    )


def recap_idle_sessions(
    org_id: str,
    user_id: str,
    idle_hours: int = 24,
    limit: int = 10,
) -> list[SessionRecapResult]:
    """定时任务：idle_hours 无新消息、且自上次复盘后有更新的活跃会话。"""
    sessions = _chat_registry.list_sessions_pending_recap(
        org_id, user_id, idle_hours=idle_hours, limit=limit,
    )
    results: list[SessionRecapResult] = []
    for s in sessions:
        try:
            results.append(recap_session(org_id, user_id, s.id))
        except Exception as exc:
            log.error("[memory] batch recap failed  session=%s  err=%s", s.id[:8], exc)
    return results


def sync_vectors(org_id: str, user_id: str, limit: int = 200) -> dict:
    """Backfill / repair Qdrant index from PostgreSQL active memories."""
    store = get_vector_store()
    if not store.is_available():
        return {"synced": 0, "total": 0, "available": False}

    memories = _registry.list_active(org_id, user_id, limit=limit)
    synced = 0
    with track_usage(org_id, user_id, "embed", None):
        for m in memories:
            if store.upsert_memory(m):
                synced += 1
    return {"synced": synced, "total": len(memories), "available": True}
