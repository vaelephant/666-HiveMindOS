"""Bridge WeChat Work inbound messages to ChatService."""

from __future__ import annotations

from integrations.wechat_work.config import ERROR_REPLY, UNBOUND_REPLY
from integrations.wechat_work.registry import WeChatWorkRegistry
from memory_layer.knowledge_base.core.registry.chat_registry import ChatRegistry
from memory_layer.knowledge_base.core.services import chat_service


class WeChatWorkAdapter:
    def __init__(
        self,
        wx_registry: WeChatWorkRegistry | None = None,
        chat_registry: ChatRegistry | None = None,
    ) -> None:
        self._wx_registry = wx_registry or WeChatWorkRegistry()
        self._chat_registry = chat_registry or ChatRegistry()

    def handle_inbound_text(self, org_id: str, wechat_userid: str, text: str) -> str:
        platform_user = self._wx_registry.resolve_platform_user_id(org_id, wechat_userid)
        if not platform_user:
            return UNBOUND_REPLY

        message = text.strip()
        if not message:
            return "消息不能为空"

        session_id = self._chat_registry.find_active_session(
            org_id,
            platform_user,
            channel="wechat_work",
            external_session_id=wechat_userid,
        )
        if not session_id:
            session_id = self._chat_registry.create_session(
                org_id,
                "",
                user_id=platform_user,
                channel="wechat_work",
                external_session_id=wechat_userid,
            )

        try:
            result = chat_service.send_message(
                org_id,
                message,
                session_id=session_id,
                user_id=platform_user,
            )
        except Exception:
            return ERROR_REPLY

        return (result.get("answer") or "").strip() or ERROR_REPLY
