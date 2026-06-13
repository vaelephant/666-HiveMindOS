from datetime import datetime, timezone, timedelta

from fastapi import APIRouter

from shared import config
from knowledge_base.core.registry.source_registry import SourceRegistry
from chat_layer.core.registry.chat_registry import ChatRegistry
from memory_layer.core.registry.memory_registry import MemoryRegistry
from knowledge_base.core.services.candidate_service import get_candidate_stats
from chat_layer.core.services.pipeline_service import list_recent_pipeline_activity
from knowledge_base.core.graph.memory_graph import MemoryGraph
from knowledge_base.core.wiki.wiki_manager import WikiManager

router = APIRouter()

_registry = SourceRegistry(config.REGISTRY_DB)
_chat = ChatRegistry()
_memory = MemoryRegistry()


@router.get("/orgs/{org_id}/overview")
def get_overview(org_id: str):
    # ── 源文件统计 ──────────────────────────────────────────────────────
    sources = _registry.list(org_id)
    now = datetime.now(timezone.utc)
    week_ago = now - timedelta(days=7)
    source_count_week = sum(
        1 for s in sources
        if _parse_dt(s.created_at) >= week_ago
    )

    # ── 实体 / Wiki ──────────────────────────────────────────────────────
    graph = MemoryGraph(config.GRAPH_ROOT / org_id / "graph.db")
    entity_count = len(graph.list_entities(org_id))
    wiki = WikiManager(config.WIKI_ROOT)
    wiki_page_count = len(wiki.list_pages(org_id))

    # ── 对话统计 ──────────────────────────────────────────────────────
    chat_stats = _chat.get_org_stats(org_id)
    recent_chats = _chat.list_sessions(org_id, limit=5)

    # ── 智慧统计 ──────────────────────────────────────────────────────
    memory_stats = _memory.get_stats(org_id)
    recent_memory_events = _memory.list_events(org_id, limit=5)
    candidate_stats = get_candidate_stats(org_id)

    # ── 近期动态（资料编译 + 对话 + 智慧进化，按时间合并） ───────────────
    source_activity = [
        {
            "kind": "source",
            "created_at": s.created_at,
            "filename": s.filename,
            "status": s.status,
            "entities_extracted": s.entities_extracted or 0,
            "wiki_pages_created": s.wiki_pages_created or 0,
            "error": s.error,
        }
        for s in sources[:10]
        if s.status in ("done", "error", "compiling", "uploaded")
    ]
    chat_activity = [
        {
            "kind": "chat",
            "created_at": c.updated_at,
            "session_id": c.id,
            "title": c.title or "新对话",
        }
        for c in recent_chats
    ]
    memory_activity = [
        {
            "kind": "memory",
            "created_at": e.created_at,
            "event_type": e.event_type,
            "memory_title": e.memory_title,
            "memory_type": e.memory_type,
        }
        for e in recent_memory_events
    ]
    candidate_activity = list_recent_pipeline_activity(org_id, limit=8)
    recent_activity = sorted(
        source_activity + chat_activity + memory_activity + candidate_activity,
        key=lambda x: _parse_dt(x["created_at"]),
        reverse=True,
    )[:12]

    return {
        "stats": {
            "source_count": len(sources),
            "source_count_week": source_count_week,
            "entity_count": entity_count,
            "wiki_page_count": wiki_page_count,
            "chat_session_count": chat_stats["session_count"],
            "chat_message_count": chat_stats["message_count"],
            "chat_sessions_week": chat_stats["sessions_week"],
            "memory_count": memory_stats.total,
            "memories_week": memory_stats.memories_this_week,
            "candidate_pending": candidate_stats["pending"],
            "candidates_pending_week": candidate_stats["pending_week"],
        },
        "recent_activity": recent_activity,
    }


def _parse_dt(iso: str) -> datetime:
    try:
        return datetime.fromisoformat(iso.replace("Z", "+00:00"))
    except Exception:
        return datetime.min.replace(tzinfo=timezone.utc)
