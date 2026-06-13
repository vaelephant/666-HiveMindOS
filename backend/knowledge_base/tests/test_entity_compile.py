"""Entity candidate compilation tests."""

from __future__ import annotations

from pathlib import Path
from unittest.mock import MagicMock, patch

from knowledge_base.core.compiler.chat_digest_compiler import compile_candidate
from knowledge_base.models.knowledge_candidate import KnowledgeCandidateRecord


def _entity_cand(**kwargs) -> KnowledgeCandidateRecord:
    base = dict(
        id=1,
        org_id="demo",
        user_id="u1",
        category="entity",
        title="Acme Corp",
        content="重要客户，主营 SaaS",
        source_type="chat",
        source_id="sess-1",
        confidence=0.9,
        proposed_action="create",
        status="approved",
        resolver_action="create",
        resolver_note="",
        target_wiki_path=None,
        memory_id=None,
        metadata={"entity_type": "customer"},
        created_at="2026-06-13T00:00:00Z",
        updated_at="2026-06-13T00:00:00Z",
    )
    base.update(kwargs)
    return KnowledgeCandidateRecord(**base)


def test_compile_entity_uses_resolver(tmp_path: Path):
    wiki_root = tmp_path / "wiki"
    cand = _entity_cand()

    resolved = MagicMock()
    resolved.entity_id = "ent-1"
    resolved.is_new = True
    resolved.name = "Acme Corp"
    resolved.entity_type = "customer"
    resolved.description = cand.content
    resolved.all_attributes = {"industry": "SaaS"}
    resolved.new_attributes = {"industry": "SaaS"}
    resolved.conflicts = []
    resolved.relations = []

    with patch("knowledge_base.core.compiler.chat_digest_compiler.MemoryGraph") as graph_cls:
        with patch("knowledge_base.core.compiler.chat_digest_compiler.EntityResolver") as resolver_cls:
            with patch("knowledge_base.core.compiler.chat_digest_compiler.upsert_entity_page", return_value="entities/Acme_Corp.md") as upsert:
                with patch("knowledge_base.core.compiler.chat_digest_compiler.wiki_meta.record_entity_compile"):
                    with patch("knowledge_base.core.compiler.chat_digest_compiler.wiki_meta.record_digest_compile"):
                        resolver_cls.return_value.resolve_all.return_value = [resolved]
                        path = compile_candidate(wiki_root, "demo", cand)

    assert path == "entities/Acme_Corp.md"
    upsert.assert_called_once()
    graph_cls.return_value.upsert_entity.assert_called_once()
