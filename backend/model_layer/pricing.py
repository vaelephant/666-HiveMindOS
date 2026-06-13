"""Token 用量 → 估算费用（USD）。"""

from __future__ import annotations

from functools import lru_cache
from typing import Any

from model_layer.settings.loader import load


@lru_cache(maxsize=1)
def _pricing_table() -> tuple[dict[str, dict[str, float]], dict[str, float], float]:
    data = load("pricing")
    per = float(data.get("per") or 1_000_000)
    models = data.get("models") or {}
    defaults = data.get("defaults") or {}
    return models, defaults, per


def _rates_for_model(model: str) -> dict[str, float]:
    models, defaults, _ = _pricing_table()
    rates = dict(defaults)
    rates.update(models.get(model) or {})
    return rates


def estimate_cost_usd(
    *,
    model: str,
    prompt_tokens: int = 0,
    completion_tokens: int = 0,
    cached_prompt_tokens: int = 0,
    cache_creation_tokens: int = 0,
) -> float:
    rates = _rates_for_model(model)
    per = _pricing_table()[2]
    billable_prompt = max(0, prompt_tokens - cached_prompt_tokens - cache_creation_tokens)
    cost = (
        billable_prompt * rates.get("input", 0)
        + completion_tokens * rates.get("output", 0)
        + cached_prompt_tokens * rates.get("cached_input", rates.get("input", 0) * 0.1)
        + cache_creation_tokens * rates.get("cache_creation", rates.get("input", 0) * 1.25)
    ) / per
    return round(cost, 6)


def estimate_buckets_cost(rows: list[dict[str, Any]], *, model_key: str = "model") -> float:
    total = 0.0
    for row in rows:
        total += estimate_cost_usd(
            model=row.get(model_key) or "unknown",
            prompt_tokens=int(row.get("prompt_tokens") or 0),
            completion_tokens=int(row.get("completion_tokens") or 0),
            cached_prompt_tokens=int(row.get("cached_prompt_tokens") or 0),
            cache_creation_tokens=int(row.get("cache_creation_tokens") or 0),
        )
    return round(total, 4)
