"""全链路审计日志 — 任务、Wiki、候选池、对外通信、自动化。"""

from __future__ import annotations

import json
from datetime import datetime, timedelta, timezone
from typing import Any

from shared.db.postgres import pg_conn
from server.logging_config import get_logger

log = get_logger("hivemind.audit")

_CATEGORIES = frozenset({
    "task", "wiki", "candidate", "communicate", "automation", "lint", "deliverable",
})
_STATUSES = frozenset({"success", "error", "pending", "skipped"})


def log_event(
    org_id: str,
    *,
    category: str,
    action: str,
    user_id: str | None = None,
    resource_type: str | None = None,
    resource_id: str | None = None,
    status: str = "success",
    summary: str | None = None,
    detail: dict[str, Any] | None = None,
) -> int | None:
    """写入一条审计事件；失败时只打日志，不阻断主流程。"""
    if category not in _CATEGORIES:
        category = "task"
    if status not in _STATUSES:
        status = "success"
    try:
        with pg_conn() as conn:
            row = conn.execute(
                """
                INSERT INTO audit_events (
                    org_id, user_id, category, action,
                    resource_type, resource_id, status, summary, detail
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s::jsonb)
                RETURNING id
                """,
                (
                    org_id,
                    user_id,
                    category,
                    action,
                    resource_type,
                    resource_id,
                    status,
                    summary,
                    json.dumps(detail or {}, ensure_ascii=False),
                ),
            ).fetchone()
            conn.commit()
            event_id = int(row[0]) if row else None
            log.debug(
                "[audit] %s.%s org=%s status=%s id=%s",
                category, action, org_id, status, event_id,
            )
            return event_id
    except Exception as exc:
        log.warning("[audit] log_event failed: %s", exc)
        return None


def list_events(
    org_id: str,
    *,
    user_id: str | None = None,
    category: str | None = None,
    action: str | None = None,
    status: str | None = None,
    q: str | None = None,
    days: int = 30,
    limit: int = 100,
    offset: int = 0,
) -> list[dict]:
    days = max(1, min(days, 365))
    limit = max(1, min(limit, 500))
    offset = max(0, offset)
    since = datetime.now(timezone.utc) - timedelta(days=days)

    clauses = ["org_id = %s", "created_at >= %s"]
    params: list[Any] = [org_id, since]
    if user_id:
        clauses.append("user_id = %s")
        params.append(user_id)
    if category:
        clauses.append("category = %s")
        params.append(category)
    if action:
        clauses.append("action = %s")
        params.append(action)
    if status and status in _STATUSES:
        clauses.append("status = %s")
        params.append(status)
    if q and q.strip():
        pattern = f"%{q.strip()}%"
        clauses.append(
            "(summary ILIKE %s OR action ILIKE %s OR resource_id ILIKE %s "
            "OR detail::text ILIKE %s)"
        )
        params.extend([pattern, pattern, pattern, pattern])

    where = " AND ".join(clauses)
    params.extend([limit, offset])

    with pg_conn() as conn:
        rows = conn.execute(
            f"""
            SELECT id, org_id, user_id, category, action,
                   resource_type, resource_id, status, summary, detail, created_at
            FROM audit_events
            WHERE {where}
            ORDER BY created_at DESC
            LIMIT %s OFFSET %s
            """,
            params,
        ).fetchall()

    return [_row_to_dict(r) for r in rows]


def export_events(
    org_id: str,
    *,
    user_id: str | None = None,
    category: str | None = None,
    action: str | None = None,
    status: str | None = None,
    q: str | None = None,
    days: int = 30,
    limit: int = 5000,
) -> list[dict]:
    return list_events(
        org_id,
        user_id=user_id,
        category=category,
        action=action,
        status=status,
        q=q,
        days=days,
        limit=min(limit, 5000),
        offset=0,
    )


def get_stats(org_id: str, *, user_id: str | None = None, days: int = 30) -> dict:
    days = max(1, min(days, 365))
    since = datetime.now(timezone.utc) - timedelta(days=days)

    clauses = ["org_id = %s", "created_at >= %s"]
    params: list[Any] = [org_id, since]
    if user_id:
        clauses.append("user_id = %s")
        params.append(user_id)
    where = " AND ".join(clauses)

    with pg_conn() as conn:
        total = conn.execute(
            f"SELECT COUNT(*) FROM audit_events WHERE {where}",
            params,
        ).fetchone()[0]

        by_category = conn.execute(
            f"""
            SELECT category, COUNT(*)
            FROM audit_events WHERE {where}
            GROUP BY category ORDER BY COUNT(*) DESC
            """,
            params,
        ).fetchall()

        by_status = conn.execute(
            f"""
            SELECT status, COUNT(*)
            FROM audit_events WHERE {where}
            GROUP BY status ORDER BY COUNT(*) DESC
            """,
            params,
        ).fetchall()

        recent_actions = conn.execute(
            f"""
            SELECT action, COUNT(*)
            FROM audit_events WHERE {where}
            GROUP BY action ORDER BY COUNT(*) DESC
            LIMIT 12
            """,
            params,
        ).fetchall()

    return {
        "period_days": days,
        "total": int(total),
        "by_category": [{"category": r[0], "count": int(r[1])} for r in by_category],
        "by_status": [{"status": r[0], "count": int(r[1])} for r in by_status],
        "top_actions": [{"action": r[0], "count": int(r[1])} for r in recent_actions],
    }


def _row_to_dict(row) -> dict:
    detail = row[9]
    if isinstance(detail, str):
        try:
            detail = json.loads(detail)
        except json.JSONDecodeError:
            detail = {}
    created = row[10]
    return {
        "id": int(row[0]),
        "org_id": row[1],
        "user_id": row[2],
        "category": row[3],
        "action": row[4],
        "resource_type": row[5],
        "resource_id": row[6],
        "status": row[7],
        "summary": row[8],
        "detail": detail or {},
        "created_at": created.isoformat() if hasattr(created, "isoformat") else str(created),
    }
