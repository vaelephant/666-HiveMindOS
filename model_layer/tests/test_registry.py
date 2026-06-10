"""Registry 单元测试。"""

from __future__ import annotations

import pytest

from model_layer.registry import resolve_chat, resolve_embed, startup_report


def test_resolve_default_chat_profile():
    prof = resolve_chat("default")
    assert prof.kind == "chat"
    assert prof.provider == "openai"
    assert prof.model
    assert prof.max_tokens > 0


def test_resolve_fast_chat_profile():
    prof = resolve_chat("fast")
    assert prof.provider == "openai"
    assert prof.kind == "chat"


def test_resolve_anthropic_optional_profile():
    prof = resolve_chat("anthropic_strong")
    assert prof.provider == "anthropic"
    assert prof.kind == "chat"


def test_resolve_chat_tools_profile():
    prof = resolve_chat("chat_tools")
    assert prof.provider == "openai"
    assert prof.kind == "chat"


def test_resolve_embedding_profile():
    prof = resolve_embed("embedding")
    assert prof.kind == "embed"
    assert prof.provider == "openai"
    assert prof.dim == 1536


def test_mismatch_helper_detects_openai_model_on_anthropic():
    from model_layer.registry import _model_provider_mismatch

    msg = _model_provider_mismatch("anthropic", "gpt-4o")
    assert msg
    assert "anthropic" in msg


def test_startup_report_is_list():
    assert isinstance(startup_report(), list)
