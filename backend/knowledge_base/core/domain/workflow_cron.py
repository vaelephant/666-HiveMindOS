"""Cron 表达式工具 — 工作流定时调度（默认 Asia/Shanghai）。"""

from __future__ import annotations

from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

from croniter import croniter

WORKFLOW_CRON_TZ = ZoneInfo("Asia/Shanghai")
_TICK_GRACE_SECONDS = 90


def _as_local(dt: datetime) -> datetime:
    if dt.tzinfo is None:
        return dt.replace(tzinfo=WORKFLOW_CRON_TZ)
    return dt.astimezone(WORKFLOW_CRON_TZ)


def _parse_iso(value: str) -> datetime | None:
    if not value:
        return None
    try:
        text = value.strip()
        if text.endswith("Z"):
            text = text[:-1] + "+00:00"
        return _as_local(datetime.fromisoformat(text))
    except ValueError:
        return None


def validate_cron(expr: str) -> None:
    expr = (expr or "").strip()
    if not expr:
        raise ValueError("cron 表达式不能为空")
    try:
        croniter(expr, datetime.now(WORKFLOW_CRON_TZ))
    except (ValueError, KeyError) as exc:
        raise ValueError(f"无效的 cron 表达式: {expr}") from exc


def current_cron_slot(cron_expr: str, now: datetime | None = None) -> datetime | None:
    """当前时刻所属的上一个 cron 触发点（本地时区）。"""
    expr = (cron_expr or "").strip()
    if not expr:
        return None
    now = _as_local(now or datetime.now(WORKFLOW_CRON_TZ))
    try:
        return _as_local(croniter(expr, now).get_prev(datetime))
    except (ValueError, KeyError):
        return None


def next_cron_run(cron_expr: str, base: datetime | None = None) -> datetime | None:
    expr = (cron_expr or "").strip()
    if not expr:
        return None
    base = _as_local(base or datetime.now(WORKFLOW_CRON_TZ))
    try:
        return _as_local(croniter(expr, base).get_next(datetime))
    except (ValueError, KeyError):
        return None


def cron_is_due(
    cron_expr: str,
    last_cron_slot: str | None,
    now: datetime | None = None,
) -> tuple[bool, datetime | None]:
    """
    判断是否应触发 cron 运行。
    last_cron_slot：上次已执行对应的 cron 槽位 ISO 时间（存 workflows.last_cron_at）。
    """
    slot = current_cron_slot(cron_expr, now)
    if slot is None:
        return False, None

    now = _as_local(now or datetime.now(WORKFLOW_CRON_TZ))
    if (now - slot).total_seconds() > _TICK_GRACE_SECONDS:
        return False, slot

    last = _parse_iso(last_cron_slot or "")
    if last is not None and last >= slot:
        return False, slot

    return True, slot
