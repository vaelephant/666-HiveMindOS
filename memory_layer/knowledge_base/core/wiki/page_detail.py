"""Parse compiled Wiki markdown into structured compilation-result detail."""

from __future__ import annotations

import re
from typing import Any, Optional

from memory_layer.knowledge_base.core.graph.memory_graph import MemoryGraph
from memory_layer.knowledge_base.core.registry.source_registry import SourceRegistry
from memory_layer.knowledge_base.core.domain.wiki_meta import (
    folder_kind,
    kind_label,
    page_pipeline_stages,
    source_type_label,
)
from memory_layer.knowledge_base.core.wiki.categories import category_meta
from memory_layer.knowledge_base.core.wiki import wiki_meta

_SECTION = re.compile(r"^## (.+)$", re.MULTILINE)
_LOG_HEADING = re.compile(r"^### (\d{4}-\d{2}-\d{2}) · (.+)$", re.MULTILINE)
_META = re.compile(r"^\*\*([^*]+)：\*\*\s*(.*)$", re.MULTILINE)
_REL_LINE = re.compile(
    r"^- \[(.+?)\]\((.+?)\)\s*·\s*(\w+)$",
    re.MULTILINE,
)
_TABLE_ROW = re.compile(r"^\| (.+?) \| (.+?) \|$", re.MULTILINE)


def _section_body(content: str, title: str) -> str:
    pattern = re.compile(
        rf"## {re.escape(title)}\n\n(.*?)(?=\n## |\Z)",
        re.DOTALL,
    )
    match = pattern.search(content)
    return match.group(1).strip() if match else ""


def _parse_meta(content: str) -> dict[str, str]:
    meta: dict[str, str] = {}
    for line in content.splitlines()[1:30]:
        m = _META.match(line.strip())
        if m:
            meta[m.group(1)] = m.group(2)
    return meta


def _parse_attributes(body: str) -> list[dict[str, str]]:
    if not body or body == "_暂无_":
        return []
    attrs: list[dict[str, str]] = []
    for row in _TABLE_ROW.finditer(body):
        key, value = row.group(1).strip(), row.group(2).strip()
        if key in ("属性", "------", "字段", "现有值"):
            continue
        if key == "值" or key == "新值":
            continue
        attrs.append({"key": key, "value": value})
    return attrs


def _parse_relations(body: str) -> list[dict[str, str]]:
    if not body or body == "_暂无_":
        return []
    relations: list[dict[str, str]] = []
    for m in _REL_LINE.finditer(body):
        target_path = m.group(2)
        wiki_path = target_path.replace("../", "")
        relations.append(
            {
                "target": m.group(1),
                "relation_type": m.group(3),
                "target_path": wiki_path,
            }
        )
    return relations


def _parse_conflicts(body: str) -> list[dict[str, str]]:
    if not body.strip():
        return []
    conflicts: list[dict[str, str]] = []
    for line in body.splitlines():
        line = line.strip()
        if not line.startswith("|") or "---" in line or line.startswith("| 字段"):
            continue
        parts = [p.strip() for p in line.strip("|").split("|")]
        if len(parts) >= 4:
            conflicts.append(
                {
                    "field": parts[0],
                    "existing_value": parts[1],
                    "new_value": parts[2],
                    "source": parts[3],
                }
            )
    return conflicts


def _parse_version_log(body: str) -> list[dict[str, Any]]:
    if not body.strip():
        return []
    entries: list[dict[str, Any]] = []
    chunks = re.split(r"(?=^### )", body, flags=re.MULTILINE)
    for chunk in chunks:
        chunk = chunk.strip()
        if not chunk:
            continue
        heading = _LOG_HEADING.match(chunk)
        if not heading:
            continue
        date, source = heading.group(1), heading.group(2).strip()
        rest = chunk[heading.end():].strip()
        changes: list[str] = []
        summary = ""
        for line in rest.splitlines():
            line = line.strip()
            if not line:
                continue
            if line.startswith("- "):
                changes.append(line[2:])
            elif line.startswith("_") and line.endswith("_"):
                summary = line.strip("_")
            else:
                changes.append(line)
        entries.append(
            {
                "date": date,
                "source": source,
                "changes": changes,
                "summary": summary,
            }
        )
    return entries


def _parse_list_items(body: str) -> list[str]:
    if not body or body in ("_无_", "_暂无_", "_未指定_"):
        return []
    items: list[str] = []
    for line in body.splitlines():
        line = line.strip()
        if line.startswith("- "):
            items.append(line[2:])
        elif re.match(r"^\d+\.\s", line):
            items.append(re.sub(r"^\d+\.\s", "", line))
    return items


def _infer_kind(category: str, meta: dict[str, str]) -> str:
    if meta.get("类型"):
        return "entity"
    kind = folder_kind(category)
    if kind:
        return kind
    return "entity" if category == "entities" else "other"


def build_page_detail(
    org_id: str,
    wiki_path: str,
    content: str,
    registry: SourceRegistry,
    graph: MemoryGraph,
    sidecar: Optional[dict[str, Any]] = None,
) -> dict[str, Any]:
    parts = wiki_path.split("/", 1)
    category = parts[0] if len(parts) > 1 else "root"
    name = wiki_path.rsplit("/", 1)[-1].replace(".md", "")
    cat_meta = category_meta(category)

    md_meta = _parse_meta(content)
    kind = sidecar.get("kind") if sidecar else _infer_kind(category, md_meta)

    desc_body = _section_body(content, "描述")
    attrs_body = _section_body(content, "属性")
    rel_body = _section_body(content, "关联实体")
    conflict_body = _section_body(content, "冲突信息")
    log_body = _section_body(content, "更新记录")

    steps_body = _section_body(content, "流程步骤")
    conditions_body = _section_body(content, "前提条件")
    participants_body = _section_body(content, "参与角色")
    rule_condition_body = _section_body(content, "触发条件")
    rule_action_body = _section_body(content, "执行动作")
    rule_penalty_body = _section_body(content, "违规后果")

    relations = _parse_relations(rel_body)
    version_log = _parse_version_log(log_body)
    conflicts = _parse_conflicts(conflict_body)

    raw_sources = _resolve_sources(org_id, wiki_path, version_log, registry)
    provenance: dict[str, Any] = {}

    graph_neighbors: list[dict[str, Any]] = []
    entity = graph.get_entity(org_id, name)
    if not entity and md_meta.get("类型"):
        entity = graph.get_entity(org_id, name)
    if entity:
        for neighbor in graph.get_neighbors(entity["id"], org_id):
            graph_neighbors.append(
                {
                    "name": neighbor["name"],
                    "entity_type": neighbor["entity_type"],
                    "wiki_path": neighbor.get("wiki_path"),
                }
            )

    extraction: dict[str, Any] = {
        "summary": desc_body if desc_body and desc_body != "_暂无_" else None,
        "attributes": _parse_attributes(attrs_body),
    }

    if kind == "workflow":
        extraction.update(
            {
                "workflow_steps": _parse_list_items(steps_body),
                "workflow_conditions": _parse_list_items(conditions_body),
                "workflow_participants": participants_body
                if participants_body not in ("_未指定_", "")
                else None,
                "trigger": md_meta.get("触发事件"),
                "duration": md_meta.get("时限要求"),
                "output": md_meta.get("产出物"),
            }
        )
    elif kind == "rule":
        extraction.update(
            {
                "rule_condition": rule_condition_body or None,
                "rule_action": rule_action_body or None,
                "rule_penalty": rule_penalty_body or None,
                "rule_source": md_meta.get("规则来源"),
            }
        )

    if sidecar:
        if sidecar.get("description"):
            extraction["summary"] = sidecar["description"]
        if sidecar.get("relations"):
            relations = sidecar["relations"]
        if sidecar.get("conflicts"):
            conflicts = sidecar["conflicts"]
        if sidecar.get("version_log"):
            version_log = sidecar["version_log"]
        provenance = sidecar.get("attribute_provenance", {})
        enriched_attrs = []
        for attr in extraction["attributes"]:
            hint = provenance.get(attr["key"], {})
            enriched_attrs.append(
                {
                    **attr,
                    "source": hint.get("source"),
                    "source_id": hint.get("source_id"),
                    "page": hint.get("page"),
                    "excerpt": hint.get("excerpt"),
                    "confidence": hint.get("confidence"),
                }
            )
        extraction["attributes"] = enriched_attrs
        sidecar_sources = sidecar.get("sources", [])
        if sidecar_sources:
            raw_sources = [
                {
                    "id": s.get("source_id"),
                    "filename": s["filename"],
                    "source_type": s.get("source_type", "text"),
                    "source_type_label": source_type_label(s.get("source_type", "text")),
                    "created_at": s.get("created_at", ""),
                    "status": "done",
                }
                for s in sidecar_sources
            ]
        citations = _build_citations(version_log, raw_sources, provenance)

    if not sidecar:
        citations = _build_citations(version_log, raw_sources, provenance)

    has_conflicts = bool(conflicts) or bool(sidecar and sidecar.get("has_conflicts"))

    return {
        "path": wiki_path,
        "name": name,
        "title": name,
        "category": category,
        "category_label": cat_meta["label"],
        "kind": kind,
        "meta": md_meta,
        "updated_at": (sidecar or {}).get("updated_at") or md_meta.get("最后更新") or md_meta.get("更新时间"),
        "has_conflicts": has_conflicts,
        "raw_sources": raw_sources,
        "extraction": extraction,
        "conflicts": conflicts,
        "relations": relations,
        "graph_neighbors": graph_neighbors,
        "citations": citations,
        "version_log": version_log,
        "pipeline": _build_page_pipeline(
            kind,
            len(raw_sources),
            len(version_log),
            len(relations) + len(graph_neighbors),
        ),
    }


def _build_citations(
    version_log: list[dict[str, Any]],
    raw_sources: list[dict[str, Any]],
    provenance: dict[str, Any],
) -> list[dict[str, Any]]:
    citations = [
        {
            "source": entry["source"],
            "date": entry["date"],
            "note": entry.get("summary") or "；".join(entry.get("changes") or []) or "编译写入",
            "location": None,
            "page": None,
            "source_id": next(
                (s.get("id") for s in raw_sources if s.get("filename") == entry.get("source")),
                None,
            ),
        }
        for entry in version_log
    ]
    if not citations and raw_sources:
        citations = [
            {
                "source": src["filename"],
                "date": (src.get("created_at") or "")[:10],
                "note": "由该原始资料编译生成本页",
                "location": None,
                "page": None,
                "source_id": src.get("id"),
            }
            for src in raw_sources
        ]
    for key, hint in provenance.items():
        if not isinstance(hint, dict):
            continue
        page = hint.get("page")
        excerpt = hint.get("excerpt")
        if page or excerpt:
            citations.append(
                {
                    "source": hint.get("source") or "",
                    "date": "",
                    "note": f"属性「{key}」：{excerpt or key}",
                    "location": f"第{page}页" if page else None,
                    "page": page,
                    "source_id": hint.get("source_id"),
                }
            )
    return citations


def _build_page_pipeline(
    kind: str,
    raw_count: int,
    version_count: int,
    cross_link_count: int,
) -> list[dict[str, Any]]:
    counts = {
        "raw_sources": raw_count,
        "compiler": version_count or 1,
        "wiki_page": 1,
        "knowledge": 1,
        "cross_links": cross_link_count,
        "version_log": version_count,
    }
    pipeline: list[dict[str, Any]] = []
    for stage in page_pipeline_stages():
        label = stage["label"]
        if label == "__kind__":
            label = kind_label(kind)
        pipeline.append(
            {
                "stage": stage["stage"],
                "label": label,
                "count": counts.get(stage["stage"], 0),
            }
        )
    return pipeline


def _resolve_sources(
    org_id: str,
    wiki_path: str,
    version_log: list[dict[str, Any]],
    registry: SourceRegistry,
) -> list[dict[str, Any]]:
    seen: set[str] = set()
    results: list[dict[str, Any]] = []

    for source in registry.list(org_id):
        if wiki_path in source.wiki_pages:
            key = source.filename
            if key not in seen:
                seen.add(key)
                results.append(_source_dict(source))

    for entry in version_log:
        filename = entry.get("source", "")
        if not filename or filename in seen or filename == "初始编译":
            continue
        matched = next(
            (s for s in registry.list(org_id) if s.filename == filename),
            None,
        )
        if matched:
            seen.add(filename)
            results.append(_source_dict(matched))
        elif filename not in seen:
            seen.add(filename)
            results.append(
                {
                    "id": None,
                    "filename": filename,
                    "source_type": _guess_source_type(filename),
                    "source_type_label": source_type_label(_guess_source_type(filename)),
                    "created_at": entry.get("date"),
                }
            )

    return results


def _guess_source_type(filename: str) -> str:
    lower = filename.lower()
    if lower.endswith(".pdf"):
        return "pdf"
    if lower.endswith((".doc", ".docx")):
        return "word"
    if lower.endswith((".xls", ".xlsx")):
        return "excel"
    return "text"


def _source_dict(source) -> dict[str, Any]:
    return {
        "id": source.id,
        "filename": source.filename,
        "source_type": source.source_type,
        "source_type_label": source_type_label(source.source_type),
        "created_at": source.created_at,
        "status": source.status,
    }
