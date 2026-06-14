"""Classify health report as lab vs other."""

from __future__ import annotations

from knowledge_base.core.parsers.llm_json import parse_json_object
from prompts import get, render
from model_layer import client as llm

_CLASSIFY = get("health.classify")


def classify_report(full_text: str) -> dict:
    max_chars = _CLASSIFY.limit("content_max_chars", 12000)
    prompt = render("health.classify", content=full_text[:max_chars])
    raw = llm.complete(
        prompt,
        system=_CLASSIFY.system,
        profile=_CLASSIFY.resolve_profile(),
        max_tokens=_CLASSIFY.limit("max_tokens", 1024),
    )
    data = parse_json_object(raw)
    category = data.get("report_category", "other")
    if category not in ("lab", "other"):
        category = "other"
    return {
        "report_category": category,
        "report_subtype": data.get("report_subtype"),
        "report_date": data.get("report_date"),
        "institution": data.get("institution"),
        "confidence": _as_float(data.get("confidence")),
    }


def _as_float(value) -> float | None:
    if value is None:
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None
