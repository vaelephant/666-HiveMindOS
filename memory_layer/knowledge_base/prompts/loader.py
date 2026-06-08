"""
统一提示词配置加载器。

所有 L1/L2 及 Agent 的 system / user 模板集中在 prompts.yaml，便于维护与版本对比。
"""

from __future__ import annotations

from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path
from typing import Any

import yaml

_PROMPTS_FILE = Path(__file__).parent / "prompts.yaml"


@dataclass(frozen=True)
class PromptSpec:
    key: str
    label: str
    system: str
    user_template: str | None = None
    limits: dict[str, Any] | None = None
    allowed_types: frozenset[str] | None = None
    model: str | None = None  # fast | default

    def resolve_model(self, config_module) -> str:
        if self.model == "default":
            return config_module.DEFAULT_MODEL
        return config_module.FAST_MODEL

    def limit(self, name: str, default: Any = None) -> Any:
        if not self.limits:
            return default
        return self.limits.get(name, default)


def _flatten_specs(data: dict) -> dict[str, dict]:
    """将嵌套 YAML（evolution.l1_…）展平为 dot-key → spec。"""
    flat: dict[str, dict] = {}

    def walk(prefix: str, node: dict) -> None:
        for key, value in node.items():
            if key == "meta":
                continue
            full = f"{prefix}.{key}" if prefix else key
            if isinstance(value, dict) and "system" in value:
                flat[full] = value
            elif isinstance(value, dict):
                walk(full, value)

    for section, body in data.items():
        if section == "meta":
            continue
        if isinstance(body, dict):
            walk(section, body)

    return flat


@lru_cache(maxsize=1)
def _load_raw() -> dict[str, dict]:
    text = _PROMPTS_FILE.read_text(encoding="utf-8")
    data = yaml.safe_load(text) or {}
    return _flatten_specs(data)


def reload() -> None:
    """热重载（开发调 prompt 时用）。"""
    _load_raw.cache_clear()


def get(key: str) -> PromptSpec:
    specs = _load_raw()
    if key not in specs:
        known = ", ".join(sorted(specs.keys()))
        raise KeyError(f"未知提示词 key: {key!r}，已知: {known}")
    raw = specs[key]
    allowed = raw.get("allowed_types")
    return PromptSpec(
        key=key,
        label=raw.get("label", key),
        system=(raw.get("system") or "").strip(),
        user_template=(raw.get("user_template") or "").strip() or None,
        limits=raw.get("limits"),
        allowed_types=frozenset(allowed) if allowed else None,
        model=raw.get("model"),
    )


def render(key: str, **kwargs: Any) -> str:
    spec = get(key)
    if not spec.user_template:
        raise ValueError(f"提示词 {key!r} 无 user_template")
    return spec.user_template.format(**kwargs)


def list_keys() -> list[str]:
    return sorted(_load_raw().keys())
