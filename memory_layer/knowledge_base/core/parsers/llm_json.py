"""LLM 返回 JSON 的通用解析（去 markdown 围栏）。"""

from __future__ import annotations

import json
import re


def strip_json_fences(raw: str) -> str:
    return re.sub(r"^```(?:json)?\s*|\s*```$", "", raw.strip(), flags=re.MULTILINE)


def parse_json(raw: str) -> dict | list:
    return json.loads(strip_json_fences(raw))


def parse_json_object(raw: str) -> dict:
    data = parse_json(raw)
    if not isinstance(data, dict):
        raise ValueError("expected JSON object")
    return data
