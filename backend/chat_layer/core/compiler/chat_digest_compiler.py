"""
ChatDigestCompiler — 将 approved 知识候选编译进 Wiki。

复用 wiki_merger 的增量合并规则；workflow/rule 走专用页模板。
"""

from __future__ import annotations

from pathlib import Path

from server.logging_config import get_logger
from shared import config
from knowledge_base.core.compiler.entity_resolver import EntityResolver
from knowledge_base.core.compiler.wiki_merger import (
    supplement_wiki_page,
    upsert_digest_page,
    upsert_entity_page,
    upsert_rule_page,
    upsert_workflow_page,
)
from knowledge_base.core.graph.memory_graph import MemoryGraph
from knowledge_base.core.wiki import wiki_meta
from knowledge_base.models.entity import Entity
from knowledge_base.models.knowledge_candidate import KnowledgeCandidateRecord

log = get_logger("hivemind.compiler.chat_digest")


def _source_label(cand: KnowledgeCandidateRecord) -> str:
    if cand.source_type == "chat":
        return f"Chat · {cand.source_id[:8] if cand.source_id else 'session'}"
    if cand.source_type == "recap":
        return f"会话复盘 · {cand.source_id[:8] if cand.source_id else ''}"
    if cand.source_type == "ingest":
        return f"文档编译 · {cand.source_id or 'upload'}"
    return cand.source_type


def _compile_entity_candidate(
    wiki_root: Path,
    org_id: str,
    cand: KnowledgeCandidateRecord,
    source: str,
) -> str:
    """entity 类候选：经 EntityResolver 合并后写入 entities/ 并同步图谱。"""
    meta = cand.metadata or {}
    entity_type = meta.get("entity_type") or "其他"
    raw_attrs = meta.get("attributes") if isinstance(meta.get("attributes"), dict) else {}
    raw_entity = {
        "name": cand.title,
        "type": entity_type,
        "description": cand.content,
        "attributes": raw_attrs,
    }

    graph = MemoryGraph(config.GRAPH_ROOT / org_id / "graph.db")
    resolver = EntityResolver(graph)
    resolved = resolver.resolve_all(org_id, [raw_entity], source)[0]
    wiki_path = upsert_entity_page(wiki_root, org_id, resolved, source)

    conflict_rows = [
        {
            "field": c.field,
            "existing_value": c.existing_value,
            "new_value": c.new_value,
            "source": c.new_source,
        }
        for c in resolved.conflicts
    ]
    wiki_meta.record_entity_compile(
        wiki_root,
        org_id,
        wiki_path,
        source_id=cand.source_id,
        source_filename=source,
        source_type=cand.source_type,
        entity_type=resolved.entity_type,
        description=resolved.description,
        attributes=resolved.all_attributes,
        attribute_provenance=raw_attrs,
        relations=resolved.relations,
        conflicts=conflict_rows,
        is_new=resolved.is_new,
        new_attributes=resolved.new_attributes,
    )
    graph.upsert_entity(Entity(
        id=resolved.entity_id,
        org_id=org_id,
        name=resolved.name,
        entity_type=resolved.entity_type,
        wiki_path=wiki_path,
        attributes=resolved.all_attributes,
    ))
    log.info("[digest] entity compiled  id=%d  path=%s  new=%s", cand.id, wiki_path, resolved.is_new)
    return wiki_path


def compile_candidate(
    wiki_root: Path,
    org_id: str,
    cand: KnowledgeCandidateRecord,
) -> str:
    """
    将单条候选写入 Wiki，返回 wiki_path。
    根据 resolver_action / category 选择策略。
    """
    source = _source_label(cand)
    action = cand.resolver_action or cand.proposed_action

    if cand.category == "entity" and action != "supplement":
        path = _compile_entity_candidate(wiki_root, org_id, cand, source)
        wiki_meta.record_digest_compile(
            wiki_root, org_id, path,
            source_id=cand.source_id,
            source_label=source,
            source_type=cand.source_type,
            category=cand.category,
            title=cand.title,
            candidate_id=cand.id,
        )
        return path

    if action == "supplement" and cand.target_wiki_path:
        return supplement_wiki_page(
            wiki_root, org_id, cand.target_wiki_path,
            title=cand.title,
            content=cand.content,
            source_label=source,
        )

    if cand.category == "workflow":
        wf = {
            "name": cand.title,
            "steps": [ln.strip() for ln in cand.content.split("\n") if ln.strip()] or [cand.content],
        }
        path = upsert_workflow_page(wiki_root, org_id, wf, source)
        wiki_meta.record_workflow_compile(
            wiki_root, org_id, path,
            source_id=cand.source_id,
            source_filename=source,
            source_type="chat",
            workflow=wf,
        )
        return path

    if cand.category == "rule":
        rule = {
            "name": cand.title,
            "condition": cand.content,
            "action": cand.content,
        }
        path = upsert_rule_page(wiki_root, org_id, rule, source)
        wiki_meta.record_rule_compile(
            wiki_root, org_id, path,
            source_id=cand.source_id,
            source_filename=source,
            source_type="chat",
            rule=rule,
        )
        return path

    if action in ("update", "supplement") and cand.target_wiki_path:
        return supplement_wiki_page(
            wiki_root, org_id, cand.target_wiki_path,
            title=cand.title,
            content=cand.content,
            source_label=source,
        )

    path = upsert_digest_page(
        wiki_root, org_id,
        category=cand.category,
        title=cand.title,
        content=cand.content,
        source_label=source,
    )
    wiki_meta.record_digest_compile(
        wiki_root, org_id, path,
        source_id=cand.source_id,
        source_label=source,
        source_type=cand.source_type,
        category=cand.category,
        title=cand.title,
        candidate_id=cand.id,
    )
    log.info("[digest] compiled  id=%d  path=%s", cand.id, path)
    return path
