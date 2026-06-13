"""
知识管线可视化 — 聚合 Chat → 智慧提炼 → 候选池 → Wiki 的状态，供前端展示。
"""

from __future__ import annotations

from dataclasses import asdict

from knowledge_base.core.registry.candidate_registry import CandidateRegistry
from knowledge_base.core.registry.chat_registry import ChatRegistry
from knowledge_base.core.domain.pipeline_meta import (
    candidate_status_label,
    memory_event_label,
    stage_meta,
)
from knowledge_base.core.registry.memory_registry import MemoryRegistry

_memory = MemoryRegistry()
_candidates = CandidateRegistry()
_chat = ChatRegistry()


def get_session_pipeline(org_id: str, session_id: str, user_id: str = "demo") -> dict:
    session = _chat.get_session(session_id, org_id)
    if not session:
        raise ValueError("对话不存在")

    history = _chat.get_history(session_id)
    memories = _memory.list_by_session(org_id, session_id, user_id)
    events = _memory.list_events_for_session(org_id, session_id, limit=20)
    candidates = _candidates.list_by_source(org_id, session_id, limit=30)

    pending = sum(1 for c in candidates if c.status == "pending")
    approved = sum(1 for c in candidates if c.status == "approved")
    merged = sum(1 for c in candidates if c.status == "merged")

    recent: list[dict] = []
    for e in events[:8]:
        recent.append({
            "kind": "memory",
            "id": e.id,
            "title": e.memory_title,
            "detail": memory_event_label(e.event_type),
            "memory_type": e.memory_type,
            "status": e.event_type,
            "created_at": e.created_at,
        })
    for c in candidates[:8]:
        recent.append({
            "kind": "candidate",
            "id": c.id,
            "title": c.title,
            "detail": candidate_status_label(c.status),
            "category": c.category,
            "status": c.status,
            "target_wiki_path": c.target_wiki_path,
            "created_at": c.created_at,
        })
    recent.sort(key=lambda x: x["created_at"], reverse=True)
    recent = recent[:10]

    msg_count = len(history)
    stages = _build_stages(msg_count, len(memories), pending, approved, merged)

    return {
        "session_id": session_id,
        "stats": {
            "message_count": msg_count,
            "memory_count": len(memories),
            "candidate_pending": pending,
            "candidate_approved": approved,
            "candidate_merged": merged,
            "event_count": len(events),
        },
        "stages": stages,
        "recent": recent,
    }


def _build_stages(
    msg_count: int,
    memory_count: int,
    pending: int,
    approved: int,
    merged: int,
) -> list[dict]:
    stages: list[dict] = []
    for stage_id, label, desc in stage_meta():
        status, hint = _stage_status(
            stage_id, msg_count, memory_count, pending, approved, merged,
        )
        stages.append({
            "id": stage_id,
            "label": label,
            "description": desc,
            "status": status,
            "hint": hint,
        })
    return stages


def _stage_status(
    stage_id: str,
    msg_count: int,
    memory_count: int,
    pending: int,
    approved: int,
    merged: int,
) -> tuple[str, str]:
    if stage_id == "chat":
        if msg_count == 0:
            return "idle", "等待第一条消息"
        return "done", f"{msg_count} 条消息"

    if stage_id == "extract":
        if msg_count < 2:
            return "idle", "多聊几轮后开始提炼"
        if memory_count > 0:
            return "done", f"已沉淀 {memory_count} 条智慧"
        # L1 为每轮异步任务；无新沉淀时保持 idle，避免轮询时一直转圈
        return "idle", "每轮自动提炼，本轮暂无新智慧"

    if stage_id == "candidate":
        if pending > 0:
            return "active", f"{pending} 条待审核"
        if approved > 0:
            return "active", f"{approved} 条待编译"
        if merged > 0:
            return "done", f"{merged} 条已进 Wiki"
        if memory_count > 0:
            return "idle", "暂无候选（偏好类不进池）"
        return "idle", "等待提炼产出"

    if stage_id == "wiki":
        if merged > 0:
            return "done", f"{merged} 页已生成"
        if approved > 0:
            return "active", "可在概览一键编译"
        if pending > 0:
            return "idle", "需先解析并批准"
        return "idle", "尚未晋升"

    return "idle", ""


def list_recent_pipeline_activity(org_id: str, limit: int = 8) -> list[dict]:
    """概览页：候选池近期动态。"""
    items = _candidates.list_by_status(org_id, status=None, limit=limit)
    return [
        {
            "kind": "candidate",
            "created_at": c.created_at,
            "title": c.title,
            "category": c.category,
            "status": c.status,
            "source_type": c.source_type,
            "target_wiki_path": c.target_wiki_path,
        }
        for c in items
    ]
