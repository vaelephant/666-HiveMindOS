"""WeChat Work configuration and user-facing reply constants."""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class WeChatWorkOrgConfig:
    org_id: str
    corp_id: str
    agent_id: str
    secret: str
    token: str
    encoding_aes_key: str
    enabled: bool


UNBOUND_REPLY = "请先在 HiveMind 平台完成企业微信账号绑定后再使用。"
UNSUPPORTED_MSG_REPLY = "暂不支持该消息类型，请发送文字消息。"
ERROR_REPLY = "处理失败，请稍后重试。"

MSG_MAX_BYTES = 2048
