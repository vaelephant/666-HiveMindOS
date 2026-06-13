"""wechat_work_send agent action tests."""

from __future__ import annotations

from unittest.mock import MagicMock, patch

import pytest

from agent_engine.tools.task_toolkit import TaskToolExecutor, list_actions
from agent_engine.tools.wechat_work import send_wechat_work_message
from integrations.wechat_work.config import WeChatWorkOrgConfig


def test_wechat_work_send_listed_in_registry():
    assert "wechat_work_send" in list_actions()


def test_send_wechat_work_message_success():
    cfg = WeChatWorkOrgConfig(
        org_id="org1",
        corp_id="corp",
        agent_id="1000001",
        secret="sec",
        token="tok",
        encoding_aes_key="aes",
        enabled=True,
    )
    with patch("agent_engine.tools.wechat_work.WeChatWorkRegistry") as reg_cls:
        reg_cls.return_value.get_org_config.return_value = cfg
        with patch("agent_engine.tools.wechat_work.WeChatWorkClient") as client_cls:
            client = MagicMock()
            client_cls.return_value = client
            result = send_wechat_work_message("org1", "zhangsan", "任务已完成")
    assert result["ok"] is True
    assert result["to_user"] == "zhangsan"
    client.send_text.assert_called_once_with("1000001", "zhangsan", "任务已完成")


def test_send_wechat_work_message_markdown():
    cfg = WeChatWorkOrgConfig(
        org_id="org1", corp_id="c", agent_id="1", secret="s",
        token="t", encoding_aes_key="k", enabled=True,
    )
    with patch("agent_engine.tools.wechat_work.WeChatWorkRegistry") as reg_cls:
        reg_cls.return_value.get_org_config.return_value = cfg
        with patch("agent_engine.tools.wechat_work.WeChatWorkClient") as client_cls:
            client = MagicMock()
            client_cls.return_value = client
            send_wechat_work_message("org1", "u1", "**bold**", msg_type="markdown")
    client.send_markdown.assert_called_once()


def test_send_requires_enabled_config():
    with patch("agent_engine.tools.wechat_work.WeChatWorkRegistry") as reg_cls:
        reg_cls.return_value.get_org_config.return_value = None
        with pytest.raises(ValueError, match="未配置"):
            send_wechat_work_message("org1", "u", "hi")


def test_task_executor_dispatches_wechat_work_send():
    cfg = WeChatWorkOrgConfig(
        org_id="demo", corp_id="c", agent_id="1", secret="s",
        token="t", encoding_aes_key="k", enabled=True,
    )
    with patch("agent_engine.tools.wechat_work.WeChatWorkRegistry") as reg_cls:
        reg_cls.return_value.get_org_config.return_value = cfg
        with patch("agent_engine.tools.wechat_work.WeChatWorkClient") as client_cls:
            client_cls.return_value = MagicMock()
            ex = TaskToolExecutor("demo", "user1")
            result = ex.execute("wechat_work_send", {"to_user": "wx1", "content": "通知"})
    assert result["ok"] is True
