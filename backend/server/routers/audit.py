from fastapi import APIRouter, HTTPException, Query

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
            days=days,
            limit=limit,
            offset=offset,
        )
        stats = audit_service.get_stats(org_id, user_id=user_id, days=days)
        return {"events": events, "stats": stats}
    except Exception as exc:
        log.error("[audit] list failed: %s", exc)
        raise HTTPException(status_code=503, detail=f"审计日志不可用: {exc}") from exc


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
