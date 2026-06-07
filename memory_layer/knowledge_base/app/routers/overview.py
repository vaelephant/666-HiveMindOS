from datetime import datetime, timezone, timedelta

from fastapi import APIRouter

from memory_layer.knowledge_base import config
from memory_layer.knowledge_base.core.registry.source_registry import SourceRegistry
from memory_layer.knowledge_base.core.graph.memory_graph import MemoryGraph
from memory_layer.knowledge_base.core.wiki.wiki_manager import WikiManager

router = APIRouter()

_registry = SourceRegistry(config.REGISTRY_DB)


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

    # ── 实体统计 ──────────────────────────────────────────────────────
    graph = MemoryGraph(config.GRAPH_ROOT / org_id / "graph.db")
    entity_count = len(graph.list_entities(org_id))

    # ── Wiki 页数 ──────────────────────────────────────────────────────
    wiki = WikiManager(config.WIKI_ROOT)
    wiki_page_count = len(wiki.list_pages(org_id))

    # ── 近期动态（最近 10 条，已编译完成或出错的） ──────────────────────
    recent = [
        {
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

    return {
        "stats": {
            "source_count": len(sources),
            "source_count_week": source_count_week,
            "entity_count": entity_count,
            "wiki_page_count": wiki_page_count,
        },
        "recent_activity": recent,
    }


def _parse_dt(iso: str) -> datetime:
    try:
        return datetime.fromisoformat(iso.replace("Z", "+00:00"))
    except Exception:
        return datetime.min.replace(tzinfo=timezone.utc)
