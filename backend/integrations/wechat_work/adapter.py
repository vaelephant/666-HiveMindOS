"""Bridge WeChat Work inbound messages to ChatService."""

from __future__ import annotations

from integrations.gateway.base import truncate_reply
from integrations.gateway.commands import HELP_TEXT, RESET_OK, parse_slash_command
from integrations.wechat_work.config import ERROR_REPLY, MSG_MAX_BYTES, UNBOUND_REPLY
from integrations.wechat_work.registry import WeChatWorkRegistry
from chat_layer.core.registry.chat_registry import ChatRegistry
from chat_layer.core.services import chat_service


class WeChatWorkAdapter:
    """WeChat Work channel adapter — implements gateway ChannelAdapter protocol."""

    channel = "wechat_work"

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

        cmd = parse_slash_command(message)
        if cmd == "help":
            return truncate_reply(HELP_TEXT, MSG_MAX_BYTES)
        if cmd == "reset":
            return self._reset_session(org_id, platform_user, wechat_userid)

        session_id = self._chat_registry.find_active_session(
            org_id,
            platform_user,
            channel=self.channel,
            external_session_id=wechat_userid,
        )
        if not session_id:
            session_id = self._chat_registry.create_session(
                org_id,
                "",
                user_id=platform_user,
                channel=self.channel,
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

        answer = (result.get("answer") or "").strip() or ERROR_REPLY
        return truncate_reply(answer, MSG_MAX_BYTES)

    def _reset_session(self, org_id: str, platform_user: str, wechat_userid: str) -> str:
        """Archive current wechat session and start fresh on next message."""
        session_id = self._chat_registry.find_active_session(
            org_id,
            platform_user,
            channel=self.channel,
            external_session_id=wechat_userid,
        )
        if session_id:
            self._chat_registry.archive_session(session_id, org_id)
        return RESET_OK
