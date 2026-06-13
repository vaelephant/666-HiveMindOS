"""WeChat Work integration management API."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from integrations.wechat_work.client import WeChatWorkClient
from integrations.wechat_work.registry import WeChatWorkRegistry
from server.logging_config import get_logger

router = APIRouter()
log = get_logger("hivemind.integrations.wechat_work")

_registry = WeChatWorkRegistry()


class WeChatWorkConfigRequest(BaseModel):
    corp_id: str = Field(..., min_length=1)
    agent_id: str = Field(..., min_length=1)
    secret: str = Field(..., min_length=1)
    token: str = Field(..., min_length=1)
    encoding_aes_key: str = Field(..., min_length=1)
    enabled: bool = False


class BindUserRequest(BaseModel):
    platform_user_id: str = Field(..., min_length=1)
    wechat_userid: str = Field(..., min_length=1)
    wechat_name: str | None = None


@router.get("/orgs/{org_id}/integrations/wechat-work")
def get_config(org_id: str):
    pub = _registry.get_org_config_public(org_id)
    if not pub:
        return {"configured": False}
    return {"configured": True, **pub}


@router.put("/orgs/{org_id}/integrations/wechat-work")
def upsert_config(org_id: str, body: WeChatWorkConfigRequest):
    existing = _registry.get_org_config(org_id)
    secret = body.secret.strip()
    aes_key = body.encoding_aes_key.strip()
    if existing:
        if not secret or "****" in secret:
            secret = existing.secret
        if not aes_key or "****" in aes_key:
            aes_key = existing.encoding_aes_key
    try:
        _registry.upsert_org_config(
            org_id,
            body.corp_id.strip(),
            body.agent_id.strip(),
            secret,
            body.token.strip(),
            aes_key,
            body.enabled,
        )
    except Exception as exc:
        log.error("[wechat] save config failed org=%s: %s", org_id, exc)
        raise HTTPException(status_code=503, detail=f"保存失败: {exc}") from exc
    return {"ok": True}


@router.post("/orgs/{org_id}/integrations/wechat-work/test")
def test_connection(org_id: str):
    cfg = _registry.get_org_config(org_id)
    if not cfg:
        raise HTTPException(status_code=404, detail="未配置企业微信")
    try:
        client = WeChatWorkClient(cfg.corp_id, cfg.secret)
        token = client.get_access_token()
        return {"ok": True, "token_prefix": token[:8] + "…"}
    except Exception as exc:
        log.error("[wechat] test connection failed org=%s: %s", org_id, exc)
        raise HTTPException(status_code=400, detail=f"连接失败: {exc}") from exc


@router.get("/orgs/{org_id}/integrations/wechat-work/bindings")
def list_bindings(org_id: str):
    return {"bindings": _registry.list_bindings(org_id)}


@router.post("/orgs/{org_id}/integrations/wechat-work/bindings")
def create_binding(org_id: str, body: BindUserRequest):
    try:
        binding_id = _registry.bind_user(
            org_id,
            body.platform_user_id.strip(),
            body.wechat_userid.strip(),
            (body.wechat_name or "").strip() or None,
        )
    except Exception as exc:
        log.error("[wechat] bind user failed org=%s: %s", org_id, exc)
        raise HTTPException(status_code=400, detail=f"绑定失败: {exc}") from exc
    return {"ok": True, "id": binding_id}


@router.delete("/orgs/{org_id}/integrations/wechat-work/bindings/{binding_id}")
def delete_binding(org_id: str, binding_id: int):
    if not _registry.unbind_user(org_id, binding_id):
        raise HTTPException(status_code=404, detail="绑定不存在")
    return {"ok": True}
