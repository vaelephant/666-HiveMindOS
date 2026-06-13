"""Agent action: send outbound WeChat Work messages (no human approval gate)."""

from __future__ import annotations

from integrations.wechat_work.client import WeChatWorkClient
from integrations.wechat_work.registry import WeChatWorkRegistry
import platform_layer.audit_service as audit_service


def send_wechat_work_message(
    org_id: str,
    to_user: str,
    content: str,
    *,
    msg_type: str = "text",
) -> dict:
    to_user = (to_user or "").strip()
    content = (content or "").strip()
    if not to_user:
        raise ValueError("to_user 不能为空")
    if not content:
        raise ValueError("content 不能为空")

    cfg = WeChatWorkRegistry().get_org_config(org_id)
    if not cfg:
        raise ValueError("未配置企业微信，请先在「集成」页面完成配置")
    if not cfg.enabled:
        raise ValueError("企业微信集成未启用")

    client = WeChatWorkClient(cfg.corp_id, cfg.secret)
    if msg_type == "markdown":
        client.send_markdown(cfg.agent_id, to_user, content)
    else:
        client.send_text(cfg.agent_id, to_user, content)

    audit_service.log_event(
        org_id,
        category="communicate",
        action="wechat.send",
        resource_type="wechat_user",
        resource_id=to_user,
        summary=f"企微消息 → {to_user}（{len(content)} 字）",
        detail={"msg_type": msg_type, "chars": len(content)},
    )

    return {
        "ok": True,
        "to_user": to_user,
        "msg_type": msg_type,
        "chars": len(content),
    }
