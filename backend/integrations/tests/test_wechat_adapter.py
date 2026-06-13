"""WeChatWorkAdapter unit tests."""

from __future__ import annotations

from unittest.mock import MagicMock, patch

from integrations.wechat_work.adapter import WeChatWorkAdapter
from integrations.wechat_work.config import UNBOUND_REPLY
from integrations.gateway.commands import RESET_OK, HELP_TEXT


def test_unbound_user_gets_guide_message():
    wx_reg = MagicMock()
    wx_reg.resolve_platform_user_id.return_value = None
    adapter = WeChatWorkAdapter(wx_registry=wx_reg, chat_registry=MagicMock())

    reply = adapter.handle_inbound_text("org1", "wx_unknown", "你好")
    assert reply == UNBOUND_REPLY


def test_reuses_active_session():
    wx_reg = MagicMock()
    wx_reg.resolve_platform_user_id.return_value = "platform_u1"
    chat_reg = MagicMock()
    chat_reg.find_active_session.return_value = "sess-1"

    adapter = WeChatWorkAdapter(wx_registry=wx_reg, chat_registry=chat_reg)

    with patch(
        "integrations.wechat_work.adapter.chat_service.send_message",
        return_value={"answer": "你好！", "session_id": "sess-1"},
    ) as send_mock:
        reply = adapter.handle_inbound_text("org1", "wx_u1", "你好")

    chat_reg.find_active_session.assert_called_once_with(
        "org1", "platform_u1", channel="wechat_work", external_session_id="wx_u1",
    )
    chat_reg.create_session.assert_not_called()
    send_mock.assert_called_once_with(
        "org1", "你好", session_id="sess-1", user_id="platform_u1",
    )
    assert reply == "你好！"


def test_creates_session_when_none_active():
    wx_reg = MagicMock()
    wx_reg.resolve_platform_user_id.return_value = "platform_u1"
    chat_reg = MagicMock()
    chat_reg.find_active_session.return_value = None
    chat_reg.create_session.return_value = "sess-new"

    adapter = WeChatWorkAdapter(wx_registry=wx_reg, chat_registry=chat_reg)

    with patch(
        "integrations.wechat_work.adapter.chat_service.send_message",
        return_value={"answer": "ok", "session_id": "sess-new"},
    ):
        adapter.handle_inbound_text("org1", "wx_u1", "问题")

    chat_reg.create_session.assert_called_once_with(
        "org1", "", user_id="platform_u1",
        channel="wechat_work", external_session_id="wx_u1",
    )


def test_slash_help():
    wx_reg = MagicMock()
    wx_reg.resolve_platform_user_id.return_value = "platform_u1"
    adapter = WeChatWorkAdapter(wx_registry=wx_reg, chat_registry=MagicMock())
    assert adapter.handle_inbound_text("org1", "wx_u1", "/help") == HELP_TEXT


def test_slash_reset_archives_session():
    wx_reg = MagicMock()
    wx_reg.resolve_platform_user_id.return_value = "platform_u1"
    chat_reg = MagicMock()
    chat_reg.find_active_session.return_value = "sess-old"
    adapter = WeChatWorkAdapter(wx_registry=wx_reg, chat_registry=chat_reg)

    reply = adapter.handle_inbound_text("org1", "wx_u1", "/new")
    chat_reg.archive_session.assert_called_once_with("sess-old", "org1")
    assert reply == RESET_OK

