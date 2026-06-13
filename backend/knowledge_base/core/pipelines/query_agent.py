import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parents[3]))
from model_layer import client as llm
from shared import config
from knowledge_base.core.wiki.wiki_manager import WikiManager
from knowledge_base.core.graph.memory_graph import MemoryGraph
from knowledge_base.core.tools.kb_toolkit import tool_runtime
from prompts import get, render

_QUERY = get("agents.query")


class QueryAgent:
    def __init__(self, wiki: WikiManager, graph: MemoryGraph):
        self.wiki = wiki
        self.graph = graph

    def run(self, question: str, org_id: str) -> dict:
        context, source_pages = self._gather_context(question, org_id)

        prompt = render(
            "agents.query",
            question=question,
            context=context,
        )

        answer = llm.complete(
            prompt,
            system=_QUERY.system,
            profile=_QUERY.resolve_profile(),
        )
        return {"question": question, "answer": answer, "source_pages": source_pages}

    def _gather_context(self, question: str, org_id: str) -> tuple[str, list[str]]:
        pages = self.wiki.list_pages(org_id)
        keywords = set(question.lower().split())
        parts, sources = [], []

        rt = tool_runtime()
        max_pages = rt.get("query_max_pages", 30)
        page_chars = rt.get("query_page_chars", 2000)
        for page in pages[:max_pages]:
            content = self.wiki.read_page(org_id, page["path"])
            if not content:
                continue
            if any(kw in content.lower() for kw in keywords) or any(kw in page["name"].lower() for kw in keywords):
                parts.append(f"### {page['name']}\n{content[:page_chars]}")
                sources.append(page["path"])

        return ("\n\n".join(parts) or "（未找到相关内容）", sources)
