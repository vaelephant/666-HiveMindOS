from fastapi import APIRouter, BackgroundTasks, HTTPException
from pydantic import BaseModel

from memory_layer.knowledge_base.app.logging_config import get_logger
from memory_layer.knowledge_base.core.services import chat_service
from memory_layer.knowledge_base.core.services.memory_service import extract_from_turn

router = APIRouter()
log = get_logger("hivemind.chat")


class SendMessageRequest(BaseModel):
    message: str
    session_id: str | None = None
    user_id: str = "demo"


@router.get("/orgs/{org_id}/chat/sessions")
def list_sessions(org_id: str, user_id: str = "demo"):
    try:
        sessions = chat_service.list_sessions(org_id, user_id)
        return {"sessions": sessions}
    except Exception as exc:
        log.error("[chat] list sessions failed: %s", exc)
        raise HTTPException(status_code=503, detail=f"数据库不可用: {exc}") from exc


@router.get("/orgs/{org_id}/chat/sessions/{session_id}")
def get_session(org_id: str, session_id: str):
    try:
        session = chat_service.get_session(org_id, session_id)
    except Exception as exc:
        log.error("[chat] get session failed: %s", exc)
        raise HTTPException(status_code=503, detail=f"数据库不可用: {exc}") from exc
    if not session:
        raise HTTPException(status_code=404, detail="对话不存在")
    return session


@router.delete("/orgs/{org_id}/chat/sessions/{session_id}")
def delete_session(org_id: str, session_id: str):
    try:
        ok = chat_service.delete_session(org_id, session_id)
    except Exception as exc:
        log.error("[chat] delete session failed: %s", exc)
        raise HTTPException(status_code=503, detail=f"数据库不可用: {exc}") from exc
    if not ok:
        raise HTTPException(status_code=404, detail="对话不存在")
    return {"deleted": session_id}


@router.post("/orgs/{org_id}/chat")
def send_message(org_id: str, req: SendMessageRequest, background_tasks: BackgroundTasks):
    """
    发送消息（完整管线在 FastAPI 内）：
    保存用户消息 → 模型推理 → 保存回答 → 异步记忆提取
    """
    try:
        result = chat_service.send_message(
            org_id,
            req.message,
            session_id=req.session_id,
            user_id=req.user_id,
        )
        # 核心：异步智慧提取 — 驱动「智慧进化」，不阻塞回答
        background_tasks.add_task(
            extract_from_turn,
            org_id,
            req.user_id,
            result["session_id"],
            req.message,
            result["answer"],
        )
        return result
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        log.error("[chat] send failed: %s", exc)
        raise HTTPException(status_code=503, detail=f"聊天服务不可用: {exc}") from exc
