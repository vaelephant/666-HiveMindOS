"""
L3 文档智慧提炼服务 — 资料编译完成后异步写入 memories。

组织级智慧：user_id=None，source_type=ingest，source_id=资料库 source UUID。
"""

from __future__ import annotations

from dataclasses import asdict
from pathlib import Path

from knowledge_base import config
from server.logging_config import get_logger
from knowledge_base.core.pipelines.doc_memory_extractor import DocMemoryExtractor
from knowledge_base.core.pipelines.ingest_agent import IngestAgent
from knowledge_base.core.graph.memory_graph import MemoryGraph
from knowledge_base.core.registry.memory_registry import MemoryRegistry
from knowledge_base.core.wiki.wiki_manager import WikiManager
from knowledge_base.core.registry.source_registry import SourceRegistry
from knowledge_base.core.services.memory_service import _index_memories
from model_layer.usage import track_usage

log = get_logger("hivemind.doc_memory.service")

_registry = MemoryRegistry()
_source_registry = SourceRegistry(config.REGISTRY_DB)
_extractor = DocMemoryExtractor()


def extract_memories_from_ingest(
    org_id: str,
    source_id: str,
    ingest_result: dict,
    user_id: str = "demo",
) -> list[int]:
    """
    编译成功后调用。失败仅打日志，不影响编译状态。
    """
    try:
        with track_usage(org_id, user_id, "ingest", source_id):
            return _extract_memories_from_ingest_inner(org_id, source_id, ingest_result)
    except Exception as exc:
        log.error("[l3] failed  org=%s  source=%s  err=%s", org_id, source_id[:8], exc)
        return []


def _extract_memories_from_ingest_inner(
    org_id: str,
    source_id: str,
    ingest_result: dict,
) -> list[int]:
    try:
        record = _source_registry.get(source_id)
        if not record or record.org_id != org_id:
            log.warning("[l3] source not found  id=%s", source_id[:8])
            return []

        excerpt = _read_excerpt(Path(record.file_path), record.source_type)
        existing = _registry.list_active(org_id, user_id=None)
        existing_dicts = [asdict(m) for m in existing]

        candidates = _extractor.run(
            record.filename,
            excerpt,
            ingest_result,
            existing_dicts,
            collection=record.collection,
        )
        if not candidates:
            log.info("[l3] nothing extracted  org=%s  source=%s  file=%s",
                     org_id, source_id[:8], record.filename)
            return []

        archived = _registry.archive_ingest_source(org_id, source_id)
        if archived:
            log.info("[l3] archived %d old memories for source=%s", archived, source_id[:8])

        ids = _registry.apply_ingest_candidates(org_id, source_id, candidates)
        _index_memories(org_id, ids)
        log.info(
            "[l3] done  org=%s  source=%s  file=%s  created=%d  types=%s",
            org_id, source_id[:8], record.filename, len(ids),
            [c.memory_type for c in candidates],
        )
        return ids
    except Exception as exc:
        log.error("[l3] inner failed  org=%s  source=%s  err=%s", org_id, source_id[:8], exc)
        return []


def _read_excerpt(file_path: Path, source_type: str) -> str:
    if not file_path.exists():
        return ""
    wiki = WikiManager(config.WIKI_ROOT)
    graph = MemoryGraph(config.GRAPH_ROOT / "_l3" / "graph.db")
    return IngestAgent(wiki, graph)._extract_text(file_path, source_type)
