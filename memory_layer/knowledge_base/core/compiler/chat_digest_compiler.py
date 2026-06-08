"""
ChatDigestCompiler — 将 approved 知识候选编译进 Wiki。

复用 wiki_merger 的增量合并规则；workflow/rule 走专用页模板。
"""

from __future__ import annotations

from pathlib import Path

from memory_layer.knowledge_base.app.logging_config import get_logger
from memory_layer.knowledge_base.core.compiler.wiki_merger import (
    supplement_wiki_page,
    upsert_digest_page,
    upsert_rule_page,
    upsert_workflow_page,
)
from memory_layer.knowledge_base.core.wiki import wiki_meta
from memory_layer.knowledge_base.models.knowledge_candidate import KnowledgeCandidateRecord

log = get_logger("hivemind.compiler.chat_digest")


def _source_label(cand: KnowledgeCandidateRecord) -> str:
    if cand.source_type == "chat":
        return f"Chat · {cand.source_id[:8] if cand.source_id else 'session'}"
    if cand.source_type == "recap":
        return f"会话复盘 · {cand.source_id[:8] if cand.source_id else ''}"
    if cand.source_type == "ingest":
        return f"文档编译 · {cand.source_id or 'upload'}"
    return cand.source_type


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
