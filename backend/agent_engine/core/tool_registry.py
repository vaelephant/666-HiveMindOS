"""外部工具 / MCP 注册表 — 与 task_tools.yaml 内置 action 并列。"""

from __future__ import annotations

import json
from datetime import datetime, timezone
from typing import Any

import yaml
from pathlib import Path

from agent_engine.settings import load
from agent_engine.tools.task_toolkit import format_tools_for_prompt, list_actions
from knowledge_base.core.db.postgres import pg_conn
from server.logging_config import get_logger

log = get_logger("hivemind.tool_registry")

_TEMPLATES_PATH = Path(__file__).resolve().parents[1] / "settings" / "external_tools.yaml"


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _load_templates() -> list[dict]:
    if not _TEMPLATES_PATH.is_file():
        return []
    data = yaml.safe_load(_TEMPLATES_PATH.read_text(encoding="utf-8")) or {}
    return list(data.get("templates") or [])


def _ensure_seeded(org_id: str) -> None:
    with pg_conn() as conn:
        row = conn.execute(
            "SELECT COUNT(*) FROM external_tools WHERE org_id = %s",
            (org_id,),
        ).fetchone()
        if row and int(row[0]) > 0:
            return
        for tpl in _load_templates():
            conn.execute(
                """
                INSERT INTO external_tools (
                    org_id, tool_id, label, kind, description, endpoint, enabled, config
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s::jsonb)
                ON CONFLICT (org_id, tool_id) DO NOTHING
                """,
                (
                    org_id,
                    tpl["tool_id"],
                    tpl.get("label") or tpl["tool_id"],
                    tpl.get("kind") or "mcp",
                    tpl.get("description"),
                    tpl.get("endpoint"),
                    bool(tpl.get("enabled", False)),
                    json.dumps(tpl.get("config") or {}, ensure_ascii=False),
                ),
            )
        conn.commit()


def _row_to_dict(row) -> dict:
    cfg = row[8]
    if isinstance(cfg, str):
        cfg = json.loads(cfg)
    return {
        "id": int(row[0]),
        "org_id": row[1],
        "tool_id": row[2],
        "label": row[3],
        "kind": row[4],
        "description": row[5],
        "endpoint": row[6],
        "enabled": bool(row[7]),
        "config": cfg or {},
        "created_at": row[9].isoformat() if hasattr(row[9], "isoformat") else str(row[9]),
        "updated_at": row[10].isoformat() if hasattr(row[10], "isoformat") else str(row[10]),
    }


def list_external_tools(org_id: str) -> list[dict]:
    _ensure_seeded(org_id)
    with pg_conn() as conn:
        rows = conn.execute(
            """
            SELECT id, org_id, tool_id, label, kind, description, endpoint,
                   enabled, config, created_at, updated_at
            FROM external_tools
            WHERE org_id = %s
            ORDER BY kind, tool_id
            """,
            (org_id,),
        ).fetchall()
    return [_row_to_dict(r) for r in rows]


def get_catalog(org_id: str) -> dict:
    """合并内置 task action 与外部/MCP 工具。"""
    builtin = []
    for name in list_actions():
        for a in load("task_tools")["actions"]:
            if a["name"] == name:
                builtin.append({
                    "tool_id": a["name"],
                    "label": a["name"],
                    "kind": "builtin",
                    "domain": a.get("domain"),
                    "description": a.get("description"),
                    "enabled": True,
                    "source": "task_tools.yaml",
                })
                break
    external = list_external_tools(org_id)
    return {
        "builtin": builtin,
        "external": external,
        "builtin_count": len(builtin),
        "external_count": len(external),
        "enabled_external": sum(1 for t in external if t["enabled"]),
    }


def update_tool(
    org_id: str,
    tool_id: str,
    *,
    enabled: bool | None = None,
    endpoint: str | None = None,
    description: str | None = None,
    config: dict | None = None,
) -> dict:
    _ensure_seeded(org_id)
    sets: list[str] = ["updated_at = %s"]
    params: list[Any] = [_now()]
    if enabled is not None:
        sets.append("enabled = %s")
        params.append(enabled)
    if endpoint is not None:
        sets.append("endpoint = %s")
        params.append(endpoint)
    if description is not None:
        sets.append("description = %s")
        params.append(description)
    if config is not None:
        sets.append("config = %s::jsonb")
        params.append(json.dumps(config, ensure_ascii=False))
    params.extend([org_id, tool_id])
    with pg_conn() as conn:
        cur = conn.execute(
            f"""
            UPDATE external_tools SET {", ".join(sets)}
            WHERE org_id = %s AND tool_id = %s
            RETURNING id, org_id, tool_id, label, kind, description, endpoint,
                      enabled, config, created_at, updated_at
            """,
            params,
        )
        row = cur.fetchone()
        conn.commit()
    if not row:
        raise ValueError(f"工具不存在: {tool_id}")
    return _row_to_dict(row)


def format_catalog_for_prompt(org_id: str) -> str:
    """Planner 可见的外部工具摘要（enabled only）。"""
    lines = [format_tools_for_prompt(), "", "## 外部 / MCP 工具（已启用）"]
    enabled = [t for t in list_external_tools(org_id) if t["enabled"]]
    if not enabled:
        lines.append("- （无）")
    else:
        for t in enabled:
            ep = t.get("endpoint") or "未配置 endpoint"
            lines.append(f"- {t['tool_id']} ({t['kind']}): {t.get('description') or t['label']} [{ep}]")
    return "\n".join(lines)
