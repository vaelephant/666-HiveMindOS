"""Tests for LLM usage stats service."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from unittest.mock import MagicMock, patch

import pytest

from memory_layer.knowledge_base.core.services import usage_service
from model_layer.usage import TokenUsage, UsageRecord, register_usage_callback


@pytest.fixture(autouse=True)
def _clear_callbacks():
    from model_layer import usage as usage_mod

    usage_mod._callbacks.clear()
    yield
    usage_mod._callbacks.clear()


def test_get_user_usage_stats_shapes_response():
    since = datetime.now(timezone.utc) - timedelta(days=30)
    _ = since  # reference for mock rows

    summary = (1500, 900, 600, 12)
    by_day = [
        (datetime(2026, 6, 1).date(), 800, 500, 300, 5),
        (datetime(2026, 6, 2).date(), 700, 400, 300, 7),
    ]
    by_source = [("chat", 1200, 700, 500, 10), ("memory", 300, 200, 100, 2)]
    by_model = [("gpt-4o", "openai", 1500, 900, 600, 12)]

    mock_conn = MagicMock()
    mock_conn.execute.side_effect = [
        MagicMock(fetchone=MagicMock(return_value=summary)),
        MagicMock(fetchall=MagicMock(return_value=by_day)),
        MagicMock(fetchall=MagicMock(return_value=by_source)),
        MagicMock(fetchall=MagicMock(return_value=by_model)),
    ]

    with patch("memory_layer.knowledge_base.core.services.usage_service.pg_conn") as pg:
        pg.return_value.__enter__.return_value = mock_conn
        result = usage_service.get_user_usage_stats("org-1", "user-1", days=30)

    assert result["period_days"] == 30
    assert result["summary"]["total_tokens"] == 1500
    assert result["summary"]["request_count"] == 12
    assert len(result["by_day"]) == 2
    assert result["by_source"][0]["source"] == "chat"
    assert result["by_model"][0]["model"] == "gpt-4o"


def test_persist_usage_skips_unknown_org():
    mock_conn = MagicMock()
    with patch("memory_layer.knowledge_base.core.services.usage_service.pg_conn") as pg:
        pg.return_value.__enter__.return_value = mock_conn
        usage_service._persist_usage(
            UsageRecord(
                org_id="unknown",
                user_id="u1",
                provider="openai",
                model="gpt-4o",
                profile_id="default",
                operation="chat",
                source="chat",
                source_id=None,
                usage=TokenUsage(10, 5, 15),
            )
        )
    mock_conn.execute.assert_not_called()


def test_init_registers_callback():
    usage_service.init_usage_tracking()
    from model_layer import usage as usage_mod

    assert usage_service._persist_usage in usage_mod._callbacks
