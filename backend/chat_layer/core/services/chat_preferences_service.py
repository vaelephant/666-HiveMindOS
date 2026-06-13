"""Chat starter questions — org defaults + per-user overrides."""

from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import yaml

from shared import config
from shared.db.postgres import pg_conn
from chat_layer.settings import load


@dataclass
class ChatStartersResult:
    starters: list[str]
    source: str  # user | org | system
    limits: dict[str, int]


def _chat_limits() -> dict[str, int]:
    cfg = load("chat")
    limits = cfg.get("limits") or {}
    return {
        "max_count": int(limits.get("max_count") or 6),
        "max_length": int(limits.get("max_length") or 120),
    }


def _clean_starters(raw: list[Any], *, limits: dict[str, int]) -> list[str]:
    seen: set[str] = set()
    out: list[str] = []
    max_count = limits["max_count"]
    max_length = limits["max_length"]
    for item in raw:
        text = str(item or "").strip()
        if not text or text in seen:
            continue
        if len(text) > max_length:
            raise ValueError(f"快捷问题不能超过 {max_length} 字")
        seen.add(text)
        out.append(text)
        if len(out) >= max_count:
            break
    return out


def _system_default_starters() -> list[str]:
    cfg = load("chat")
    raw = cfg.get("default_starters") or []
    if not isinstance(raw, list):
        return []
    limits = _chat_limits()
    return _clean_starters(raw, limits=limits)


def _org_override_path(org_id: str) -> Path:
    return config.ORGS_ROOT / org_id / "chat.yaml"


def _org_default_starters(org_id: str) -> list[str]:
    path = _org_override_path(org_id)
    if path.is_file():
        data = yaml.safe_load(path.read_text(encoding="utf-8")) or {}
        raw = data.get("starters") or data.get("default_starters") or []
        if isinstance(raw, list) and raw:
            limits = _chat_limits()
            cleaned = _clean_starters(raw, limits=limits)
            if cleaned:
                return cleaned
    return _system_default_starters()


def _load_user_starters(org_id: str, user_id: str) -> list[str] | None:
    with pg_conn() as conn:
        row = conn.execute(
            """
            SELECT starters FROM user_chat_preferences
            WHERE org_id = %s AND user_id = %s
            """,
            (org_id, user_id),
        ).fetchone()
    if not row:
        return None
    raw = row[0]
    if isinstance(raw, str):
        raw = json.loads(raw)
    if not isinstance(raw, list) or len(raw) == 0:
        return None
    limits = _chat_limits()
    return _clean_starters(raw, limits=limits)


def get_chat_starters(org_id: str, user_id: str) -> ChatStartersResult:
    limits = _chat_limits()
    user_starters = _load_user_starters(org_id, user_id)
    if user_starters:
        return ChatStartersResult(starters=user_starters, source="user", limits=limits)

    org_starters = _org_default_starters(org_id)
    system_starters = _system_default_starters()
    if org_starters != system_starters:
        return ChatStartersResult(starters=org_starters, source="org", limits=limits)
    return ChatStartersResult(starters=org_starters, source="system", limits=limits)


def save_user_starters(org_id: str, user_id: str, starters: list[str]) -> ChatStartersResult:
    limits = _chat_limits()
    cleaned = _clean_starters(starters, limits=limits)

    with pg_conn() as conn:
        if cleaned:
            conn.execute(
                """
                INSERT INTO user_chat_preferences (org_id, user_id, starters, updated_at)
                VALUES (%s, %s, %s::jsonb, NOW())
                ON CONFLICT (org_id, user_id) DO UPDATE
                SET starters = EXCLUDED.starters, updated_at = NOW()
                """,
                (org_id, user_id, json.dumps(cleaned, ensure_ascii=False)),
            )
        else:
            conn.execute(
                """
                DELETE FROM user_chat_preferences
                WHERE org_id = %s AND user_id = %s
                """,
                (org_id, user_id),
            )

    return get_chat_starters(org_id, user_id)


def clear_user_starters(org_id: str, user_id: str) -> ChatStartersResult:
    return save_user_starters(org_id, user_id, [])
