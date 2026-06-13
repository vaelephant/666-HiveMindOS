"""WeChat Work inbound webhook — URL verify and message callback."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException, Query, Request
from fastapi.responses import PlainTextResponse

from integrations.wechat_work.adapter import WeChatWorkAdapter
from integrations.wechat_work.client import WeChatWorkClient
from integrations.wechat_work.config import ERROR_REPLY, UNSUPPORTED_MSG_REPLY
from integrations.wechat_work.registry import WeChatWorkRegistry
from integrations.wechat_work.webhook_handler import (
    decrypt_post_body,
    parse_inbound_event,
    verify_url,
)
from server.logging_config import get_logger

router = APIRouter()
log = get_logger("hivemind.webhook.wechat_work")

_registry = WeChatWorkRegistry()
_adapter = WeChatWorkAdapter(wx_registry=_registry)


def _require_enabled_config(org_id: str):
    cfg = _registry.get_org_config(org_id)
    if not cfg or not cfg.enabled:
        raise HTTPException(status_code=404, detail="WeChat Work integration not configured")
    return cfg


@router.get("/webhooks/wechat-work/{org_id}")
def wechat_work_verify(
    org_id: str,
    msg_signature: str = Query(..., alias="msg_signature"),
    timestamp: str = Query(...),
    nonce: str = Query(...),
    echostr: str = Query(...),
):
    cfg = _require_enabled_config(org_id)
    try:
        plain = verify_url(
            msg_signature, timestamp, nonce, echostr,
            cfg.token, cfg.encoding_aes_key, cfg.corp_id,
        )
    except ValueError as exc:
        log.warning("[wechat] URL verify failed org=%s: %s", org_id, exc)
        raise HTTPException(status_code=403, detail="signature verification failed") from exc
    return PlainTextResponse(content=plain)


@router.post("/webhooks/wechat-work/{org_id}")
async def wechat_work_callback(
    org_id: str,
    request: Request,
    msg_signature: str = Query(..., alias="msg_signature"),
    timestamp: str = Query(...),
    nonce: str = Query(...),
):
    cfg = _require_enabled_config(org_id)
    body = (await request.body()).decode("utf-8")

    try:
        decrypted = decrypt_post_body(
            body, msg_signature, timestamp, nonce,
            cfg.token, cfg.encoding_aes_key, cfg.corp_id,
        )
    except ValueError as exc:
        log.warning("[wechat] decrypt failed org=%s: %s", org_id, exc)
        raise HTTPException(status_code=403, detail="signature verification failed") from exc

    event = parse_inbound_event(decrypted)
    if not event or not event.from_user:
        return PlainTextResponse(content="success")

    client = WeChatWorkClient(cfg.corp_id, cfg.secret)

    if event.msg_type != "text":
        reply = UNSUPPORTED_MSG_REPLY
    else:
        try:
            reply = _adapter.handle_inbound_text(org_id, event.from_user, event.content)
        except Exception as exc:
            log.error("[wechat] handle inbound failed org=%s user=%s: %s", org_id, event.from_user, exc)
            reply = ERROR_REPLY

    try:
        client.send_text(cfg.agent_id, event.from_user, reply)
    except Exception as exc:
        log.error("[wechat] send reply failed org=%s user=%s: %s", org_id, event.from_user, exc)

    return PlainTextResponse(content="success")
