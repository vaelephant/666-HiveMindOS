"""
Entity Resolver — Phase 1 (name-based merge)

For each extracted entity:
- Exact name match against existing graph → merge attributes, track conflicts
- No match → new entity
"""
from __future__ import annotations

import uuid
from dataclasses import dataclass, field
from typing import Optional

from memory_layer.knowledge_base.app.logging_config import get_logger
from memory_layer.knowledge_base.core.graph.memory_graph import MemoryGraph

log = get_logger("hivemind.compiler.resolver")

_EMPTY = {"", "{}", "[]", "null", "none", "n/a", "无", "—", "-"}


def _is_empty(v) -> bool:
    if v is None:
        return True
    return str(v).strip().lower() in _EMPTY


@dataclass
class Conflict:
    field: str
    existing_value: str
    new_value: str
    existing_source: str = "unknown"
    new_source: str = "unknown"


@dataclass
class ResolvedEntity:
    entity_id: str
    is_new: bool
    name: str
    entity_type: str
    description: str
    all_attributes: dict          # merged: existing ∪ new (no overwrite)
    new_attributes: dict          # only attributes added this round
    conflicts: list[Conflict]
    relations: list[dict]
    existing_wiki_path: Optional[str] = None


class EntityResolver:
    def __init__(self, graph: MemoryGraph):
        self._graph = graph

    def resolve_all(
        self, org_id: str, entities: list[dict], source_filename: str
    ) -> list[ResolvedEntity]:
        results: list[ResolvedEntity] = []
        for e in entities:
            existing = self._graph.get_entity(org_id, e["name"])
            raw_attrs = {k: v for k, v in e.get("attributes", {}).items() if not _is_empty(v)}

            if existing:
                clean_existing = {
                    k: v for k, v in existing["attributes"].items() if not _is_empty(v)
                }
                merged, new_only, conflicts = self._merge_attrs(
                    clean_existing, raw_attrs, source_filename
                )
                log.debug(
                    "resolve EXISTING  name=%s  new_attrs=%d  conflicts=%d",
                    e["name"], len(new_only), len(conflicts),
                )
                results.append(ResolvedEntity(
                    entity_id=existing["id"],
                    is_new=False,
                    name=e["name"],
                    entity_type=e["type"],
                    description=e.get("description", ""),
                    all_attributes=merged,
                    new_attributes=new_only,
                    conflicts=conflicts,
                    relations=e.get("relations", []),
                    existing_wiki_path=existing.get("wiki_path"),
                ))
            else:
                log.debug("resolve NEW       name=%s  attrs=%d", e["name"], len(raw_attrs))
                results.append(ResolvedEntity(
                    entity_id=str(uuid.uuid4()),
                    is_new=True,
                    name=e["name"],
                    entity_type=e["type"],
                    description=e.get("description", ""),
                    all_attributes=raw_attrs,
                    new_attributes=raw_attrs,
                    conflicts=[],
                    relations=e.get("relations", []),
                ))
        return results

    @staticmethod
    def _merge_attrs(
        existing: dict, new: dict, source: str
    ) -> tuple[dict, dict, list[Conflict]]:
        merged = dict(existing)
        new_only: dict = {}
        conflicts: list[Conflict] = []

        for k, v in new.items():
            if k not in merged:
                merged[k] = v
                new_only[k] = v
            elif str(merged[k]).strip() != str(v).strip():
                conflicts.append(Conflict(
                    field=k,
                    existing_value=str(merged[k]),
                    new_value=str(v),
                    new_source=source,
                ))
        return merged, new_only, conflicts
