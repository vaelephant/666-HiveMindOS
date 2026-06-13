"""模型 profile 注册表 — 解析 yaml + 分发 provider。"""

from __future__ import annotations

import os
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path
from typing import Any

from model_layer.providers import anthropic_provider, openai_provider
from model_layer.settings.loader import load, reload as reload_settings

# 与 knowledge_base 一致：从仓库根加载 .env
try:
    from dotenv import load_dotenv

    _root = Path(__file__).resolve().parents[2]
    load_dotenv(_root / ".env")
    load_dotenv(_root / "webui" / ".env", override=True)
except ImportError:
    pass

_CHAT_PROVIDERS = {
    "openai": openai_provider,
    "anthropic": anthropic_provider,
}

_EMBED_PROVIDERS = {
    "openai": openai_provider,
}


def _model_provider_mismatch(provider: str, model: str) -> str | None:
    name = model.lower()
    if provider == "anthropic" and (
        name.startswith("gpt-") or name.startswith("o1") or name.startswith("o3") or name.startswith("o4")
    ):
        return (
            f"profile 使用 provider=anthropic 但 model={model!r} 像 OpenAI 模型；"
            f"请改 models.yaml 的 provider 或调整 {provider} 对应的 env override"
        )
    if provider == "openai" and name.startswith("claude-"):
        return (
            f"profile 使用 provider=openai 但 model={model!r} 像 Anthropic 模型；"
            f"请改 models.yaml 的 provider 或调整 env override"
        )
    return None


@dataclass(frozen=True)
class ResolvedProfile:
    id: str
    kind: str
    provider: str
    model: str
    max_tokens: int = 8192
    dim: int | None = None


def _apply_env_override(profile_id: str, model: str, overrides: dict[str, str]) -> str:
    env_name = overrides.get(profile_id)
    if not env_name:
        return model
    override = os.environ.get(env_name, "").strip()
    return override or model


@lru_cache(maxsize=1)
def _raw_config() -> dict[str, Any]:
    return load("models")


def reload_registry() -> None:
    reload_settings()
    _raw_config.cache_clear()
    startup_report.cache_clear()


@lru_cache(maxsize=1)
def startup_report() -> list[str]:
    """启动校验：返回 warning 信息列表。"""
    warnings: list[str] = []
    cfg = _raw_config()
    providers = cfg.get("providers") or {}

    for profile_id, spec in (cfg.get("profiles") or {}).items():
        provider_name = spec.get("provider", "")
        provider = providers.get(provider_name) or {}
        env_key = provider.get("api_key_env", "")
        if (
            env_key
            and not spec.get("optional")
            and not os.environ.get(env_key, "").strip()
        ):
            warnings.append(
                f"profile {profile_id!r} 需要 provider {provider_name!r}，"
                f"但环境变量 {env_key} 未设置"
            )
        try:
            resolved = resolve(profile_id)
        except (KeyError, ValueError):
            continue
        mismatch = _model_provider_mismatch(resolved.provider, resolved.model)
        if mismatch:
            warnings.append(f"profile {profile_id!r}: {mismatch}")

    return warnings


def resolve(profile_id: str | None = None, *, kind: str | None = None) -> ResolvedProfile:
    cfg = _raw_config()
    defaults = cfg.get("defaults") or {}
    profiles = cfg.get("profiles") or {}
    overrides = cfg.get("env_overrides") or {}

    if profile_id is None:
        if kind == "embed":
            profile_id = defaults.get("embed", "embedding")
        else:
            profile_id = defaults.get("chat", "default")

    if profile_id not in profiles:
        known = ", ".join(sorted(profiles))
        raise KeyError(f"未知 model profile: {profile_id!r}，已知: {known}")

    spec = profiles[profile_id]
    resolved_kind = spec.get("kind", "chat")
    if kind and resolved_kind != kind:
        raise ValueError(
            f"profile {profile_id!r} kind={resolved_kind!r}，与期望 {kind!r} 不符"
        )

    model = _apply_env_override(profile_id, spec.get("model", ""), overrides)
    return ResolvedProfile(
        id=profile_id,
        kind=resolved_kind,
        provider=spec.get("provider", ""),
        model=model,
        max_tokens=int(spec.get("max_tokens") or 8192),
        dim=int(spec["dim"]) if spec.get("dim") is not None else None,
    )


def resolve_chat(profile_id: str | None = None) -> ResolvedProfile:
    return resolve(profile_id, kind="chat")


def resolve_embed(profile_id: str | None = None) -> ResolvedProfile:
    return resolve(profile_id, kind="embed")


def get_chat_module(provider_name: str):
    module = _CHAT_PROVIDERS.get(provider_name)
    if module is None:
        known = ", ".join(sorted(_CHAT_PROVIDERS))
        raise KeyError(f"未知 chat provider: {provider_name!r}，已知: {known}")
    return module


def get_embed_module(provider_name: str):
    module = _EMBED_PROVIDERS.get(provider_name)
    if module is None:
        known = ", ".join(sorted(_EMBED_PROVIDERS))
        raise KeyError(f"未知 embed provider: {provider_name!r}，已知: {known}")
    return module


def list_profiles() -> dict[str, ResolvedProfile]:
    cfg = _raw_config()
    return {pid: resolve(pid) for pid in (cfg.get("profiles") or {})}


def raw_config() -> dict[str, Any]:
    """只读访问 models.yaml 解析结果（供设置页 catalog 使用）。"""
    return _raw_config()
