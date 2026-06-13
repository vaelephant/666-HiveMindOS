from dataclasses import asdict

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

from server.logging_config import get_logger
from memory_layer.core.registry.memory_registry import MemoryRegistry
from memory_layer.core.services.memory_service import (
    recap_idle_sessions,
    recap_session,
    sync_vectors,
)

router = APIRouter()
log = get_logger("hivemind.memories")
_registry = MemoryRegistry()


@router.get("/orgs/{org_id}/memories")
def list_memories(
    org_id: str,
    user_id: str = "demo",
    source_type: str | None = Query(default=None, description="chat | ingest"),
):
    """列出结构化长期记忆。"""
    try:
        items = _registry.list_active(org_id, user_id, source_type=source_type)
        return {"memories": [asdict(m) for m in items]}
    except Exception as exc:
        log.error("[memory] list failed: %s", exc)
        raise HTTPException(status_code=503, detail=f"数据库不可用: {exc}") from exc


@router.get("/orgs/{org_id}/memories/events")
def list_memory_events(
    org_id: str,
    user_id: str = "demo",
    limit: int = Query(default=50, ge=1, le=200),
):
    """记忆进化时间线（created / updated 等事件）。"""
    try:
        items = _registry.list_events(org_id, user_id, limit=limit)
        return {"events": [asdict(e) for e in items]}
    except Exception as exc:
        log.error("[memory] events failed: %s", exc)
        raise HTTPException(status_code=503, detail=f"数据库不可用: {exc}") from exc


@router.get("/orgs/{org_id}/memories/stats")
def memory_stats(org_id: str, user_id: str = "demo"):
    """记忆统计（总数、分类、本周新增）。"""
    try:
        stats = _registry.get_stats(org_id, user_id)
        return {"stats": asdict(stats)}
    except Exception as exc:
        log.error("[memory] stats failed: %s", exc)
        raise HTTPException(status_code=503, detail=f"数据库不可用: {exc}") from exc


class RecapSessionRequest(BaseModel):
    session_id: str
    user_id: str = "demo"


class RecapBatchRequest(BaseModel):
    user_id: str = "demo"
    idle_hours: int = 24
    limit: int = 10


@router.post("/orgs/{org_id}/memories/recap-session")
def recap_chat_session(
    org_id: str,
    req: RecapSessionRequest,
    force: bool = Query(False, description="忽略 recapped_at，强制重新复盘"),
):
    """第二级提炼：对指定 Chat 会话做复盘（合并、去重、冲突、Wiki 建议）。"""
    try:
        result = recap_session(org_id, req.user_id, req.session_id, force=force)
        return {
            "recap": {
                "session_id": result.session_id,
                "summary": result.summary,
                "memory_ids": result.memory_ids,
                "archived_ids": result.archived_ids,
                "conflicts": [asdict(c) for c in result.conflicts],
                "wiki_suggestions": [asdict(w) for w in result.wiki_suggestions],
            }
        }
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except Exception as exc:
        log.error("[memory] recap-session failed: %s", exc)
        raise HTTPException(status_code=503, detail=f"会话复盘失败: {exc}") from exc


@router.post("/orgs/{org_id}/memories/recap-batch")
def recap_sessions_batch(org_id: str, req: RecapBatchRequest):
    """定时/手动：批量会话复盘（默认最近 limit 个活跃会话）。"""
    try:
        results = recap_idle_sessions(
            org_id, req.user_id, idle_hours=req.idle_hours, limit=req.limit,
        )
        return {
            "recaps": [
                {
                    "session_id": r.session_id,
                    "summary": r.summary,
                    "memory_ids": r.memory_ids,
                    "archived_ids": r.archived_ids,
                    "conflicts": [asdict(c) for c in r.conflicts],
                    "wiki_suggestions": [asdict(w) for w in r.wiki_suggestions],
                }
                for r in results
            ]
        }
    except Exception as exc:
        log.error("[memory] recap-batch failed: %s", exc)
        raise HTTPException(status_code=503, detail=f"批量复盘失败: {exc}") from exc


@router.post("/orgs/{org_id}/memories/sync-vectors")
def sync_memory_vectors(org_id: str, user_id: str = "demo"):
    """将 PostgreSQL 中的活跃智慧同步到 Qdrant（初始化或修复索引）。"""
    try:
        result = sync_vectors(org_id, user_id)
        if not result.get("available"):
            raise HTTPException(
                status_code=503,
                detail="Qdrant 或 Embedding 服务不可用，请检查 QDRANT_URL 与 OPENAI_API_KEY",
            )
        return result
    except HTTPException:
        raise
    except Exception as exc:
        log.error("[memory] sync-vectors failed: %s", exc)
        raise HTTPException(status_code=503, detail=f"向量同步失败: {exc}") from exc
