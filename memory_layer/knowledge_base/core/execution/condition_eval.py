"""安全子集条件求值 — 供 when 表达式使用。"""

from __future__ import annotations

import re

_CMP = re.compile(
    r"^\s*\$(\w+)\.(\w+)\s*(>=|<=|==|!=|>|<)\s*(-?\d+(?:\.\d+)?|true|false)\s*$",
    re.IGNORECASE,
)


def _coerce(value: str):
    v = value.strip().lower()
    if v == "true":
        return True
    if v == "false":
        return False
    if "." in v:
        return float(v)
    return int(v)


def eval_when(expr: str | None, checkpoints: dict) -> bool:
    if not expr:
        return True
    expr = expr.strip()
    m = _CMP.match(expr)
    if not m:
        return True
    step_id, field, op, raw_val = m.group(1), m.group(2), m.group(3), m.group(4)
    ck = checkpoints.get(step_id) or {}
    left = ck.get(field)
    if left is None:
        return False
    right = _coerce(raw_val)
    ops = {
        ">": lambda a, b: a > b,
        "<": lambda a, b: a < b,
        ">=": lambda a, b: a >= b,
        "<=": lambda a, b: a <= b,
        "==": lambda a, b: a == b,
        "!=": lambda a, b: a != b,
    }
    return ops[op](left, right)
