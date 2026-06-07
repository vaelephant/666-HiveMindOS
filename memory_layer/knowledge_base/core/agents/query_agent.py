import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parents[4]))
from model_layer import client as llm
from memory_layer.knowledge_base import config
from memory_layer.knowledge_base.core.wiki.wiki_manager import WikiManager
from memory_layer.knowledge_base.core.graph.memory_graph import MemoryGraph

_SYSTEM = """你是企业知识库助手。根据提供的 Wiki 内容回答问题。
- 回答准确、简洁
- 注明信息来源（Wiki 页面名称）
- 若知识库中无相关信息，直接说明，不要猜测"""


class QueryAgent:
    def __init__(self, wiki: WikiManager, graph: MemoryGraph):
        self.wiki = wiki
        self.graph = graph

    def run(self, question: str, org_id: str) -> dict:
        context, source_pages = self._gather_context(question, org_id)

        prompt = f"""根据以下企业知识库内容回答问题。

## 问题
{question}

## 知识库内容
{context}

请给出准确回答，并注明信息来源。"""

        answer = llm.complete(prompt, system=_SYSTEM, model=config.FAST_MODEL)
        return {"question": question, "answer": answer, "source_pages": source_pages}

    def _gather_context(self, question: str, org_id: str) -> tuple[str, list[str]]:
        pages = self.wiki.list_pages(org_id)
        keywords = set(question.lower().split())
        parts, sources = [], []

        for page in pages[:30]:
            content = self.wiki.read_page(org_id, page["path"])
            if not content:
                continue
            if any(kw in content.lower() for kw in keywords) or any(kw in page["name"].lower() for kw in keywords):
                parts.append(f"### {page['name']}\n{content[:2000]}")
                sources.append(page["path"])

        return ("\n\n".join(parts) or "（未找到相关内容）", sources)
