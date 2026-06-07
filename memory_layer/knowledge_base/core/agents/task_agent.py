"""
Task Agent — tool-calling agent backed by the knowledge base.

Tools available to the LLM:
  search_wiki(query)      → list of matching page summaries
  read_page(path)         → full markdown content of a wiki page
  list_entities(type?)    → entities from the graph, optionally filtered by type
"""
import json

from memory_layer.knowledge_base.app.logging_config import get_logger
from memory_layer.knowledge_base.core.graph.memory_graph import MemoryGraph
from memory_layer.knowledge_base.core.wiki.wiki_manager import WikiManager
from memory_layer.knowledge_base.models.task import Task
from model_layer import client as llm

log = get_logger("hivemind.agent.task")

_SYSTEM = """你是 HiveMindOS 的企业知识助理，能够主动查阅知识库完成任务。

工作方式：
1. 先用工具检索相关知识（可多次调用）
2. 综合信息后给出清晰、结构化的答案
3. 答案中注明关键信息的来源页面

要求：
- 只根据知识库中的实际内容作答，不做无依据推测
- 如果信息不足，直接说明缺少哪些信息
- 回答使用 Markdown 格式，层次清晰"""

_TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "search_wiki",
            "description": "按关键词搜索 Wiki 页面，返回匹配的页面列表（名称和路径）",
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {"type": "string", "description": "搜索关键词，支持中文"}
                },
                "required": ["query"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "read_page",
            "description": "读取特定 Wiki 页面的完整内容",
            "parameters": {
                "type": "object",
                "properties": {
                    "path": {
                        "type": "string",
                        "description": "页面路径，如 entities/中康尚德健康管理（北京）有限公司.md",
                    }
                },
                "required": ["path"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "list_entities",
            "description": "列出知识图谱中的实体，可按类型筛选",
            "parameters": {
                "type": "object",
                "properties": {
                    "entity_type": {
                        "type": "string",
                        "description": "实体类型：company / person / contract / product / rule / department / customer",
                    }
                },
            },
        },
    },
]


class TaskAgent:
    def __init__(self, wiki: WikiManager, graph: MemoryGraph):
        self._wiki = wiki
        self._graph = graph

    def run(self, task: Task, on_step=None) -> tuple[str, list[dict]]:
        log.info("[task] start  id=%s  input=%s…", task.id[:8], task.input[:50])

        answer, steps = llm.agentic_loop(
            system=_SYSTEM,
            user_message=task.input,
            tools_schema=_TOOLS,
            tool_executor=lambda name, args: self._execute(name, args, task.org_id),
            model=None,  # use DEFAULT_MODEL
            on_step=on_step,
        )

        log.info("[task] done   id=%s  steps=%d  answer_len=%d",
                 task.id[:8], len(steps), len(answer))
        return answer, steps

    def _execute(self, name: str, args: dict, org_id: str) -> str:
        if name == "search_wiki":
            return self._search_wiki(args.get("query", ""), org_id)
        if name == "read_page":
            return self._read_page(args.get("path", ""), org_id)
        if name == "list_entities":
            return self._list_entities(args.get("entity_type"), org_id)
        return f"未知工具: {name}"

    def _search_wiki(self, query: str, org_id: str) -> str:
        pages = self._wiki.list_pages(org_id)
        q = query.lower()
        matches = []
        for p in pages:
            content = self._wiki.read_page(org_id, p["path"]) or ""
            if q in p["name"].lower() or q in content.lower():
                # Return first 200 chars as preview
                preview = content[:200].replace("\n", " ").strip()
                matches.append({"name": p["name"], "path": p["path"], "preview": preview})
        if not matches:
            return f"未找到与「{query}」相关的页面"
        return json.dumps(matches, ensure_ascii=False, indent=2)

    def _read_page(self, path: str, org_id: str) -> str:
        content = self._wiki.read_page(org_id, path)
        if content is None:
            return f"页面不存在: {path}"
        return content

    def _list_entities(self, entity_type: str | None, org_id: str) -> str:
        entities = self._graph.list_entities(org_id, entity_type)
        if not entities:
            return "未找到实体"
        rows = [
            {"name": e["name"], "type": e["entity_type"], "attributes": e.get("attributes", {})}
            for e in entities
        ]
        return json.dumps(rows, ensure_ascii=False, indent=2)
