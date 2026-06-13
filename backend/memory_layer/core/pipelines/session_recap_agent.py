"""L2 会话级复盘 — 提示词见 prompts.yaml → evolution.l2_session_recap"""

from __future__ import annotations

from shared import config
from server.logging_config import get_logger
from knowledge_base.core.parsers.llm_json import parse_json_object
from memory_layer.core.parsers.memory_candidates import (
    parse_archive_items,
    parse_memory_list,
)
from memory_layer.models.memory import MemoryConflict, RecapPlan, WikiSuggestion
from prompts import get, render
from model_layer import client as llm

log = get_logger("hivemind.agent.session_recap")

_L2 = get("evolution.l2_session_recap")


class SessionRecapAgent:
    def run(
        self,
        session_id: str,
        session_title: str,
        turns: list[dict],
        existing: list[dict],
        session_memories: list[dict],
    ) -> RecapPlan:
        prompt = render(
            "evolution.l2_session_recap",
            session_id=session_id,
            session_title=session_title or "（无标题）",
            existing_block=self._format_memories(existing, "全部活跃智慧"),
            session_block=self._format_memories(session_memories, "本会话已沉淀智慧"),
            transcript=self._format_transcript(turns),
        )

        raw = llm.complete(
            prompt=prompt,
            system=_L2.system,
            profile=_L2.resolve_profile(),
        )
        return self._parse(raw)

    def _format_transcript(self, turns: list[dict]) -> str:
        if not turns:
            return "（空会话）"
        max_turns = _L2.limit("max_session_turns", 40)
        max_chars = _L2.limit("max_turn_chars", 800)
        lines: list[str] = []
        for i, h in enumerate(turns[-max_turns:], 1):
            role = "用户" if h.get("role") == "user" else "助手"
            content = (h.get("content") or "").strip()
            if content:
                lines.append(f"[{i}] {role}：{content[:max_chars]}")
        return "\n".join(lines) if lines else "（空会话）"

    @staticmethod
    def _format_memories(items: list[dict], label: str) -> str:
        if not items:
            return f"{label}：（无）"
        lines = [f"{label}："]
        for m in items:
            lines.append(
                f"- [id={m.get('id', '?')}] [{m['memory_type']}] {m['title']}: {m['content']}"
            )
        return "\n".join(lines)

    def _parse(self, raw: str) -> RecapPlan:
        empty = RecapPlan(
            summary="",
            memories=[],
            archives=[],
            conflicts=[],
            wiki_suggestions=[],
        )
        try:
            data = parse_json_object(raw)
        except (ValueError, TypeError):
            log.warning("[recap] JSON parse failed")
            return empty

        return RecapPlan(
            summary=(data.get("summary") or "").strip(),
            memories=parse_memory_list(data.get("memories") or []),
            archives=parse_archive_items(data.get("archives") or []),
            conflicts=self._parse_conflicts(data.get("conflicts") or []),
            wiki_suggestions=self._parse_wiki(data.get("wiki_suggestions") or []),
        )

    def _parse_conflicts(self, items: list) -> list[MemoryConflict]:
        out: list[MemoryConflict] = []
        for item in items:
            if not isinstance(item, dict):
                continue
            field = (item.get("field") or "").strip()
            desc = (item.get("description") or "").strip()
            if not field and not desc:
                continue
            out.append(MemoryConflict(
                field=field or "未命名",
                description=desc,
                resolution=(item.get("resolution") or "").strip(),
            ))
        return out

    def _parse_wiki(self, items: list) -> list[WikiSuggestion]:
        out: list[WikiSuggestion] = []
        for item in items:
            if not isinstance(item, dict):
                continue
            title = (item.get("title") or "").strip()
            reason = (item.get("reason") or "").strip()
            if not title:
                continue
            out.append(WikiSuggestion(
                title=title,
                reason=reason,
                category=(item.get("category") or "general").strip(),
                content_outline=(item.get("content_outline") or "").strip(),
            ))
        return out
