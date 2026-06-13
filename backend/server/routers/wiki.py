from fastapi import APIRouter, HTTPException

from knowledge_base import config
from knowledge_base.core.graph.memory_graph import MemoryGraph
from knowledge_base.core.registry.source_registry import SourceRegistry
from knowledge_base.core.wiki.page_detail import build_page_detail
from knowledge_base.core.wiki.wiki_manager import WikiManager
from knowledge_base.core.wiki import wiki_meta
from knowledge_base.core.wiki.wiki_migrator import migrate_org

router = APIRouter()


def _graph(org_id: str) -> MemoryGraph:
    return MemoryGraph(config.GRAPH_ROOT / org_id / "graph.db")


def _registry() -> SourceRegistry:
    return SourceRegistry(config.REGISTRY_DB)


@router.post("/orgs/{org_id}/wiki/migrate")
def migrate_wiki(org_id: str, force: bool = False):
    """Backfill .meta.json sidecars for legacy wiki pages."""
    result = migrate_org(
        config.WIKI_ROOT, org_id, _registry(), _graph(org_id), force=force
    )
    return result


@router.get("/orgs/{org_id}/wiki/categories")
def list_wiki_categories(org_id: str):
    wiki = WikiManager(config.WIKI_ROOT)
    return {"categories": wiki.list_categories(org_id)}


@router.get("/orgs/{org_id}/wiki")
def list_wiki(org_id: str, category: str = None):
    wiki = WikiManager(config.WIKI_ROOT)
    return {"pages": wiki.list_pages(org_id, category)}


@router.get("/orgs/{org_id}/wiki/{wiki_path:path}")
def get_wiki_page(org_id: str, wiki_path: str, detail: bool = False):
    wiki = WikiManager(config.WIKI_ROOT)
    content = wiki.read_page(org_id, wiki_path)
    if content is None:
        raise HTTPException(status_code=404, detail="页面不存在")
    result = {"path": wiki_path, "content": content}
    if detail:
        sidecar = wiki_meta.load_meta(config.WIKI_ROOT, org_id, wiki_path)
        result["detail"] = build_page_detail(
            org_id, wiki_path, content, _registry(), _graph(org_id), sidecar=sidecar
        )
    return result
