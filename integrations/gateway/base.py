"""Channel adapter protocol — one interface for WeChat Work, future IM channels."""

from __future__ import annotations

from typing import Protocol


def truncate_reply(text: str, max_bytes: int = 2048) -> str:
    """Trim reply to platform byte limit (UTF-8 safe)."""
    encoded = text.encode("utf-8")
    if len(encoded) <= max_bytes:
        return text
    suffix = "\n\n（内容过长，已截断）"
    budget = max_bytes - len(suffix.encode("utf-8"))
    trimmed = encoded[:budget]
    while trimmed and (trimmed[-1] & 0xC0) == 0x80:
        trimmed = trimmed[:-1]
    return trimmed.decode("utf-8", errors="ignore") + suffix


class ChannelAdapter(Protocol):
    """Inbound text → assistant reply. Implement per messaging platform."""

    channel: str

    def handle_inbound_text(
        self,
        org_id: str,
        external_user_id: str,
        text: str,
    ) -> str: ...
