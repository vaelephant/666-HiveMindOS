"""Optional per-user custom profile resolution (registered by KB at startup)."""

from __future__ import annotations

from typing import Callable

from model_layer.registry import ResolvedProfile

UserProfileResolver = Callable[[str, str, str], ResolvedProfile | None]

_resolver: UserProfileResolver | None = None


def register_user_profile_resolver(resolver: UserProfileResolver) -> None:
    global _resolver
    _resolver = resolver


def try_resolve_user_profile(org_id: str, user_id: str, profile_id: str) -> ResolvedProfile | None:
    if _resolver is None:
        return None
    try:
        return _resolver(org_id, user_id, profile_id)
    except Exception:
        return None
