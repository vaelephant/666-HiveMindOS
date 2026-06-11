"""Persist and query LLM token usage per org / user."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

from memory_layer.knowledge_base.core.db.postgres import pg_conn
from model_layer.usage import UsageRecord, register_usage_callback


def _persist_usage(record: UsageRecord) -> None:
    if record.org_id == "unknown":
        return
    with pg_conn() as conn:
        conn.execute(
            """
            INSERT INTO llm_usage_events (
                org_id, user_id, provider, model, profile_id, operation,
                source, source_id, prompt_tokens, completion_tokens, total_tokens
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            """,
            (
                record.org_id,
                record.user_id,
                record.provider,
                record.model,
                record.profile_id,
                record.operation,
                record.source,
                record.source_id,
                record.usage.prompt_tokens,
                record.usage.completion_tokens,
                record.usage.total_tokens,
            ),
        )
        conn.commit()


def init_usage_tracking() -> None:
    register_usage_callback(_persist_usage)


def get_user_usage_stats(org_id: str, user_id: str, days: int = 30) -> dict:
    days = max(1, min(days, 365))
    since = datetime.now(timezone.utc) - timedelta(days=days)

    with pg_conn() as conn:
        summary_row = conn.execute(
            """
            SELECT
                COALESCE(SUM(total_tokens), 0),
                COALESCE(SUM(prompt_tokens), 0),
                COALESCE(SUM(completion_tokens), 0),
                COUNT(*)
            FROM llm_usage_events
            WHERE org_id = %s AND user_id = %s AND created_at >= %s
            """,
            (org_id, user_id, since),
        ).fetchone()

        by_day = conn.execute(
            """
            SELECT
                DATE(created_at AT TIME ZONE 'UTC') AS day,
                COALESCE(SUM(total_tokens), 0),
                COALESCE(SUM(prompt_tokens), 0),
                COALESCE(SUM(completion_tokens), 0),
                COUNT(*)
            FROM llm_usage_events
            WHERE org_id = %s AND user_id = %s AND created_at >= %s
            GROUP BY day
            ORDER BY day ASC
            """,
            (org_id, user_id, since),
        ).fetchall()

        by_source = conn.execute(
            """
            SELECT
                source,
                COALESCE(SUM(total_tokens), 0),
                COALESCE(SUM(prompt_tokens), 0),
                COALESCE(SUM(completion_tokens), 0),
                COUNT(*)
            FROM llm_usage_events
            WHERE org_id = %s AND user_id = %s AND created_at >= %s
            GROUP BY source
            ORDER BY COALESCE(SUM(total_tokens), 0) DESC
            """,
            (org_id, user_id, since),
        ).fetchall()

        by_model = conn.execute(
            """
            SELECT
                model,
                provider,
                COALESCE(SUM(total_tokens), 0),
                COALESCE(SUM(prompt_tokens), 0),
                COALESCE(SUM(completion_tokens), 0),
                COUNT(*)
            FROM llm_usage_events
            WHERE org_id = %s AND user_id = %s AND created_at >= %s
            GROUP BY model, provider
            ORDER BY COALESCE(SUM(total_tokens), 0) DESC
            """,
            (org_id, user_id, since),
        ).fetchall()

    total, prompt, completion, request_count = summary_row or (0, 0, 0, 0)

    return {
        "period_days": days,
        "summary": {
            "total_tokens": int(total),
            "prompt_tokens": int(prompt),
            "completion_tokens": int(completion),
            "request_count": int(request_count),
        },
        "by_day": [
            {
                "date": row[0].isoformat(),
                "total_tokens": int(row[1]),
                "prompt_tokens": int(row[2]),
                "completion_tokens": int(row[3]),
                "request_count": int(row[4]),
            }
            for row in by_day
        ],
        "by_source": [
            {
                "source": row[0],
                "total_tokens": int(row[1]),
                "prompt_tokens": int(row[2]),
                "completion_tokens": int(row[3]),
                "request_count": int(row[4]),
            }
            for row in by_source
        ],
        "by_model": [
            {
                "model": row[0],
                "provider": row[1],
                "total_tokens": int(row[2]),
                "prompt_tokens": int(row[3]),
                "completion_tokens": int(row[4]),
                "request_count": int(row[5]),
            }
            for row in by_model
        ],
    }
