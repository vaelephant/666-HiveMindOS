from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

from server.logging_config import get_logger
from knowledge_base.core.services.candidate_service import (
    approve_and_compile_candidate,
    approve_candidate,
    compile_approved_candidates,
    get_candidate_stats,
    list_candidates,
    reject_candidate,
    resolve_pending_candidates,
)

router = APIRouter()
log = get_logger("hivemind.candidates")


@router.get("/orgs/{org_id}/candidates")
def get_candidates(
    org_id: str,
    user_id: str = "demo",
    status: str | None = Query(default=None),
    limit: int = Query(default=100, ge=1, le=500),
):
    """列出知识候选（默认全部，可按 status 过滤 pending/approved/...）。"""
    try:
        items = list_candidates(org_id, user_id, status=status, limit=limit)
        return {"candidates": items}
    except Exception as exc:
        log.error("[candidate] list failed: %s", exc)
        raise HTTPException(status_code=503, detail=f"数据库不可用: {exc}") from exc


@router.get("/orgs/{org_id}/candidates/stats")
def candidate_stats(org_id: str, user_id: str = "demo"):
    """候选池统计（待审核 / 已批准 / 冲突等）。"""
    try:
        return {"stats": get_candidate_stats(org_id, user_id)}
    except Exception as exc:
        log.error("[candidate] stats failed: %s", exc)
        raise HTTPException(status_code=503, detail=f"数据库不可用: {exc}") from exc


class ResolveRequest(BaseModel):
    user_id: str = "demo"
    limit: int = 20


@router.post("/orgs/{org_id}/candidates/resolve")
def resolve_candidates(org_id: str, req: ResolveRequest):
    """
    Resolver（P0）：对 pending 候选做规则匹配，标记 approved/conflict。
    不自动写入 Wiki 文件（P1 ChatDigestCompiler）。
    """
    try:
        results = resolve_pending_candidates(org_id, req.user_id, limit=req.limit)
        return {"resolved": results, "count": len(results)}
    except Exception as exc:
        log.error("[candidate] resolve failed: %s", exc)
        raise HTTPException(status_code=503, detail=f"Resolver 失败: {exc}") from exc


class ReviewRequest(BaseModel):
    reason: str = ""
    user_id: str = "demo"


@router.post("/orgs/{org_id}/candidates/{candidate_id}/approve")
def approve(org_id: str, candidate_id: int, req: ReviewRequest):
    try:
        approve_candidate(candidate_id, org_id, note=req.reason, user_id=req.user_id)
        return {"ok": True, "candidate_id": candidate_id, "status": "approved"}
    except Exception as exc:
        log.error("[candidate] approve failed: %s", exc)
        raise HTTPException(status_code=503, detail=str(exc)) from exc


@router.post("/orgs/{org_id}/candidates/{candidate_id}/approve-and-compile")
def approve_and_compile(org_id: str, candidate_id: int, req: ReviewRequest):
    """人工批准并立即编译进 Wiki。"""
    try:
        result = approve_and_compile_candidate(
            candidate_id, org_id, note=req.reason, user_id=req.user_id,
        )
        return {"ok": True, **result}
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        log.error("[candidate] approve-and-compile failed: %s", exc)
        raise HTTPException(status_code=503, detail=str(exc)) from exc


class CompileRequest(BaseModel):
    user_id: str = "demo"
    limit: int = 20


@router.post("/orgs/{org_id}/candidates/compile")
def compile_candidates(org_id: str, req: CompileRequest):
    """
    Wiki Layer（P1）：将 approved 候选编译进 Wiki 文件，状态变为 merged。
    """
    try:
        results = compile_approved_candidates(org_id, req.user_id, limit=req.limit)
        ok = sum(1 for r in results if r.get("status") == "merged")
        return {"compiled": results, "count": ok}
    except Exception as exc:
        log.error("[candidate] compile batch failed: %s", exc)
        raise HTTPException(status_code=503, detail=f"编译失败: {exc}") from exc


@router.post("/orgs/{org_id}/candidates/{candidate_id}/reject")
def reject(org_id: str, candidate_id: int, req: ReviewRequest):
    try:
        reject_candidate(candidate_id, org_id, reason=req.reason, user_id=req.user_id)
        return {"ok": True, "candidate_id": candidate_id, "status": "rejected"}
    except Exception as exc:
        log.error("[candidate] reject failed: %s", exc)
        raise HTTPException(status_code=503, detail=str(exc)) from exc
