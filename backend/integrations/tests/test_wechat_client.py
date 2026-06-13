"""WeChatWorkClient unit tests."""

from __future__ import annotations

from unittest.mock import MagicMock, patch

import pytest

from integrations.wechat_work.client import WeChatWorkClient, _truncate_content


def test_get_access_token_caches():
    client = WeChatWorkClient("corp", "secret")
    mock_resp = MagicMock()
    mock_resp.raise_for_status = MagicMock()
    mock_resp.json.return_value = {
        "errcode": 0,
        "access_token": "tok123",
        "expires_in": 7200,
    }
    with patch("httpx.get", return_value=mock_resp) as mock_get:
        assert client.get_access_token() == "tok123"
        assert client.get_access_token() == "tok123"
        assert mock_get.call_count == 1


def test_get_access_token_raises_on_error():
    client = WeChatWorkClient("corp", "secret")
    mock_resp = MagicMock()
    mock_resp.raise_for_status = MagicMock()
    mock_resp.json.return_value = {"errcode": 40001, "errmsg": "invalid credential"}
    with patch("httpx.get", return_value=mock_resp):
        with pytest.raises(RuntimeError, match="gettoken failed"):
            client.get_access_token()


def test_send_text_message():
    client = WeChatWorkClient("corp", "secret")
    get_resp = MagicMock()
    get_resp.raise_for_status = MagicMock()
    get_resp.json.return_value = {"errcode": 0, "access_token": "tok", "expires_in": 7200}

    send_resp = MagicMock()
    send_resp.raise_for_status = MagicMock()
    send_resp.json.return_value = {"errcode": 0, "errmsg": "ok"}

    with patch("httpx.get", return_value=get_resp):
        with patch("httpx.post", return_value=send_resp) as mock_post:
            client.send_text("1000001", "zhangsan", "你好")
            assert mock_post.call_count == 1
            payload = mock_post.call_args.kwargs.get("json") or mock_post.call_args[1].get("json")
            assert payload["touser"] == "zhangsan"
            assert payload["text"]["content"] == "你好"


def test_truncate_content():
    long_text = "你" * 3000
    result = _truncate_content(long_text)
    assert len(result.encode("utf-8")) <= 2048
