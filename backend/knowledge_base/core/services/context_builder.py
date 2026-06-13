"""
Context Builder — HiveMind 核心能力：Chat 回答前组装上下文。

三层结构（借鉴 Hermes Agent）：
  1. 常驻块 — 会话开始时冻结（playbook + 高价值智慧 profile）
  2. 动态召回 — 按问题语义/关键词检索相关智慧
  3. 会话搜索 — 命中「上次聊过」类意图时检索历史消息
"""

from __future__ import annotations

import re
from pathlib import Path

from knowledge_base import config
from server.logging_config import get_logger
from knowledge_base.core.registry.chat_registry import ChatRegistry
from knowledge_base.core.registry.memory_registry import MemoryRegistry
from knowledge_base.core.vector.memory_vector_store import get_vector_store
from knowledge_base.core.domain.taxonomy import memory_type_label
from knowledge_base.models.memory import Memory
from knowledge_base.settings import load

log = get_logger("hivemind.context")

_registry = MemoryRegistry()
_chat_registry = ChatRegistry()


def _recall_cfg() -> dict:
    return load("recall")


def _pinned_cfg() -> dict:
    return _recall_cfg().get("pinned") or {}


def _keywords(text: str) -> list[str]:
    cjk = re.findall(r"[\u4e00-\u9fff]{2,}", text)
    latin = re.findall(r"[a-zA-Z0-9]{2,}", text.lower())
    return cjk + latin


def _has_recall_intent(question: str) -> bool:
    return any(h in question for h in _recall_cfg()["hints"])


def _has_session_search_intent(question: str) -> bool:
    hints = _recall_cfg().get("session_search_hints") or []
    return any(h in question for h in hints)


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
    *,
    exclude_ids: set[int] | None = None,
) -> list[Memory]:
    memories = _registry.list_active(org_id, user_id)
    if exclude_ids:
        memories = [m for m in memories if m.id not in exclude_ids]
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
    *,
    exclude_ids: set[int] | None = None,
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
        if not memory or (exclude_ids and memory.id in exclude_ids):
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
    *,
    exclude_ids: set[int] | None = None,
) -> list[Memory]:
    if limit is None:
        limit = _recall_cfg()["max_memories"]
    semantic = _select_semantic(org_id, user_id, question, limit, exclude_ids=exclude_ids)
    if semantic:
        return semantic

    selected = _select_keyword(org_id, user_id, question, limit, exclude_ids=exclude_ids)
    if selected:
        log.info(
            "[context] keyword=%d  org=%s  q=%s…  titles=%s",
            len(selected),
            org_id,
            question[:40],
            [m.title for m in selected],
        )
    return selected


def _load_playbook(org_id: str) -> str:
    """Org playbook: per-org markdown override, else settings/playbook.yaml."""
    override = config.STORAGE_ROOT / "orgs" / org_id / "playbook.md"
    if override.is_file():
        text = override.read_text(encoding="utf-8").strip()
        if text:
            return text[:1500]

    pb = load("playbook")
    lines = [f"## 组织 Playbook · {pb.get('title', 'HiveMind')}"]
    if pb.get("tone"):
        lines.append(f"语气：{pb['tone']}")
    for rule in pb.get("rules") or []:
        lines.append(f"- {rule}")
    return "\n".join(lines)


def build_pinned_block(
    org_id: str,
    user_id: str,
    *,
    playbook_text: str | None = None,
) -> tuple[str, list[Memory]]:
    """Build frozen profile block: playbook + high-value memories."""
    cfg = _pinned_cfg()
    char_limit = int(cfg.get("char_limit") or 2200)
    min_imp = float(cfg.get("min_importance") or 0.65)
    types = tuple(cfg.get("memory_types") or ["preference", "decision", "project"])
    max_entries = int(cfg.get("max_entries") or 12)

    if playbook_text is not None:
        playbook = playbook_text.strip()[:1500]
    else:
        playbook = _load_playbook(org_id)
    memories = _registry.list_active(org_id, user_id, memory_types=types, limit=max_entries * 2)
    pinned = [m for m in memories if m.importance >= min_imp][:max_entries]

    parts = [playbook]
    if pinned:
        parts.append("## 用户常驻智慧（本会话固定，不随轮次变化）")
        for m in pinned:
            label = memory_type_label(m.memory_type)
            parts.append(f"- [{label}] {m.title}：{m.content}")

    block = "\n".join(parts)
    if len(block) > char_limit:
        block = block[: char_limit - 20] + "\n…（已截断）"
    return block, pinned


def ensure_session_pinned_context(session_id: str, org_id: str, user_id: str) -> str:
    """Return pinned block; compute once per session and persist."""
    existing = _chat_registry.get_pinned_context(session_id, org_id)
    if existing:
        return existing
    block, pinned = build_pinned_block(org_id, user_id)
    _chat_registry.set_pinned_context(session_id, org_id, block)
    log.info(
        "[context] pinned frozen  session=%s  entries=%d  chars=%d",
        session_id[:8],
        len(pinned),
        len(block),
    )
    return block


def format_memory_block(memories: list[Memory]) -> str:
    if not memories:
        return ""
    lines = ["## 本轮相关智慧（按问题动态召回）"]
    for m in memories:
        label = memory_type_label(m.memory_type)
        lines.append(f"- [{label}] {m.title}：{m.content}")
    return "\n".join(lines)


def format_session_search_block(hits: list[dict]) -> str:
    if not hits:
        return ""
    snippet_len = int(_recall_cfg().get("session_search_snippet_chars") or 200)
    lines = ["## 历史对话片段（按关键词检索）"]
    for h in hits:
        role = "用户" if h["role"] == "user" else "助手"
        content = (h["content"] or "")[:snippet_len]
        title = h.get("session_title") or "对话"
        lines.append(f"- [{title} · {role}] {content}")
    return "\n".join(lines)


def search_session_messages(org_id: str, user_id: str, question: str) -> list[dict]:
    limit = int(_recall_cfg().get("session_search_limit") or 8)
    return _chat_registry.search_messages(org_id, user_id, question, limit=limit)


def build_context(
    org_id: str,
    user_id: str,
    question: str,
    *,
    session_id: str | None = None,
) -> tuple[str, list[dict], list[dict]]:
    """Returns (prompt_block, memories_used, skills_used) for API response."""
    from agent_engine.skills.skill_recall import (
        format_skills_block,
        select_relevant_skills,
        skills_used_payload,
    )

    pinned_block = ""
    pinned_memories: list[Memory] = []
    if session_id:
        pinned_block = ensure_session_pinned_context(session_id, org_id, user_id)
        _, pinned_memories = build_pinned_block(org_id, user_id)

    exclude = {m.id for m in pinned_memories}
    dynamic = select_relevant_memories(org_id, user_id, question, exclude_ids=exclude)
    skills = select_relevant_skills(org_id, question)

    blocks = [
        b
        for b in [
            pinned_block,
            format_memory_block(dynamic),
            format_skills_block(skills),
        ]
        if b
    ]

    if _has_session_search_intent(question) or _has_recall_intent(question):
        hits = search_session_messages(org_id, user_id, question)
        session_block = format_session_search_block(hits)
        if session_block:
            blocks.append(session_block)

    block = "\n\n".join(blocks)
    used = [
        {
            "id": m.id,
            "memory_type": m.memory_type,
            "title": m.title,
            "content": m.content,
            "importance": m.importance,
            "pinned": m.id in exclude,
        }
        for m in pinned_memories + dynamic
    ]
    return block, used, skills_used_payload(skills)
