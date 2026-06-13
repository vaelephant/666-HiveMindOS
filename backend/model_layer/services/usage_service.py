"""Persist and query LLM token usage per org / user."""

from __future__ import annotations

from datetime import date, datetime, timedelta, timezone
from zoneinfo import ZoneInfo

from shared.db.postgres import pg_conn
from model_layer.pricing import estimate_buckets_cost, estimate_cost_usd
from model_layer.usage import UsageRecord, register_usage_callback

_USAGE_TZ = "Asia/Shanghai"
_HOURS = list(range(24))


def _persist_usage(record: UsageRecord) -> None:
    if record.org_id == "unknown":
        return
    with pg_conn() as conn:
        conn.execute(
            """
            INSERT INTO llm_usage_events (
                org_id, user_id, provider, model, profile_id, operation,
                source, source_id, prompt_tokens, completion_tokens, total_tokens,
                cached_prompt_tokens, cache_creation_tokens
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
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
                record.usage.cached_prompt_tokens,
                record.usage.cache_creation_tokens,
            ),
        )
        conn.commit()


def init_usage_tracking() -> None:
    register_usage_callback(_persist_usage)


def _fill_hourly_buckets(rows: list) -> list[dict]:
    """补全 0~23 时，缺失时段填 0。"""
    by_hour: dict[int, dict] = {
        int(row[0]): {
            "hour": int(row[0]),
            "total_tokens": int(row[1]),
            "prompt_tokens": int(row[2]),
            "completion_tokens": int(row[3]),
            "request_count": int(row[4]),
        }
        for row in rows
    }
    return [
        by_hour.get(
            h,
            {
                "hour": h,
                "total_tokens": 0,
                "prompt_tokens": 0,
                "completion_tokens": 0,
                "request_count": 0,
            },
        )
        for h in _HOURS
    ]


def _period_start_utc(days: int) -> tuple[datetime, date, date]:
    """统计窗口：近 N 个自然日（按 _USAGE_TZ），返回 since(UTC)、start_date、end_date。"""
    tz = ZoneInfo(_USAGE_TZ)
    end_local = datetime.now(tz).date()
    start_local = end_local - timedelta(days=days - 1)
    since_local = datetime.combine(start_local, datetime.min.time()).replace(tzinfo=tz)
    return since_local.astimezone(timezone.utc), start_local, end_local


def _fill_daily_buckets(start: date, end: date, rows: list) -> list[dict]:
    """补全日期序列，缺失日填 0。"""
    by_date: dict[str, dict] = {
        (row[0].isoformat() if hasattr(row[0], "isoformat") else str(row[0])): {
            "date": row[0].isoformat() if hasattr(row[0], "isoformat") else str(row[0]),
            "total_tokens": int(row[1]),
            "prompt_tokens": int(row[2]),
            "completion_tokens": int(row[3]),
            "request_count": int(row[4]),
        }
        for row in rows
    }
    out: list[dict] = []
    current = start
    while current <= end:
        key = current.isoformat()
        out.append(
            by_date.get(
                key,
                {
                    "date": key,
                    "total_tokens": 0,
                    "prompt_tokens": 0,
                    "completion_tokens": 0,
                    "request_count": 0,
                },
            )
        )
        current += timedelta(days=1)
    return out


_BY_MODEL_SQL = """
    SELECT
        model,
        provider,
        COALESCE(SUM(total_tokens), 0),
        COALESCE(SUM(prompt_tokens), 0),
        COALESCE(SUM(completion_tokens), 0),
        COUNT(*),
        COALESCE(SUM(cached_prompt_tokens), 0),
        COALESCE(SUM(cache_creation_tokens), 0)
    FROM llm_usage_events
    WHERE org_id = %s AND user_id = %s AND created_at >= %s
    GROUP BY model, provider
    ORDER BY COALESCE(SUM(total_tokens), 0) DESC
"""


def _build_model_buckets(rows: list) -> list[dict]:
    return [
        {
            "model": row[0],
            "provider": row[1],
            "total_tokens": int(row[2]),
            "prompt_tokens": int(row[3]),
            "completion_tokens": int(row[4]),
            "request_count": int(row[5]),
            "cached_prompt_tokens": int(row[6]),
            "cache_creation_tokens": int(row[7]),
            "estimated_cost_usd": estimate_cost_usd(
                model=row[0],
                prompt_tokens=int(row[3]),
                completion_tokens=int(row[4]),
                cached_prompt_tokens=int(row[6]),
                cache_creation_tokens=int(row[7]),
            ),
        }
        for row in rows
    ]


def _summarize_model_buckets(buckets: list[dict]) -> dict:
    prompt = sum(b["prompt_tokens"] for b in buckets)
    cached = sum(b["cached_prompt_tokens"] for b in buckets)
    cache_hit_rate = round(cached / prompt, 4) if prompt > 0 else None
    return {
        "total_tokens": sum(b["total_tokens"] for b in buckets),
        "prompt_tokens": prompt,
        "completion_tokens": sum(b["completion_tokens"] for b in buckets),
        "request_count": sum(b["request_count"] for b in buckets),
        "cached_prompt_tokens": cached,
        "cache_creation_tokens": sum(b["cache_creation_tokens"] for b in buckets),
        "cache_hit_rate": cache_hit_rate,
        "estimated_cost_usd": estimate_buckets_cost(buckets) if buckets else 0.0,
    }


def get_user_usage_stats(org_id: str, user_id: str, days: int = 30) -> dict:
    days = max(1, min(days, 365))
    since, start_date, end_date = _period_start_utc(days)
    today_since, _, _ = _period_start_utc(1)

    with pg_conn() as conn:
        summary_row = conn.execute(
            """
            SELECT
                COALESCE(SUM(total_tokens), 0),
                COALESCE(SUM(prompt_tokens), 0),
                COALESCE(SUM(completion_tokens), 0),
                COUNT(*),
                COALESCE(SUM(cached_prompt_tokens), 0),
                COALESCE(SUM(cache_creation_tokens), 0)
            FROM llm_usage_events
            WHERE org_id = %s AND user_id = %s AND created_at >= %s
            """,
            (org_id, user_id, since),
        ).fetchone()

        by_day = conn.execute(
            """
            SELECT
                DATE(created_at AT TIME ZONE %s) AS day,
                COALESCE(SUM(total_tokens), 0),
                COALESCE(SUM(prompt_tokens), 0),
                COALESCE(SUM(completion_tokens), 0),
                COUNT(*)
            FROM llm_usage_events
            WHERE org_id = %s AND user_id = %s AND created_at >= %s
            GROUP BY day
            ORDER BY day ASC
            """,
            (_USAGE_TZ, org_id, user_id, since),
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
            _BY_MODEL_SQL,
            (org_id, user_id, since),
        ).fetchall()

        if days == 1:
            today_by_model = by_model
        else:
            today_by_model = conn.execute(
                _BY_MODEL_SQL,
                (org_id, user_id, today_since),
            ).fetchall()

        by_operation = conn.execute(
            """
            SELECT
                operation,
                COALESCE(SUM(total_tokens), 0),
                COALESCE(SUM(prompt_tokens), 0),
                COALESCE(SUM(completion_tokens), 0),
                COUNT(*)
            FROM llm_usage_events
            WHERE org_id = %s AND user_id = %s AND created_at >= %s
            GROUP BY operation
            ORDER BY COALESCE(SUM(total_tokens), 0) DESC
            """,
            (org_id, user_id, since),
        ).fetchall()

        by_profile = conn.execute(
            """
            SELECT
                COALESCE(profile_id, 'unknown') AS profile_id,
                COALESCE(SUM(total_tokens), 0),
                COALESCE(SUM(prompt_tokens), 0),
                COALESCE(SUM(completion_tokens), 0),
                COUNT(*)
            FROM llm_usage_events
            WHERE org_id = %s AND user_id = %s AND created_at >= %s
            GROUP BY profile_id
            ORDER BY COALESCE(SUM(total_tokens), 0) DESC
            """,
            (org_id, user_id, since),
        ).fetchall()

        by_provider = conn.execute(
            """
            SELECT
                provider,
                COALESCE(SUM(total_tokens), 0),
                COALESCE(SUM(prompt_tokens), 0),
                COALESCE(SUM(completion_tokens), 0),
                COUNT(*)
            FROM llm_usage_events
            WHERE org_id = %s AND user_id = %s AND created_at >= %s
            GROUP BY provider
            ORDER BY COALESCE(SUM(total_tokens), 0) DESC
            """,
            (org_id, user_id, since),
        ).fetchall()

        by_hour = conn.execute(
            """
            SELECT
                EXTRACT(HOUR FROM created_at AT TIME ZONE %s)::int AS hour,
                COALESCE(SUM(total_tokens), 0),
                COALESCE(SUM(prompt_tokens), 0),
                COALESCE(SUM(completion_tokens), 0),
                COUNT(*)
            FROM llm_usage_events
            WHERE org_id = %s AND user_id = %s AND created_at >= %s
            GROUP BY hour
            ORDER BY hour ASC
            """,
            (_USAGE_TZ, org_id, user_id, since),
        ).fetchall()

    total, prompt, completion, request_count, cached, cache_creation = summary_row or (0, 0, 0, 0, 0, 0)
    prompt_i = int(prompt)
    cached_i = int(cached)
    cache_hit_rate = round(cached_i / prompt_i, 4) if prompt_i > 0 else None

    by_model_list = _build_model_buckets(by_model)
    today_by_model_list = _build_model_buckets(today_by_model)
    estimated_cost_usd = estimate_buckets_cost(by_model_list) if by_model_list else 0.0
    today_summary = _summarize_model_buckets(today_by_model_list)

    return {
        "period_days": days,
        "timezone": _USAGE_TZ,
        "currency": "USD",
        "summary": {
            "total_tokens": int(total),
            "prompt_tokens": prompt_i,
            "completion_tokens": int(completion),
            "request_count": int(request_count),
            "cached_prompt_tokens": cached_i,
            "cache_creation_tokens": int(cache_creation),
            "cache_hit_rate": cache_hit_rate,
            "estimated_cost_usd": estimated_cost_usd,
        },
        "today_summary": today_summary,
        "by_day": _fill_daily_buckets(start_date, end_date, by_day),
        "by_hour": _fill_hourly_buckets(by_hour),
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
        "by_model": by_model_list,
        "today_by_model": today_by_model_list,
        "by_operation": [
            {
                "operation": row[0],
                "total_tokens": int(row[1]),
                "prompt_tokens": int(row[2]),
                "completion_tokens": int(row[3]),
                "request_count": int(row[4]),
            }
            for row in by_operation
        ],
        "by_profile": [
            {
                "profile_id": row[0],
                "total_tokens": int(row[1]),
                "prompt_tokens": int(row[2]),
                "completion_tokens": int(row[3]),
                "request_count": int(row[4]),
            }
            for row in by_profile
        ],
        "by_provider": [
            {
                "provider": row[0],
                "total_tokens": int(row[1]),
                "prompt_tokens": int(row[2]),
                "completion_tokens": int(row[3]),
                "request_count": int(row[4]),
            }
            for row in by_provider
        ],
    }
