"""Migrate legacy wiki pages to .meta.json sidecars."""

from __future__ import annotations

from memory_layer.knowledge_base.core.graph.memory_graph import MemoryGraph
from memory_layer.knowledge_base.core.registry.source_registry import SourceRegistry
from memory_layer.knowledge_base.core.wiki.page_detail import build_page_detail
from memory_layer.knowledge_base.core.wiki.wiki_manager import WikiManager
from memory_layer.knowledge_base.core.wiki import wiki_meta


def migrate_org(
    wiki_root,
    org_id: str,
    registry: SourceRegistry,
    graph: MemoryGraph,
    force: bool = False,
) -> dict:
    wiki = WikiManager(wiki_root)
    migrated = 0
    skipped = 0

    for page in wiki.list_pages(org_id):
        wiki_path = page["path"]
        if not force and wiki_meta.load_meta(wiki_root, org_id, wiki_path):
            skipped += 1
            continue

        content = wiki.read_page(org_id, wiki_path)
        if not content:
            continue

        detail = build_page_detail(org_id, wiki_path, content, registry, graph)
        category = detail["category"]
        kind = detail["kind"]

        sources = []
        for src in detail["raw_sources"]:
            sources.append(
                {
                    "source_id": src.get("id"),
                    "filename": src["filename"],
                    "source_type": src.get("source_type", "text"),
                }
            )

        prov = {}
        for attr in detail["extraction"].get("attributes", []):
            key = attr["key"]
            citation = next(
                (c for c in detail["citations"] if c["source"] in [s["filename"] for s in sources]),
                None,
            )
            prov[key] = {
                "source": sources[0]["filename"] if sources else "",
                "source_id": sources[0].get("source_id") if sources else None,
                "page": None,
                "excerpt": attr.get("value"),
                "confidence": "medium",
            }

        meta = {
            "kind": kind,
            "entity_type": detail["meta"].get("类型"),
            "description": detail["extraction"].get("summary"),
            "sources": sources,
            "attribute_provenance": prov,
            "relations": detail["relations"],
            "conflicts": detail["conflicts"],
            "has_conflicts": len(detail["conflicts"]) > 0,
            "version_log": detail["version_log"]
            or [
                {
                    "date": detail["meta"].get("最后更新") or detail["meta"].get("更新时间") or "",
                    "source": sources[0]["filename"] if sources else "迁移生成",
                    "changes": ["从既有 Wiki Markdown 迁移生成 meta"],
                    "summary": "历史数据迁移",
                }
            ],
        }

        if kind == "workflow":
            meta["workflow"] = {
                "steps": detail["extraction"].get("workflow_steps", []),
                "conditions": detail["extraction"].get("workflow_conditions", []),
                "participants": detail["extraction"].get("workflow_participants"),
            }
        elif kind == "rule":
            meta["rule"] = {
                "condition": detail["extraction"].get("rule_condition"),
                "action": detail["extraction"].get("rule_action"),
                "penalty": detail["extraction"].get("rule_penalty"),
            }

        wiki_meta.save_meta(wiki_root, org_id, wiki_path, meta)
        migrated += 1

    return {"migrated": migrated, "skipped": skipped, "total": migrated + skipped}
