"""L1 每轮智慧提炼 — 提示词见 prompts.yaml → evolution.l1_memory_extractor"""

from __future__ import annotations

from memory_layer.knowledge_base import config
from memory_layer.knowledge_base.app.logging_config import get_logger
from memory_layer.knowledge_base.core.parsers.memory_candidates import parse_memory_items
from memory_layer.knowledge_base.models.memory import MemoryCandidate
from memory_layer.knowledge_base.prompts import get, render
from model_layer import client as llm

log = get_logger("hivemind.agent.memory_extractor")

_L1 = get("evolution.l1_memory_extractor")


class MemoryExtractor:
    def run(
        self,
        question: str,
        answer: str,
        existing: list[dict],
        recent_turns: list[dict] | None = None,
    ) -> list[MemoryCandidate]:
        existing_block = "（无已有智慧）"
        if existing:
            lines = [
                f"- [{m['memory_type']}] {m['title']}: {m['content']}"
                for m in existing
            ]
            existing_block = "\n".join(lines)

        prompt = render(
            "evolution.l1_memory_extractor",
            existing_block=existing_block,
            recent_block=self._format_recent(recent_turns),
            question=question,
            answer=answer[: _L1.limit("answer_max_chars", 2000)],
        )

        raw = llm.complete(
            prompt=prompt,
            system=_L1.system,
            model=_L1.resolve_model(config),
        )
        items = parse_memory_items(raw)
        if not items and raw.strip():
            log.warning("[memory] extractor JSON parse failed or empty")
        return items

    @staticmethod
    def _format_recent(turns: list[dict] | None) -> str:
        if not turns:
            return "（无）"
        limit = _L1.limit("recent_turn_limit", 6)
        char_max = _L1.limit("recent_message_max_chars", 500)
        lines: list[str] = []
        for h in turns[-limit:]:
            role = "用户" if h.get("role") == "user" else "助手"
            content = (h.get("content") or "").strip()
            if content:
                lines.append(f"{role}：{content[:char_max]}")
        return "\n".join(lines) if lines else "（无）"
