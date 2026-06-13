from fastapi import APIRouter
from pydantic import BaseModel

from knowledge_base import config
from knowledge_base.core.pipelines.query_agent import QueryAgent
from knowledge_base.core.pipelines.lint_agent import LintAgent
from knowledge_base.core.wiki.wiki_manager import WikiManager
from knowledge_base.core.graph.memory_graph import MemoryGraph

router = APIRouter()


class QueryRequest(BaseModel):
    question: str


@router.post("/orgs/{org_id}/query")
def query(org_id: str, req: QueryRequest):
    wiki = WikiManager(config.WIKI_ROOT)
    graph = MemoryGraph(config.GRAPH_ROOT / org_id / "graph.db")
    return QueryAgent(wiki, graph).run(req.question, org_id)


@router.post("/orgs/{org_id}/lint")
def lint(org_id: str):
    wiki = WikiManager(config.WIKI_ROOT)
    return LintAgent(wiki).run(org_id)


@router.get("/orgs/{org_id}/graph/snapshot")
def graph_snapshot(org_id: str):
    graph = MemoryGraph(config.GRAPH_ROOT / org_id / "graph.db")
    return graph.get_snapshot(org_id)


@router.get("/orgs/{org_id}/graph/entities")
def list_entities(org_id: str, entity_type: str = None):
    graph = MemoryGraph(config.GRAPH_ROOT / org_id / "graph.db")
    return {"entities": graph.list_entities(org_id, entity_type)}


@router.get("/orgs/{org_id}/graph/entity/{name}")
def get_entity(org_id: str, name: str):
    graph = MemoryGraph(config.GRAPH_ROOT / org_id / "graph.db")
    entity = graph.get_entity(org_id, name)
    if not entity:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="实体不存在")
    neighbors = graph.get_neighbors(entity["id"], org_id)
    relations = graph.get_entity_relations(entity["id"], org_id)
    return {"entity": entity, "neighbors": neighbors, "relations": relations}
