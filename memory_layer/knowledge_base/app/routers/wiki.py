from fastapi import APIRouter, HTTPException

from memory_layer.knowledge_base import config
from memory_layer.knowledge_base.core.wiki.wiki_manager import WikiManager

router = APIRouter()


@router.get("/orgs/{org_id}/wiki")
def list_wiki(org_id: str, category: str = None):
    wiki = WikiManager(config.WIKI_ROOT)
    return {"pages": wiki.list_pages(org_id, category)}


@router.get("/orgs/{org_id}/wiki/{wiki_path:path}")
def get_wiki_page(org_id: str, wiki_path: str):
    wiki = WikiManager(config.WIKI_ROOT)
    content = wiki.read_page(org_id, wiki_path)
    if content is None:
        raise HTTPException(status_code=404, detail="页面不存在")
    return {"path": wiki_path, "content": content}
