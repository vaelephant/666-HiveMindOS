"""
Chat Agent — two-phase: gather via tool calls, then synthesize with numbered citations.
"""
import json
import re

from memory_layer.knowledge_base.app.logging_config import get_logger
from memory_layer.knowledge_base.core.graph.memory_graph import MemoryGraph
from memory_layer.knowledge_base.core.wiki.wiki_manager import WikiManager
from memory_layer.knowledge_base import config
from model_layer import client as llm

log = get_logger("hivemind.agent.chat")

_GATHER_SYSTEM = """你是企业知识库检索助手。
任务：检索与用户问题相关的知识库内容。
- 先用 search_wiki 搜索关键词，找到相关页面路径
- 对匹配的页面用 read_page 读取完整内容（最多读 4 个页面）
- 完成检索后停止，不需要生成最终答案"""

_SYNTHESIS_SYSTEM = """你是企业知识库智能助手。根据提供的知识库来源与用户长期智慧，精准回答用户问题。
规则：
- 回答使用 Markdown（支持 ## 标题、- 列表、**加粗**）
- 引用 Wiki 来源时在句末加 [数字]，例如「合同金额为 500 万元 [1]」
- 如多个来源支持同一事实，可写 [1][2]
- 若提供了「用户长期智慧」，在回答中自然融入（如用户问过往项目、偏好、决策）
- 如知识库无相关内容，可仅依据用户长期智慧回答；两者皆无则直接说明
严格返回如下 JSON（不要有其他文字）：
{"answer": "Markdown 格式回答", "follow_ups": ["追问1", "追问2", "追问3"]}"""

_TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "search_wiki",
            "description": "按关键词搜索 Wiki 页面，返回匹配页面列表",
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {"type": "string", "description": "搜索关键词"}
                },
                "required": ["query"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "read_page",
            "description": "读取指定 Wiki 页面的完整内容",
            "parameters": {
                "type": "object",
                "properties": {
                    "path": {"type": "string", "description": "页面路径，如 entities/中康尚德.md"}
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
                        "description": "可选。实体类型：company / person / contract / product / rule / department / customer",
                    }
                },
            },
        },
    },
]


class ChatAgent:
    def __init__(self, wiki: WikiManager, graph: MemoryGraph):
        self._wiki = wiki
        self._graph = graph

    def run(
        self,
        message: str,
        history: list[dict],
        org_id: str,
        memory_context: str = "",
    ) -> dict:
        """
        Returns:
            {
              answer: str,
              sources: [{path, name, excerpt}],
              follow_ups: [str]
            }
        """
        log.info("[chat] turn  org=%s  msg=%s…", org_id, message[:50])

        # Phase 1: gather information via tool calls
        read_pages: list[tuple[str, str]] = []  # (path, content), insertion-ordered, deduplicated

        def track_executor(name: str, args: dict) -> str:
            result = self._execute(name, args, org_id)
            if name == "read_page":
                path = args.get("path", "")
                if path and result and not result.startswith("页面不存在") and not any(p == path for p, _ in read_pages):
                    read_pages.append((path, result))
            return result

        _, steps = llm.agentic_loop(
            system=_GATHER_SYSTEM,
            user_message=self._build_user_message(message, history),
            tools_schema=_TOOLS,
            tool_executor=track_executor,
            model=config.FAST_MODEL,
            max_iterations=6,
        )

        # Phase 2: synthesize cited answer + follow-up suggestions
        answer, follow_ups = self._synthesize(message, read_pages, memory_context)

        sources = [
            {
                "path": path,
                "name": path.split("/")[-1].replace(".md", ""),
                "excerpt": self._extract_excerpt(content),
            }
            for path, content in read_pages
        ]

        log.info("[chat] done  steps=%d  sources=%d  ans_len=%d", len(steps), len(sources), len(answer))
        return {"answer": answer, "sources": sources, "follow_ups": follow_ups}

    def _synthesize(
        self,
        question: str,
        read_pages: list[tuple[str, str]],
        memory_context: str = "",
    ) -> tuple[str, list[str]]:
        parts = [f"用户问题：{question}"]

        if memory_context:
            parts.append(memory_context)

        if read_pages:
            sources_block = "\n\n".join(
                f"[{i+1}] 来源文件：{path}\n{content[:800]}"
                for i, (path, content) in enumerate(read_pages)
            )
            parts.append(f"以下是检索到的知识库内容：\n\n{sources_block}")

        if memory_context or read_pages:
            parts.append("请根据以上内容回答，并返回 JSON。")
        else:
            parts.append(
                "知识库与用户长期智慧中均无相关内容，请直接说明并给出 3 条追问建议。\n"
                '返回 JSON：{"answer": "...", "follow_ups": ["...", "...", "..."]}'
            )

        prompt = "\n\n".join(parts)

        raw = llm.complete(
            prompt=prompt,
            system=_SYNTHESIS_SYSTEM,
            model=config.FAST_MODEL,
        )
        return self._parse_synthesis(raw)

    def _parse_synthesis(self, raw: str) -> tuple[str, list[str]]:
        try:
            text = re.sub(r"^```(?:json)?\s*|\s*```$", "", raw.strip(), flags=re.MULTILINE)
            data = json.loads(text)
            return data.get("answer", raw), data.get("follow_ups", [])[:3]
        except (json.JSONDecodeError, ValueError):
            log.warning("[chat] synthesis JSON parse failed, using raw text")
            return raw, []

    @staticmethod
    def _extract_excerpt(content: str) -> str:
        for line in content.splitlines():
            line = line.strip()
            if line and not line.startswith("#") and not line.startswith("**") and len(line) > 10:
                return line[:120]
        return content[:120].replace("\n", " ").strip()

    def _build_user_message(self, message: str, history: list[dict]) -> str:
        if not history:
            return message
        lines = []
        for h in history[-6:]:
            role = "用户" if h["role"] == "user" else "助手"
            lines.append(f"{role}：{h['content']}")
        lines.append(f"用户：{message}")
        return "\n".join(lines)

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
                preview = content[:150].replace("\n", " ").strip()
                matches.append({"name": p["name"], "path": p["path"], "preview": preview})
        if not matches:
            return f"未找到与「{query}」相关的页面"
        return json.dumps(matches[:8], ensure_ascii=False, indent=2)

    def _read_page(self, path: str, org_id: str) -> str:
        content = self._wiki.read_page(org_id, path)
        return content if content is not None else f"页面不存在: {path}"

    def _list_entities(self, entity_type: str | None, org_id: str) -> str:
        entities = self._graph.list_entities(org_id, entity_type)
        if not entities:
            return "未找到实体"
        rows = [{"name": e["name"], "type": e["entity_type"]} for e in entities]
        return json.dumps(rows, ensure_ascii=False, indent=2)
