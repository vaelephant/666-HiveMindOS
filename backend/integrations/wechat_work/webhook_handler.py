"""WeChat Work webhook verify, decrypt, and inbound event parsing."""

from __future__ import annotations

import xml.etree.ElementTree as ET
from dataclasses import dataclass

from wechatpy.enterprise.crypto import WeChatCrypto
from wechatpy.exceptions import InvalidSignatureException


@dataclass(frozen=True)
class InboundEvent:
    msg_type: str
    from_user: str
    content: str
    agent_id: str


def _crypto(token: str, encoding_aes_key: str, corp_id: str) -> WeChatCrypto:
    return WeChatCrypto(token, encoding_aes_key, corp_id)


def verify_url(
    msg_signature: str,
    timestamp: str,
    nonce: str,
    echostr: str,
    token: str,
    encoding_aes_key: str,
    corp_id: str,
) -> str:
    crypto = _crypto(token, encoding_aes_key, corp_id)
    try:
        return crypto.check_signature(msg_signature, timestamp, nonce, echostr)
    except InvalidSignatureException as exc:
        raise ValueError("invalid wechat work signature") from exc


def decrypt_post_body(
    body: str,
    msg_signature: str,
    timestamp: str,
    nonce: str,
    token: str,
    encoding_aes_key: str,
    corp_id: str,
) -> str:
    crypto = _crypto(token, encoding_aes_key, corp_id)
    try:
        return crypto.decrypt_message(body, msg_signature, timestamp, nonce)
    except InvalidSignatureException as exc:
        raise ValueError("invalid wechat work signature") from exc


def _text(el: ET.Element | None) -> str:
    return (el.text or "").strip() if el is not None else ""


def parse_inbound_event(xml: str) -> InboundEvent | None:
    root = ET.fromstring(xml)
    msg_type = _text(root.find("MsgType"))
    if msg_type != "text":
        return InboundEvent(
            msg_type=msg_type or "unknown",
            from_user=_text(root.find("FromUserName")),
            content="",
            agent_id=_text(root.find("AgentID")),
        )
    return InboundEvent(
        msg_type="text",
        from_user=_text(root.find("FromUserName")),
        content=_text(root.find("Content")),
        agent_id=_text(root.find("AgentID")),
    )
