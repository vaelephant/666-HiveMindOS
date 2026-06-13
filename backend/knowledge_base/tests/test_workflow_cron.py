"""Workflow cron scheduling tests."""

from __future__ import annotations

from datetime import datetime
from zoneinfo import ZoneInfo

import pytest

from knowledge_base.core.domain.workflow_cron import (
    WORKFLOW_CRON_TZ,
    cron_is_due,
    next_cron_run,
    validate_cron,
)


def test_validate_cron_accepts_standard():
    validate_cron("0 2 * * *")


def test_validate_cron_rejects_garbage():
    with pytest.raises(ValueError):
        validate_cron("not a cron")


def test_next_cron_run_returns_future():
    nxt = next_cron_run("0 2 * * *")
    assert nxt is not None
    assert nxt > datetime.now(WORKFLOW_CRON_TZ)


def test_cron_is_due_within_window():
    # 02:00 slot — simulate tick at 02:00:30
    slot_time = datetime(2026, 6, 13, 2, 0, 0, tzinfo=WORKFLOW_CRON_TZ)
    tick_time = datetime(2026, 6, 13, 2, 0, 30, tzinfo=WORKFLOW_CRON_TZ)
    due, slot = cron_is_due("0 2 * * *", last_cron_slot=None, now=tick_time)
    assert due is True
    assert slot is not None
    assert slot.hour == 2


def test_cron_not_due_if_already_fired_slot():
    slot_time = datetime(2026, 6, 13, 2, 0, 0, tzinfo=WORKFLOW_CRON_TZ)
    tick_time = datetime(2026, 6, 13, 2, 0, 30, tzinfo=WORKFLOW_CRON_TZ)
    due, _ = cron_is_due("0 2 * * *", last_cron_slot=slot_time.isoformat(), now=tick_time)
    assert due is False
