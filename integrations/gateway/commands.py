"""Shared slash commands for messaging channels (WeChat Work, future IM)."""

from __future__ import annotations

HELP_TEXT = """HiveMind 企微助手 · 可用命令
/new 或 /reset — 开始新对话
/help — 显示此帮助
其它文字 — 正常提问"""

RESET_OK = "已开始新对话，请继续提问。"


def parse_slash_command(text: str) -> str | None:
    """Return command name if text is a slash command, else None."""
    stripped = text.strip()
    if not stripped.startswith("/"):
        return None
    cmd = stripped.split()[0].lower()
    if cmd in ("/new", "/reset"):
        return "reset"
    if cmd == "/help":
        return "help"
    return None
