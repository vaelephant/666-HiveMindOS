import csv
import io
import json

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import Response

from server.logging_config import get_logger
from knowledge_base.core.services import audit_service

router = APIRouter()
log = get_logger("hivemind.audit.api")


@router.get("/orgs/{org_id}/audit/events")
def list_audit_events(
    org_id: str,
    user_id: str | None = Query(None),
    category: str | None = Query(None),
    action: str | None = Query(None),
    status: str | None = Query(None, description="success | error | pending | skipped"),
    q: str | None = Query(None, description="搜索摘要、action、资源 ID、详情"),
    days: int = Query(30, ge=1, le=365),
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
):
    try:
        events = audit_service.list_events(
            org_id,
            user_id=user_id,
            category=category,
            action=action,
            status=status,
            q=q,
            days=days,
            limit=limit,
            offset=offset,
        )
        stats = audit_service.get_stats(org_id, user_id=user_id, days=days)
        return {"events": events, "stats": stats}
    except Exception as exc:
        log.error("[audit] list failed: %s", exc)
        raise HTTPException(status_code=503, detail=f"审计日志不可用: {exc}") from exc


@router.get("/orgs/{org_id}/audit/export")
def export_audit_events(
    org_id: str,
    user_id: str | None = Query(None),
    category: str | None = Query(None),
    action: str | None = Query(None),
    status: str | None = Query(None),
    q: str | None = Query(None),
    days: int = Query(30, ge=1, le=365),
    format: str = Query("csv", pattern="^(csv|json)$"),
):
    try:
        events = audit_service.export_events(
            org_id,
            user_id=user_id,
            category=category,
            action=action,
            status=status,
            q=q,
            days=days,
        )
        if format == "json":
            body = json.dumps({"events": events, "count": len(events)}, ensure_ascii=False, indent=2)
            return Response(
                content=body,
                media_type="application/json",
                headers={
                    "Content-Disposition": f'attachment; filename="audit-{org_id}-{days}d.json"',
                },
            )
        buf = io.StringIO()
        writer = csv.writer(buf)
        writer.writerow([
            "id", "created_at", "category", "action", "status",
            "summary", "resource_type", "resource_id", "user_id",
        ])
        for ev in events:
            writer.writerow([
                ev.get("id"),
                ev.get("created_at"),
                ev.get("category"),
                ev.get("action"),
                ev.get("status"),
                ev.get("summary"),
                ev.get("resource_type"),
                ev.get("resource_id"),
                ev.get("user_id"),
            ])
        return Response(
            content="\ufeff" + buf.getvalue(),
            media_type="text/csv; charset=utf-8",
            headers={
                "Content-Disposition": f'attachment; filename="audit-{org_id}-{days}d.csv"',
            },
        )
    except Exception as exc:
        log.error("[audit] export failed: %s", exc)
        raise HTTPException(status_code=503, detail=f"导出失败: {exc}") from exc


@router.get("/orgs/{org_id}/audit/stats")
def audit_stats(
    org_id: str,
    user_id: str | None = Query(None),
    days: int = Query(30, ge=1, le=365),
):
    try:
        return audit_service.get_stats(org_id, user_id=user_id, days=days)
    except Exception as exc:
        log.error("[audit] stats failed: %s", exc)
        raise HTTPException(status_code=503, detail=f"审计统计不可用: {exc}") from exc
