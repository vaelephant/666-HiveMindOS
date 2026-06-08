"""Chat / Task Agent 共用的 Wiki 工具 schema 与执行器。"""

from __future__ import annotations

import json
from functools import lru_cache

from memory_layer.knowledge_base.core.graph.memory_graph import MemoryGraph
from memory_layer.knowledge_base.core.wiki.wiki_manager import WikiManager
from memory_layer.knowledge_base.settings import load


@lru_cache(maxsize=1)
def tool_schemas() -> list[dict]:
    return list(load("tools")["schemas"])


@lru_cache(maxsize=1)
def tool_runtime() -> dict:
    return dict(load("tools").get("runtime") or {})


class WikiToolExecutor:
    def __init__(self, wiki: WikiManager, graph: MemoryGraph, org_id: str):
        self._wiki = wiki
        self._graph = graph
        self._org_id = org_id
        self._rt = tool_runtime()

    def __call__(self, name: str, args: dict) -> str:
        if name == "search_wiki":
            return self.search_wiki(args.get("query", ""))
        if name == "read_page":
            return self.read_page(args.get("path", ""))
        if name == "list_entities":
            return self.list_entities(args.get("entity_type"))
        return f"未知工具: {name}"

    def search_wiki(self, query: str, *, preview_chars: int | None = None) -> str:
        preview = preview_chars or self._rt.get("search_preview_chars", 150)
        max_matches = self._rt.get("search_max_matches", 8)
        pages = self._wiki.list_pages(self._org_id)
        q = query.lower()
        matches = []
        for p in pages:
            content = self._wiki.read_page(self._org_id, p["path"]) or ""
            if q in p["name"].lower() or q in content.lower():
                preview_text = content[:preview].replace("\n", " ").strip()
                matches.append({"name": p["name"], "path": p["path"], "preview": preview_text})
        if not matches:
            return f"未找到与「{query}」相关的页面"
        return json.dumps(matches[:max_matches], ensure_ascii=False, indent=2)

    def read_page(self, path: str) -> str:
        content = self._wiki.read_page(self._org_id, path)
        return content if content is not None else f"页面不存在: {path}"

    def list_entities(self, entity_type: str | None, *, include_attributes: bool = False) -> str:
        entities = self._graph.list_entities(self._org_id, entity_type)
        if not entities:
            return "未找到实体"
        if include_attributes:
            rows = [
                {"name": e["name"], "type": e["entity_type"], "attributes": e.get("attributes", {})}
                for e in entities
            ]
        else:
            rows = [{"name": e["name"], "type": e["entity_type"]} for e in entities]
        return json.dumps(rows, ensure_ascii=False, indent=2)
