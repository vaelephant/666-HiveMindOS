"""
HiveMindOS 其他模块调用企业知识库的统一接口。

用法：
    from memory_layer.knowledge_base.sdk.knowledge_base import KnowledgeBase

    kb = KnowledgeBase(org_id="acme")
    kb.ingest("sales_flow.pdf")
    result = kb.query("报价超过多少需要审批？")
"""

from pathlib import Path
from typing import Optional

from memory_layer.knowledge_base import config
from memory_layer.knowledge_base.core.agents.ingest_agent import IngestAgent
from memory_layer.knowledge_base.core.agents.query_agent import QueryAgent
from memory_layer.knowledge_base.core.agents.lint_agent import LintAgent
from memory_layer.knowledge_base.core.wiki.wiki_manager import WikiManager
from memory_layer.knowledge_base.core.graph.memory_graph import MemoryGraph

from memory_layer.knowledge_base.core.domain.source_formats import SUFFIX_TO_TYPE as _SUFFIX_MAP


class KnowledgeBase:
    def __init__(self, org_id: str):
        self.org_id = org_id
        self._wiki = WikiManager(config.WIKI_ROOT)
        self._graph = MemoryGraph(config.GRAPH_ROOT / org_id / "graph.db")

    def ingest(self, file_path: str | Path) -> dict:
        fp = Path(file_path)
        source_type = _SUFFIX_MAP.get(fp.suffix.lower(), "text")
        return IngestAgent(self._wiki, self._graph).run(fp, self.org_id, source_type)

    def query(self, question: str) -> dict:
        return QueryAgent(self._wiki, self._graph).run(question, self.org_id)

    def get_entity(self, name: str) -> Optional[dict]:
        return self._graph.get_entity(self.org_id, name)

    def list_entities(self, entity_type: Optional[str] = None) -> list[dict]:
        return self._graph.list_entities(self.org_id, entity_type)

    def get_neighbors(self, entity_name: str) -> list[dict]:
        entity = self._graph.get_entity(self.org_id, entity_name)
        if not entity:
            return []
        return self._graph.get_neighbors(entity["id"], self.org_id)

    def lint(self) -> dict:
        return LintAgent(self._wiki).run(self.org_id)

    def list_wiki(self, category: Optional[str] = None) -> list[dict]:
        return self._wiki.list_pages(self.org_id, category)
