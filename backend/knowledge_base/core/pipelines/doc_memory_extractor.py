"""L3 文档智慧提炼 — 提示词见 prompts.yaml → evolution.l3_doc_memory_extractor"""

from __future__ import annotations

from server.logging_config import get_logger
from knowledge_base.core.parsers.doc_memory_candidates import parse_doc_memory_items
from knowledge_base.models.memory import MemoryCandidate
from knowledge_base.prompts import get, render
from model_layer import client as llm

log = get_logger("hivemind.agent.doc_memory_extractor")

_L3 = get("evolution.l3_doc_memory_extractor")


class DocMemoryExtractor:
    def run(
        self,
        filename: str,
        content_excerpt: str,
        ingest_result: dict,
        existing: list[dict],
        *,
        collection: str | None = None,
    ) -> list[MemoryCandidate]:
        existing_block = "（无已有组织级智慧）"
        if existing:
            lines = [
                f"- [{m['memory_type']}] {m['title']}"
                for m in existing[:30]
            ]
            existing_block = "\n".join(lines)

        collection_line = f"所属集合：{collection}" if collection else ""
        max_chars = _L3.limit("content_max_chars", 8000)
        excerpt = (content_excerpt or "").strip()[:max_chars]
        if not excerpt:
            log.info("[l3] empty excerpt, skip  file=%s", filename)
            return []

        prompt = render(
            "evolution.l3_doc_memory_extractor",
            filename=filename,
            collection_line=collection_line,
            entities=ingest_result.get("entities_extracted", 0),
            workflows=ingest_result.get("workflows_extracted", 0),
            rules=ingest_result.get("rules_extracted", 0),
            pages=ingest_result.get("wiki_pages_created", 0),
            existing_block=existing_block,
            content_excerpt=excerpt,
        )

        raw = llm.complete(
            prompt=prompt,
            system=_L3.system,
            profile=_L3.resolve_profile(),
        )
        items = parse_doc_memory_items(raw)
        min_imp = float(_L3.limit("min_importance", 0.4))
        max_n = int(_L3.limit("max_memories", 20))
        filtered = [c for c in items if c.importance >= min_imp]
        if len(filtered) > max_n:
            filtered.sort(key=lambda c: c.importance, reverse=True)
            filtered = filtered[:max_n]
        if not filtered and raw.strip():
            log.warning("[l3] parse empty  file=%s", filename)
        return filtered
