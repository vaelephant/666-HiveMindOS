"""WeChat Work API client — access token cache and message send."""

from __future__ import annotations

import time
from typing import Any

import httpx

from integrations.wechat_work.config import MSG_MAX_BYTES

_TOKEN_URL = "https://qyapi.weixin.qq.com/cgi-bin/gettoken"
_SEND_URL = "https://qyapi.weixin.qq.com/cgi-bin/message/send"


def _truncate_content(content: str, max_bytes: int = MSG_MAX_BYTES) -> str:
    encoded = content.encode("utf-8")
    if len(encoded) <= max_bytes:
        return content
    trimmed = encoded[: max_bytes - 3].decode("utf-8", errors="ignore")
    return trimmed + "…"


class WeChatWorkClient:
    def __init__(self, corp_id: str, secret: str) -> None:
        self._corp_id = corp_id
        self._secret = secret
        self._token: str | None = None
        self._token_expires_at: float = 0.0

    def get_access_token(self, *, force_refresh: bool = False) -> str:
        now = time.time()
        if not force_refresh and self._token and now < self._token_expires_at - 300:
            return self._token

        resp = httpx.get(
            _TOKEN_URL,
            params={"corpid": self._corp_id, "corpsecret": self._secret},
            timeout=15.0,
        )
        resp.raise_for_status()
        data: dict[str, Any] = resp.json()
        if data.get("errcode", 0) != 0:
            raise RuntimeError(f"gettoken failed: {data.get('errmsg', data)}")

        self._token = data["access_token"]
        self._token_expires_at = now + int(data.get("expires_in", 7200))
        return self._token

    def _send(self, agent_id: str | int, to_user: str, payload: dict) -> None:
        token = self.get_access_token()
        payload = {
            **payload,
            "touser": to_user,
            "agentid": int(agent_id),
            "safe": 0,
        }
        resp = httpx.post(
            _SEND_URL,
            params={"access_token": token},
            json=payload,
            timeout=15.0,
        )
        resp.raise_for_status()
        data = resp.json()
        if data.get("errcode", 0) != 0:
            if data.get("errcode") == 40014:
                token = self.get_access_token(force_refresh=True)
                resp = httpx.post(
                    _SEND_URL,
                    params={"access_token": token},
                    json=payload,
                    timeout=15.0,
                )
                resp.raise_for_status()
                data = resp.json()
            if data.get("errcode", 0) != 0:
                raise RuntimeError(f"send message failed: {data.get('errmsg', data)}")

    def send_text(self, agent_id: str | int, to_user: str, content: str) -> None:
        content = _truncate_content(content)
        self._send(agent_id, to_user, {"msgtype": "text", "text": {"content": content}})

    def send_markdown(self, agent_id: str | int, to_user: str, content: str) -> None:
        content = _truncate_content(content)
        self._send(agent_id, to_user, {"msgtype": "markdown", "markdown": {"content": content}})
