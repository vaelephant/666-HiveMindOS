"""Org playbook API — edit frozen Chat context."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from memory_layer.knowledge_base.app.logging_config import get_logger
from memory_layer.knowledge_base.core.services.playbook_service import (
    get_playbook,
    preview_playbook,
    reset_playbook,
    save_playbook,
)

router = APIRouter()
log = get_logger("hivemind.playbook")


class PlaybookSaveRequest(BaseModel):
    content: str = Field(..., min_length=1, max_length=8000)


class PlaybookPreviewRequest(BaseModel):
    content: str | None = Field(default=None, max_length=8000)


@router.get("/orgs/{org_id}/playbook")
def read_playbook(org_id: str):
    try:
        return get_playbook(org_id)
    except Exception as exc:
        log.error("[playbook] read failed org=%s: %s", org_id, exc)
        raise HTTPException(status_code=503, detail=str(exc)) from exc


@router.put("/orgs/{org_id}/playbook")
def write_playbook(org_id: str, body: PlaybookSaveRequest):
    try:
        return save_playbook(org_id, body.content)
    except Exception as exc:
        log.error("[playbook] save failed org=%s: %s", org_id, exc)
        raise HTTPException(status_code=503, detail=str(exc)) from exc


@router.delete("/orgs/{org_id}/playbook")
def clear_playbook_override(org_id: str):
    try:
        return reset_playbook(org_id)
    except Exception as exc:
        log.error("[playbook] reset failed org=%s: %s", org_id, exc)
        raise HTTPException(status_code=503, detail=str(exc)) from exc


@router.post("/orgs/{org_id}/playbook/preview")
def read_playbook_preview(org_id: str, body: PlaybookPreviewRequest, user_id: str = "demo"):
    try:
        return preview_playbook(org_id, user_id, body.content)
    except Exception as exc:
        log.error("[playbook] preview failed org=%s: %s", org_id, exc)
        raise HTTPException(status_code=503, detail=str(exc)) from exc
