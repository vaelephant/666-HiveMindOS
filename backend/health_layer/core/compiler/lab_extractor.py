"""Extract structured lab observations from report text."""

from __future__ import annotations

from knowledge_base.core.parsers.llm_json import parse_json_object
from prompts import get, render
from model_layer import client as llm

_LAB = get("health.lab_extract")
_SUMMARY = get("health.summarize")


def extract_lab_observations(full_text: str) -> list[dict]:
    max_chars = _LAB.limit("content_max_chars", 16000)
    prompt = render("health.lab_extract", content=full_text[:max_chars])
    raw = llm.complete(
        prompt,
        system=_LAB.system,
        profile=_LAB.resolve_profile(),
        max_tokens=_LAB.limit("max_tokens", 4096),
    )
    data = parse_json_object(raw)
    rows = data.get("observations") or []
    return [_normalize_obs(row) for row in rows if _valid_obs(row)]


def summarize_report(full_text: str, report_subtype: str | None = None) -> str:
    max_chars = _SUMMARY.limit("content_max_chars", 12000)
    prompt = render(
        "health.summarize",
        content=full_text[:max_chars],
        report_subtype=report_subtype or "检查报告",
    )
    return llm.complete(
        prompt,
        system=_SUMMARY.system,
        profile=_SUMMARY.resolve_profile(),
        max_tokens=_SUMMARY.limit("max_tokens", 512),
    ).strip()


def _valid_obs(row: dict) -> bool:
    return bool((row.get("display_name") or "").strip())


def _normalize_obs(row: dict) -> dict:
    display_name = str(row.get("display_name", "")).strip()
    value_num = row.get("value_num")
    try:
        value_num = float(value_num) if value_num is not None else None
    except (TypeError, ValueError):
        value_num = None
    ref_low = _maybe_float(row.get("ref_low"))
    ref_high = _maybe_float(row.get("ref_high"))
    is_abnormal = row.get("is_abnormal")
    if is_abnormal is None and value_num is not None:
        if ref_low is not None and value_num < ref_low:
            is_abnormal = True
        elif ref_high is not None and value_num > ref_high:
            is_abnormal = True
        else:
            is_abnormal = False
    confidence = _maybe_float(row.get("confidence"))
    return {
        "display_name": display_name,
        "code": (row.get("code") or None),
        "value_num": value_num,
        "value_text": row.get("value_text"),
        "unit": row.get("unit"),
        "ref_low": ref_low,
        "ref_high": ref_high,
        "is_abnormal": is_abnormal,
        "confidence": confidence,
    }


def _maybe_float(value) -> float | None:
    if value is None or value == "":
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None
