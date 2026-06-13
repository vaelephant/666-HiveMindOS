import json

from dataclasses import asdict

from fastapi import APIRouter, BackgroundTasks, HTTPException, Query, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from server.logging_config import get_logger
from chat_layer.core.services import chat_service
from chat_layer.core.services.chat_preferences_service import (
    clear_user_starters,
    get_chat_starters,
    save_user_starters,
)
from memory_layer.core.services.memory_service import extract_from_turn, recap_session
from chat_layer.core.services.pipeline_service import get_session_pipeline

router = APIRouter()
log = get_logger("hivemind.chat")


class SendMessageRequest(BaseModel):
    message: str
    session_id: str | None = None
    user_id: str = "demo"


class ExtractTurnRequest(BaseModel):
    user_id: str = "demo"
    turn_index: int | None = None


class ChatStartersUpdate(BaseModel):
    user_id: str = "demo"
    starters: list[str]


@router.get("/orgs/{org_id}/chat/starters")
def get_starters(org_id: str, user_id: str = "demo"):
    try:
        result = get_chat_starters(org_id, user_id)
        return {
            "starters": result.starters,
            "source": result.source,
            "limits": result.limits,
        }
    except Exception as exc:
        log.error("[chat] get starters failed: %s", exc)
        raise HTTPException(status_code=503, detail=f"读取快捷问题失败: {exc}") from exc


@router.put("/orgs/{org_id}/chat/starters")
def update_starters(org_id: str, body: ChatStartersUpdate):
    try:
        result = save_user_starters(org_id, body.user_id, body.starters)
        return {
            "starters": result.starters,
            "source": result.source,
            "limits": result.limits,
        }
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        log.error("[chat] save starters failed: %s", exc)
        raise HTTPException(status_code=503, detail=f"保存快捷问题失败: {exc}") from exc


@router.delete("/orgs/{org_id}/chat/starters")
def reset_starters(org_id: str, user_id: str = "demo"):
    try:
        result = clear_user_starters(org_id, user_id)
        return {
            "starters": result.starters,
            "source": result.source,
            "limits": result.limits,
        }
    except Exception as exc:
        log.error("[chat] reset starters failed: %s", exc)
        raise HTTPException(status_code=503, detail=f"重置快捷问题失败: {exc}") from exc


@router.post("/orgs/{org_id}/chat/sessions/{session_id}/extract")
def extract_session_turn(org_id: str, session_id: str, req: ExtractTurnRequest):
    """手动触发某轮对话的智慧提炼（含写入 Wiki 候选池）。"""
    try:
        session = chat_service.get_session(org_id, session_id)
    except Exception as exc:
        log.error("[chat] extract get session failed: %s", exc)
        raise HTTPException(status_code=503, detail=f"数据库不可用: {exc}") from exc
    if not session:
        raise HTTPException(status_code=404, detail="对话不存在")
    turns = session.get("turns") or []
    if not turns:
        raise HTTPException(status_code=400, detail="对话尚无内容可提炼")
    idx = req.turn_index if req.turn_index is not None else len(turns) - 1
    if idx < 0 or idx >= len(turns):
        raise HTTPException(status_code=400, detail="turn_index 无效")
    turn = turns[idx]
    memory_ids = extract_from_turn(
        org_id,
        req.user_id,
        session_id,
        turn["question"],
        turn["answer"],
    )
    return {
        "ok": True,
        "session_id": session_id,
        "turn_index": idx,
        "memory_ids": memory_ids,
        "memory_count": len(memory_ids),
    }


@router.get("/orgs/{org_id}/chat/sessions")
def list_sessions(org_id: str, user_id: str = "demo"):
    try:
        sessions = chat_service.list_sessions(org_id, user_id)
        return {"sessions": sessions}
    except Exception as exc:
        log.error("[chat] list sessions failed: %s", exc)
        raise HTTPException(status_code=503, detail=f"数据库不可用: {exc}") from exc


@router.get("/orgs/{org_id}/chat/sessions/{session_id}/pipeline")
def session_pipeline(org_id: str, session_id: str, user_id: str = "demo"):
    """当前会话的知识管线状态（智慧提炼 / 候选池 / Wiki），供 Chat 侧栏展示。"""
    try:
        return {"pipeline": get_session_pipeline(org_id, session_id, user_id)}
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except Exception as exc:
        log.error("[chat] pipeline failed: %s", exc)
        raise HTTPException(status_code=503, detail=f"管线查询失败: {exc}") from exc


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
def delete_session(
    org_id: str,
    session_id: str,
    user_id: str = "demo",
    recap: bool = Query(False, description="删除前先做第二级会话复盘"),
):
    try:
        recap_result = None
        if recap:
            try:
                recap_result = recap_session(org_id, user_id, session_id, force=True)
            except ValueError:
                pass
        ok = chat_service.delete_session(org_id, session_id)
    except Exception as exc:
        log.error("[chat] delete session failed: %s", exc)
        raise HTTPException(status_code=503, detail=f"数据库不可用: {exc}") from exc
    if not ok:
        raise HTTPException(status_code=404, detail="对话不存在")
    out: dict = {"deleted": session_id}
    if recap_result:
        out["recap"] = {
            "session_id": recap_result.session_id,
            "summary": recap_result.summary,
            "memory_ids": recap_result.memory_ids,
            "archived_ids": recap_result.archived_ids,
            "conflicts": [asdict(c) for c in recap_result.conflicts],
            "wiki_suggestions": [
                {
                    "title": w.title,
                    "reason": w.reason,
                    "category": w.category,
                    "content_outline": w.content_outline,
                }
                for w in recap_result.wiki_suggestions
            ],
        }
    return out


@router.get("/orgs/{org_id}/chat/search")
def search_chat_history(org_id: str, q: str = Query(..., min_length=1), user_id: str = "demo"):
    """Search past chat messages (session_search)."""
    try:
        return chat_service.search_history(org_id, user_id, q)
    except Exception as exc:
        log.error("[chat] search failed: %s", exc)
        raise HTTPException(status_code=503, detail=f"搜索不可用: {exc}") from exc


@router.post("/orgs/{org_id}/chat/stream")
async def stream_message(
    org_id: str,
    req: SendMessageRequest,
    background_tasks: BackgroundTasks,
    request: Request,
):
    """SSE 流式回答：检索阶段 status → 合成阶段 token 逐字 → done（含完整 turn）。"""

    disconnected = False

    def cancel_check() -> bool:
        return disconnected

    async def event_generator():
        nonlocal disconnected
        try:
            for line in chat_service.send_message_stream(
                org_id,
                req.message,
                session_id=req.session_id,
                user_id=req.user_id,
                cancel_check=cancel_check,
            ):
                if await request.is_disconnected():
                    disconnected = True
                    log.info("[chat] stream cancelled by client  org=%s", org_id)
                    break
                if line.startswith("data: "):
                    try:
                        payload = json.loads(line[6:].strip())
                        if payload.get("type") == "done" and not disconnected:
                            background_tasks.add_task(
                                extract_from_turn,
                                org_id,
                                req.user_id,
                                payload["session_id"],
                                req.message,
                                payload["answer"],
                            )
                    except json.JSONDecodeError:
                        pass
                yield line
        except ValueError as exc:
            err = json.dumps({"type": "error", "detail": str(exc)}, ensure_ascii=False)
            yield f"data: {err}\n\n"
        except Exception as exc:
            log.error("[chat] stream failed: %s", exc)
            err = json.dumps({"type": "error", "detail": "聊天服务不可用"}, ensure_ascii=False)
            yield f"data: {err}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


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
