"""Gateway base utilities tests."""

from integrations.gateway.base import truncate_reply
from integrations.gateway.commands import parse_slash_command


def test_truncate_reply_utf8_safe():
    text = "你好" * 600
    out = truncate_reply(text, max_bytes=100)
    assert len(out.encode("utf-8")) <= 100
    assert "截断" in out


def test_parse_slash_reset():
    assert parse_slash_command("/new") == "reset"
    assert parse_slash_command("/reset") == "reset"
    assert parse_slash_command("/help") == "help"
    assert parse_slash_command("hello") is None
