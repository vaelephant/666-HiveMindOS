from fastapi import APIRouter, HTTPException, Query

from server.logging_config import get_logger
import model_layer.services.usage_service as usage_service

router = APIRouter()
log = get_logger("hivemind.usage")


@router.get("/orgs/{org_id}/usage/stats")
def get_usage_stats(
    org_id: str,
    user_id: str = "demo",
    days: int = Query(30, ge=1, le=365),
):
    try:
        return usage_service.get_user_usage_stats(org_id, user_id, days=days)
    except Exception as exc:
        log.error("[usage] stats failed: %s", exc)
        raise HTTPException(status_code=503, detail=f"用量统计不可用: {exc}") from exc
