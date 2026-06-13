"""Per-user model preferences and custom profiles."""

from __future__ import annotations

import json
import re
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any

from model_layer import registry
from model_layer.registry import ResolvedProfile
from model_layer.user_resolver import register_user_profile_resolver
from knowledge_base.core.db.postgres import pg_conn

_CUSTOM_ID_RE = re.compile(r"^[a-z][a-z0-9_-]{1,48}$")
_ALLOWED_PROVIDERS = frozenset({"openai", "anthropic"})
_ALLOWED_KINDS = frozenset({"chat", "embed"})


@dataclass
class UserModelSettings:
    org_id: str
    user_id: str
    chat_profile: str
    fast_profile: str
    embed_profile: str
    custom_profiles: list[dict[str, Any]]
    updated_at: str | None = None


def _slugify_id(label: str) -> str:
    base = re.sub(r"[^a-z0-9]+", "-", label.lower()).strip("-")
    if not base:
        base = "custom"
    if not base[0].isalpha():
        base = f"m-{base}"
    return base[:48]


def _validate_custom_profile(payload: dict[str, Any], *, existing_ids: set[str]) -> dict[str, Any]:
    label = str(payload.get("label") or "").strip()
    if not label:
        raise ValueError("模型名称不能为空")

    profile_id = str(payload.get("id") or "").strip() or _slugify_id(label)
    if not _CUSTOM_ID_RE.match(profile_id):
        raise ValueError("模型 ID 须以小写字母开头，仅含 a-z、0-9、-、_")
    if profile_id in existing_ids:
        raise ValueError(f"模型 ID 已存在: {profile_id}")

    provider = str(payload.get("provider") or "").strip().lower()
    if provider not in _ALLOWED_PROVIDERS:
        raise ValueError(f"不支持的 provider: {provider}")

    kind = str(payload.get("kind") or "chat").strip().lower()
    if kind not in _ALLOWED_KINDS:
        raise ValueError(f"不支持的 kind: {kind}")

    model = str(payload.get("model") or "").strip()
    if not model:
        raise ValueError("模型名称（model）不能为空")

    max_tokens = int(payload.get("max_tokens") or (4096 if kind == "chat" else 8192))
    if max_tokens < 256 or max_tokens > 128000:
        raise ValueError("max_tokens 须在 256~128000 之间")

    dim = payload.get("dim")
    if kind == "embed":
        dim = int(dim or 1536)
    else:
        dim = None

    return {
        "id": profile_id,
        "label": label,
        "kind": kind,
        "provider": provider,
        "model": model,
        "max_tokens": max_tokens,
        **({"dim": dim} if dim is not None else {}),
        "source": "custom",
    }


def _parse_settings_row(row) -> UserModelSettings:
    custom = row[5]
    if not isinstance(custom, list):
        custom = []
    updated = row[6]
    updated_iso = updated.isoformat() if isinstance(updated, datetime) else None
    return UserModelSettings(
        org_id=row[0],
        user_id=row[1],
        chat_profile=row[2],
        fast_profile=row[3],
        embed_profile=row[4],
        custom_profiles=custom,
        updated_at=updated_iso,
    )


def _default_settings(org_id: str, user_id: str) -> UserModelSettings:
    cfg = registry.raw_config()
    defaults = cfg.get("defaults") or {}
    return UserModelSettings(
        org_id=org_id,
        user_id=user_id,
        chat_profile=str(defaults.get("chat") or "default"),
        fast_profile="fast",
        embed_profile=str(defaults.get("embed") or "embedding"),
        custom_profiles=[],
    )


def get_settings(org_id: str, user_id: str) -> UserModelSettings:
    with pg_conn() as conn:
        row = conn.execute(
            """
            SELECT org_id, user_id, chat_profile, fast_profile, embed_profile,
                   custom_profiles, updated_at
            FROM user_model_settings
            WHERE org_id = %s AND user_id = %s
            """,
            (org_id, user_id),
        ).fetchone()
    if not row:
        return _default_settings(org_id, user_id)
    return _parse_settings_row(row)


def _ensure_row(conn, org_id: str, user_id: str) -> UserModelSettings:
    row = conn.execute(
        """
        SELECT org_id, user_id, chat_profile, fast_profile, embed_profile,
               custom_profiles, updated_at
        FROM user_model_settings
        WHERE org_id = %s AND user_id = %s
        """,
        (org_id, user_id),
    ).fetchone()
    if row:
        return _parse_settings_row(row)
    defaults = _default_settings(org_id, user_id)
    conn.execute(
        """
        INSERT INTO user_model_settings (org_id, user_id, chat_profile, fast_profile, embed_profile)
        VALUES (%s, %s, %s, %s, %s)
        """,
        (org_id, user_id, defaults.chat_profile, defaults.fast_profile, defaults.embed_profile),
    )
    return defaults


def _profile_ids(settings: UserModelSettings) -> set[str]:
    return {p["id"] for p in settings.custom_profiles}


def _validate_profile_choice(profile_id: str, kind: str, settings: UserModelSettings) -> None:
    if any(p["id"] == profile_id and p.get("kind", "chat") == kind for p in settings.custom_profiles):
        return
    try:
        registry.resolve(profile_id, kind=kind)
    except (KeyError, ValueError) as exc:
        raise ValueError(f"无效的 {kind} profile: {profile_id}") from exc


def save_preferences(
    org_id: str,
    user_id: str,
    *,
    chat_profile: str | None = None,
    fast_profile: str | None = None,
    embed_profile: str | None = None,
) -> UserModelSettings:
    with pg_conn() as conn:
        settings = _ensure_row(conn, org_id, user_id)
        chat = chat_profile or settings.chat_profile
        fast = fast_profile or settings.fast_profile
        embed = embed_profile or settings.embed_profile
        _validate_profile_choice(chat, "chat", settings)
        _validate_profile_choice(fast, "chat", settings)
        _validate_profile_choice(embed, "embed", settings)
        conn.execute(
            """
            UPDATE user_model_settings
            SET chat_profile = %s, fast_profile = %s, embed_profile = %s, updated_at = NOW()
            WHERE org_id = %s AND user_id = %s
            """,
            (chat, fast, embed, org_id, user_id),
        )
        conn.commit()
    return get_settings(org_id, user_id)


def add_custom_profile(org_id: str, user_id: str, payload: dict[str, Any]) -> UserModelSettings:
    with pg_conn() as conn:
        settings = _ensure_row(conn, org_id, user_id)
        system_ids = set((registry.raw_config().get("profiles") or {}).keys())
        existing = _profile_ids(settings) | system_ids
        profile = _validate_custom_profile(payload, existing_ids=existing)
        profiles = list(settings.custom_profiles) + [profile]
        conn.execute(
            """
            UPDATE user_model_settings
            SET custom_profiles = %s::jsonb, updated_at = NOW()
            WHERE org_id = %s AND user_id = %s
            """,
            (json.dumps(profiles), org_id, user_id),
        )
        conn.commit()
    return get_settings(org_id, user_id)


def remove_custom_profile(org_id: str, user_id: str, profile_id: str) -> UserModelSettings:
    with pg_conn() as conn:
        settings = _ensure_row(conn, org_id, user_id)
        profiles = [p for p in settings.custom_profiles if p.get("id") != profile_id]
        if len(profiles) == len(settings.custom_profiles):
            raise ValueError(f"自定义模型不存在: {profile_id}")
        chat = settings.chat_profile
        fast = settings.fast_profile
        embed = settings.embed_profile
        defaults = _default_settings(org_id, user_id)
        if chat == profile_id:
            chat = defaults.chat_profile
        if fast == profile_id:
            fast = defaults.fast_profile
        if embed == profile_id:
            embed = defaults.embed_profile
        conn.execute(
            """
            UPDATE user_model_settings
            SET custom_profiles = %s::jsonb,
                chat_profile = %s, fast_profile = %s, embed_profile = %s,
                updated_at = NOW()
            WHERE org_id = %s AND user_id = %s
            """,
            (json.dumps(profiles), chat, fast, embed, org_id, user_id),
        )
        conn.commit()
    return get_settings(org_id, user_id)


def resolve_user_profile(org_id: str, user_id: str, profile_id: str) -> ResolvedProfile | None:
    settings = get_settings(org_id, user_id)
    for spec in settings.custom_profiles:
        if spec.get("id") != profile_id:
            continue
        return ResolvedProfile(
            id=profile_id,
            kind=spec.get("kind", "chat"),
            provider=spec.get("provider", ""),
            model=spec.get("model", ""),
            max_tokens=int(spec.get("max_tokens") or 8192),
            dim=int(spec["dim"]) if spec.get("dim") is not None else None,
        )
    return None


def _provider_available(provider: str) -> bool:
    import os
    cfg = registry.raw_config()
    providers = cfg.get("providers") or {}
    spec = providers.get(provider) or {}
    env_key = spec.get("api_key_env", "")
    return bool(env_key and os.environ.get(env_key, "").strip())


def list_model_catalog(org_id: str, user_id: str) -> dict:
    settings = get_settings(org_id, user_id)
    cfg = registry.raw_config()
    providers_cfg = cfg.get("providers") or {}
    system: list[dict] = []
    for pid, spec in (cfg.get("profiles") or {}).items():
        try:
            resolved = registry.resolve(pid)
        except (KeyError, ValueError):
            continue
        provider = spec.get("provider", "")
        system.append({
            "id": pid,
            "label": pid,
            "kind": resolved.kind,
            "provider": provider,
            "model": resolved.model,
            "max_tokens": resolved.max_tokens,
            "dim": resolved.dim,
            "optional": bool(spec.get("optional")),
            "source": "system",
            "available": _provider_available(provider),
        })
    custom = [
        {
            **p,
            "available": _provider_available(p.get("provider", "")),
        }
        for p in settings.custom_profiles
    ]
    return {
        "preferences": {
            "chat_profile": settings.chat_profile,
            "fast_profile": settings.fast_profile,
            "embed_profile": settings.embed_profile,
            "updated_at": settings.updated_at,
        },
        "system_profiles": system,
        "custom_profiles": custom,
        "providers": [
            {"id": k, "api_key_env": v.get("api_key_env"), "available": _provider_available(k)}
            for k, v in providers_cfg.items()
        ],
    }


def init_user_profile_resolver() -> None:
    register_user_profile_resolver(resolve_user_profile)
