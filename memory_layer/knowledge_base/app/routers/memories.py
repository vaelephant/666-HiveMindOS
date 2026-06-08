from dataclasses import asdict

from fastapi import APIRouter, HTTPException, Query

from memory_layer.knowledge_base.app.logging_config import get_logger
from memory_layer.knowledge_base.core.registry.memory_registry import MemoryRegistry
from memory_layer.knowledge_base.core.services.memory_service import sync_vectors

router = APIRouter()
log = get_logger("hivemind.memories")
_registry = MemoryRegistry()


@router.get("/orgs/{org_id}/memories")
def list_memories(org_id: str, user_id: str = "demo"):
    """列出结构化长期记忆。"""
    try:
        items = _registry.list_active(org_id, user_id)
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
