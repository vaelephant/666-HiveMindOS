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

    summary = (1500, 900, 600, 12, 450, 80)
    by_day = [
        (datetime(2026, 6, 1).date(), 800, 500, 300, 5),
        (datetime(2026, 6, 2).date(), 700, 400, 300, 7),
    ]
    by_source = [("chat", 1200, 700, 500, 10), ("memory", 300, 200, 100, 2)]
    by_model = [("gpt-4o", "openai", 1500, 900, 600, 12, 450, 80)]
    by_operation = [("chat", 1200, 700, 500, 10)]
    by_profile = [("default", 1500, 900, 600, 12)]
    by_provider = [("openai", 1500, 900, 600, 12)]
    by_hour = [(9, 400, 250, 150, 3), (14, 600, 350, 250, 5), (20, 500, 300, 200, 4)]

    mock_conn = MagicMock()
    mock_conn.execute.side_effect = [
        MagicMock(fetchone=MagicMock(return_value=summary)),
        MagicMock(fetchall=MagicMock(return_value=by_day)),
        MagicMock(fetchall=MagicMock(return_value=by_source)),
        MagicMock(fetchall=MagicMock(return_value=by_model)),
        MagicMock(fetchall=MagicMock(return_value=by_operation)),
        MagicMock(fetchall=MagicMock(return_value=by_profile)),
        MagicMock(fetchall=MagicMock(return_value=by_provider)),
        MagicMock(fetchall=MagicMock(return_value=by_hour)),
    ]

    with patch("memory_layer.knowledge_base.core.services.usage_service.pg_conn") as pg:
        pg.return_value.__enter__.return_value = mock_conn
        result = usage_service.get_user_usage_stats("org-1", "user-1", days=30)

    assert result["period_days"] == 30
    assert result["summary"]["total_tokens"] == 1500
    assert result["summary"]["request_count"] == 12
    assert result["summary"]["cached_prompt_tokens"] == 450
    assert result["summary"]["cache_hit_rate"] == round(450 / 900, 4)
    assert len(result["by_day"]) == 30
    assert sum(d["total_tokens"] for d in result["by_day"]) == 1500
    assert result["by_source"][0]["source"] == "chat"
    assert result["by_model"][0]["model"] == "gpt-4o"
    assert result["by_operation"][0]["operation"] == "chat"
    assert result["by_profile"][0]["profile_id"] == "default"
    assert len(result["by_hour"]) == 24
    assert result["by_hour"][9]["total_tokens"] == 400
    assert result["by_hour"][0]["total_tokens"] == 0
    assert result["timezone"] == "Asia/Shanghai"
    assert result["currency"] == "USD"
    assert result["summary"]["estimated_cost_usd"] > 0
    assert result["by_model"][0]["estimated_cost_usd"] > 0


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
