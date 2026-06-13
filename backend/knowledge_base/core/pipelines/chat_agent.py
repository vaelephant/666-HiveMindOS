"""
Chat Agent — two-phase: gather via tool calls, then synthesize with numbered citations.
"""
import json
import re

from server.logging_config import get_logger
from knowledge_base.core.graph.memory_graph import MemoryGraph
from knowledge_base.core.wiki.wiki_manager import WikiManager
from knowledge_base import config
from knowledge_base.core.parsers.llm_json import parse_json
from knowledge_base.core.tools.kb_toolkit import WikiToolExecutor, tool_runtime, tool_schemas
from knowledge_base.prompts import get, render
from model_layer import client as llm

log = get_logger("hivemind.agent.chat")

_CHAT_GATHER = get("chat.gather")
_CHAT_SYNTHESIS = get("chat.synthesis")
_CHAT_SYNTHESIS_STREAM = get("chat.synthesis_stream")
_CHAT_FOLLOW_UPS = get("chat.follow_ups")
_RT = tool_runtime()


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
        chat_profile: str | None = None,
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

        read_pages, steps = self._gather_pages(message, history, org_id)
        answer, follow_ups = self._synthesize(message, read_pages, memory_context, chat_profile=chat_profile)
        sources = self._pages_to_sources(read_pages)

        log.info("[chat] done  steps=%d  sources=%d  ans_len=%d", len(steps), len(sources), len(answer))
        return {"answer": answer, "sources": sources, "follow_ups": follow_ups}

    def run_stream(
        self,
        message: str,
        history: list[dict],
        org_id: str,
        memory_context: str = "",
        chat_profile: str | None = None,
    ):
        """
        流式版本：Phase 1 检索 → Phase 2 逐 token 输出回答。
        Yields: {type: status|token|complete, ...}
        """
        log.info("[chat] stream  org=%s  msg=%s…", org_id, message[:50])
        yield {"type": "status", "phase": "gathering"}

        read_pages, steps = self._gather_pages(message, history, org_id)
        sources = self._pages_to_sources(read_pages)

        yield {"type": "status", "phase": "writing"}
        yield {"type": "sources", "sources": sources}

        prompt = self._build_synthesis_prompt(message, read_pages, memory_context, stream=True)
        chunks: list[str] = []
        synthesis_profile = chat_profile or _CHAT_SYNTHESIS_STREAM.resolve_profile()
        for delta in llm.complete_stream(
            prompt=prompt,
            system=_CHAT_SYNTHESIS_STREAM.system,
            profile=synthesis_profile,
        ):
            chunks.append(delta)
            yield {"type": "token", "text": delta}

        answer = "".join(chunks)
        follow_ups = self._generate_follow_ups(message, answer)
        log.info(
            "[chat] stream done  steps=%d  sources=%d  ans_len=%d",
            len(steps), len(sources), len(answer),
        )
        yield {
            "type": "complete",
            "answer": answer,
            "sources": sources,
            "follow_ups": follow_ups,
        }

    def _gather_pages(
        self,
        message: str,
        history: list[dict],
        org_id: str,
    ) -> tuple[list[tuple[str, str]], list[dict]]:
        read_pages: list[tuple[str, str]] = []
        tools = WikiToolExecutor(self._wiki, self._graph, org_id)

        def track_executor(name: str, args: dict) -> str:
            result = tools(name, args)
            if name == "read_page":
                path = args.get("path", "")
                if path and result and not result.startswith("页面不存在") and not any(p == path for p, _ in read_pages):
                    read_pages.append((path, result))
            return result

        _, steps = llm.agentic_loop(
            system=_CHAT_GATHER.system,
            user_message=self._build_user_message(message, history),
            tools_schema=tool_schemas(),
            tool_executor=track_executor,
            profile=_CHAT_GATHER.resolve_profile(),
            max_iterations=_RT.get("gather_max_iterations", 6),
        )
        return read_pages, steps

    def _pages_to_sources(self, read_pages: list[tuple[str, str]]) -> list[dict]:
        return [
            {
                "path": path,
                "name": path.split("/")[-1].replace(".md", ""),
                "excerpt": self._extract_excerpt(content),
            }
            for path, content in read_pages
        ]

    def _build_synthesis_prompt(
        self,
        question: str,
        read_pages: list[tuple[str, str]],
        memory_context: str,
        *,
        stream: bool = False,
    ) -> str:
        parts = [f"用户问题：{question}"]
        if memory_context:
            parts.append(memory_context)
        if read_pages:
            sources_block = "\n\n".join(
                f"[{i+1}] 来源文件：{path}\n{content[:_RT.get('synthesis_source_chars', 800)]}"
                for i, (path, content) in enumerate(read_pages)
            )
            parts.append(f"以下是检索到的 Wiki 内容：\n\n{sources_block}")
        if stream:
            if memory_context or read_pages:
                parts.append("请根据以上内容回答。")
            else:
                parts.append("Wiki 与用户长期智慧中均无相关内容，请直接说明。")
        elif memory_context or read_pages:
            parts.append("请根据以上内容回答，并返回 JSON。")
        else:
            parts.append(
                "Wiki 与用户长期智慧中均无相关内容，请直接说明并给出 3 条追问建议。\n"
                '返回 JSON：{"answer": "...", "follow_ups": ["...", "...", "..."]}'
            )
        return "\n\n".join(parts)

    def _generate_follow_ups(self, question: str, answer: str) -> list[str]:
        if not answer.strip():
            return []
        ans_max = _CHAT_FOLLOW_UPS.limit("answer_max_chars", 1200)
        raw = llm.complete(
            render(
                "chat.follow_ups",
                question=question,
                answer=answer[:ans_max],
            ),
            system=_CHAT_FOLLOW_UPS.system,
            profile=_CHAT_FOLLOW_UPS.resolve_profile(),
            max_tokens=_CHAT_FOLLOW_UPS.limit("max_tokens", 256),
        )
        try:
            data = parse_json(raw)
            if isinstance(data, list):
                return [str(x) for x in data][:3]
        except (json.JSONDecodeError, ValueError):
            log.warning("[chat] follow_ups parse failed")
        return []

    def _synthesize(
        self,
        question: str,
        read_pages: list[tuple[str, str]],
        memory_context: str = "",
        *,
        chat_profile: str | None = None,
    ) -> tuple[str, list[str]]:
        prompt = self._build_synthesis_prompt(question, read_pages, memory_context, stream=False)
        synthesis_profile = chat_profile or _CHAT_SYNTHESIS.resolve_profile()
        raw = llm.complete(
            prompt=prompt,
            system=_CHAT_SYNTHESIS.system,
            profile=synthesis_profile,
        )
        return self._parse_synthesis(raw)

    def _parse_synthesis(self, raw: str) -> tuple[str, list[str]]:
        try:
            data = parse_json(raw)
            if isinstance(data, dict):
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
        for h in history[-_RT.get("history_turns", 6):]:
            role = "用户" if h["role"] == "user" else "助手"
            lines.append(f"{role}：{h['content']}")
        lines.append(f"用户：{message}")
        return "\n".join(lines)
