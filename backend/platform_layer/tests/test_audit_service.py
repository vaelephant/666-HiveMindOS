"""Tests for audit_service."""

from __future__ import annotations

from datetime import datetime, timezone
from unittest.mock import MagicMock, patch

import platform_layer.audit_service as audit_service


def test_log_event_returns_id():
    mock_conn = MagicMock()
    mock_conn.execute.return_value.fetchone.return_value = (42,)

    with patch("platform_layer.audit_service.pg_conn") as pg:
        pg.return_value.__enter__.return_value = mock_conn
        event_id = audit_service.log_event(
            "demo",
            category="task",
            action="task.llm_generate",
            user_id="u1",
            summary="生成销售方案",
        )
    assert event_id == 42
    mock_conn.commit.assert_called_once()


def test_log_event_swallows_db_errors():
    with patch("platform_layer.audit_service.pg_conn") as pg:
        pg.return_value.__enter__.side_effect = RuntimeError("db down")
        event_id = audit_service.log_event(
            "demo",
            category="task",
            action="task.test",
        )
    assert event_id is None


def test_list_events_shapes_response():
    created = datetime(2026, 6, 13, 10, 0, tzinfo=timezone.utc)
    row = (
        1, "demo", "u1", "wiki", "wiki.compile",
        "candidate", "7", "success", "编译进 Wiki: decisions/foo.md",
        {"wiki_path": "decisions/foo.md"}, created,
    )
    mock_conn = MagicMock()
    mock_conn.execute.return_value.fetchall.return_value = [row]

    with patch("platform_layer.audit_service.pg_conn") as pg:
        pg.return_value.__enter__.return_value = mock_conn
        events = audit_service.list_events("demo", days=7)

    assert len(events) == 1
    assert events[0]["action"] == "wiki.compile"
    assert events[0]["detail"]["wiki_path"] == "decisions/foo.md"


def test_get_stats_aggregates():
    mock_conn = MagicMock()
    mock_conn.execute.side_effect = [
        MagicMock(fetchone=MagicMock(return_value=(5,))),
        MagicMock(fetchall=MagicMock(return_value=[("task", 3), ("wiki", 2)])),
        MagicMock(fetchall=MagicMock(return_value=[("success", 5)])),
        MagicMock(fetchall=MagicMock(return_value=[("task.llm_generate", 2)])),
    ]

    with patch("platform_layer.audit_service.pg_conn") as pg:
        pg.return_value.__enter__.return_value = mock_conn
        stats = audit_service.get_stats("demo", days=30)

    assert stats["total"] == 5
    assert stats["by_category"][0]["category"] == "task"
