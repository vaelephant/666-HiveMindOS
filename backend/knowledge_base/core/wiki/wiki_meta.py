"""Sidecar metadata (.meta.json) for compiled wiki pages."""

from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Optional


def _now() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%d")


def meta_path_for(wiki_root: Path, org_id: str, wiki_path: str) -> Path:
    rel = Path(wiki_path)
    return wiki_root / org_id / rel.with_suffix(".meta.json")


def load_meta(wiki_root: Path, org_id: str, wiki_path: str) -> Optional[dict[str, Any]]:
    path = meta_path_for(wiki_root, org_id, wiki_path)
    if not path.exists():
        return None
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        return None


def save_meta(wiki_root: Path, org_id: str, wiki_path: str, data: dict[str, Any]) -> None:
    path = meta_path_for(wiki_root, org_id, wiki_path)
    path.parent.mkdir(parents=True, exist_ok=True)
    data["wiki_path"] = wiki_path
    data["updated_at"] = _now()
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")


def delete_meta(wiki_root: Path, org_id: str, wiki_path: str) -> None:
    path = meta_path_for(wiki_root, org_id, wiki_path)
    if path.exists():
        path.unlink()


def _source_entry(
    source_id: Optional[str],
    filename: str,
    source_type: str,
) -> dict[str, Any]:
    return {
        "source_id": source_id,
        "filename": filename,
        "source_type": source_type,
    }


def _append_version(
    meta: dict[str, Any],
    source_filename: str,
    changes: list[str],
    summary: str = "",
) -> None:
    log = meta.setdefault("version_log", [])
    log.insert(
        0,
        {
            "date": _now(),
            "source": source_filename,
            "changes": changes,
            "summary": summary,
        },
    )


def record_entity_compile(
    wiki_root: Path,
    org_id: str,
    wiki_path: str,
    *,
    source_id: Optional[str],
    source_filename: str,
    source_type: str,
    entity_type: str,
    description: str,
    attributes: dict[str, Any],
    attribute_provenance: dict[str, Any],
    relations: list[dict],
    conflicts: list[dict],
    is_new: bool,
    new_attributes: dict[str, Any],
) -> None:
    existing = load_meta(wiki_root, org_id, wiki_path) or {}
    sources: list[dict] = existing.get("sources", [])
    src = _source_entry(source_id, source_filename, source_type)
    if not any(s.get("filename") == src["filename"] for s in sources):
        sources.append(src)

    prov = existing.get("attribute_provenance", {})
    for key, val in attributes.items():
        hint = attribute_provenance.get(key, {})
        if isinstance(hint, dict):
            prov[key] = {
                "source": source_filename,
                "source_id": source_id,
                "page": hint.get("page"),
                "excerpt": hint.get("excerpt"),
                "confidence": hint.get("confidence", "medium"),
            }
        elif key not in prov:
            prov[key] = {
                "source": source_filename,
                "source_id": source_id,
                "page": None,
                "excerpt": None,
                "confidence": "medium",
            }

    changes: list[str] = []
    if is_new:
        changes.append(f"初始创建 · 属性 {len(attributes)} 项 · 关联 {len(relations)} 条")
    else:
        for k, v in new_attributes.items():
            changes.append(f"新增属性：{k} = {v}")
        for rel in relations:
            changes.append(f"新增关联：{rel.get('target')} ({rel.get('type')})")
        if not changes:
            changes.append("来源文件重新编译，无新增信息")

    merged_conflicts = existing.get("conflicts", []) + conflicts

    meta = {
        **existing,
        "kind": "entity",
        "entity_type": entity_type,
        "description": description or existing.get("description"),
        "sources": sources,
        "attribute_provenance": prov,
        "relations": relations or existing.get("relations", []),
        "conflicts": merged_conflicts,
        "has_conflicts": len(merged_conflicts) > 0,
    }
    _append_version(meta, source_filename, changes, "初始创建" if is_new else "")
    save_meta(wiki_root, org_id, wiki_path, meta)


def record_workflow_compile(
    wiki_root: Path,
    org_id: str,
    wiki_path: str,
    *,
    source_id: Optional[str],
    source_filename: str,
    source_type: str,
    workflow: dict,
) -> None:
    existing = load_meta(wiki_root, org_id, wiki_path) or {}
    sources = existing.get("sources", [])
    src = _source_entry(source_id, source_filename, source_type)
    if not any(s.get("filename") == src["filename"] for s in sources):
        sources.append(src)

    meta = {
        **existing,
        "kind": "workflow",
        "sources": sources,
        "workflow": workflow,
        "has_conflicts": False,
        "conflicts": existing.get("conflicts", []),
    }
    note = "初始创建" if not existing else "流程内容已更新"
    _append_version(meta, source_filename, [note], note)
    save_meta(wiki_root, org_id, wiki_path, meta)


def record_rule_compile(
    wiki_root: Path,
    org_id: str,
    wiki_path: str,
    *,
    source_id: Optional[str],
    source_filename: str,
    source_type: str,
    rule: dict,
) -> None:
    existing = load_meta(wiki_root, org_id, wiki_path) or {}
    sources = existing.get("sources", [])
    src = _source_entry(source_id, source_filename, source_type)
    if not any(s.get("filename") == src["filename"] for s in sources):
        sources.append(src)

    meta = {
        **existing,
        "kind": "rule",
        "sources": sources,
        "rule": rule,
        "has_conflicts": False,
        "conflicts": existing.get("conflicts", []),
    }
    note = "初始创建" if not existing else "规则内容已更新"
    _append_version(meta, source_filename, [note], note)
    save_meta(wiki_root, org_id, wiki_path, meta)


def record_digest_compile(
    wiki_root: Path,
    org_id: str,
    wiki_path: str,
    *,
    source_id: Optional[str],
    source_label: str,
    source_type: str,
    category: str,
    title: str,
    candidate_id: Optional[int] = None,
) -> None:
    existing = load_meta(wiki_root, org_id, wiki_path) or {}
    sources = existing.get("sources", [])
    src = {
        "source_id": source_id,
        "filename": source_label,
        "source_type": source_type,
        "candidate_id": candidate_id,
    }
    if not any(s.get("filename") == src["filename"] for s in sources):
        sources.append(src)

    meta = {
        **existing,
        "kind": "digest",
        "category": category,
        "title": title,
        "sources": sources,
        "has_conflicts": False,
        "conflicts": existing.get("conflicts", []),
    }
    note = "初始创建" if not existing else "候选知识编译更新"
    _append_version(meta, source_label, [note], note)
    save_meta(wiki_root, org_id, wiki_path, meta)


def list_summary_from_meta(meta: Optional[dict[str, Any]], wiki_path: str) -> dict[str, Any]:
    category = wiki_path.split("/")[0] if "/" in wiki_path else "root"
    if not meta:
        return {
            "kind": "entity" if category == "entities" else category.rstrip("s") or "other",
            "updated_at": None,
            "source_count": 0,
            "has_conflicts": False,
            "relation_count": 0,
        }
    return {
        "kind": meta.get("kind", "other"),
        "entity_type": meta.get("entity_type"),
        "updated_at": meta.get("updated_at"),
        "source_count": len(meta.get("sources", [])),
        "has_conflicts": bool(meta.get("has_conflicts")),
        "relation_count": len(meta.get("relations", [])),
    }
