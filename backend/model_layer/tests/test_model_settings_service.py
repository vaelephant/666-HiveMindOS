"""Tests for per-user model settings."""

from __future__ import annotations

from unittest.mock import MagicMock, patch

import pytest

import model_layer.services.model_settings_service as model_settings_service


def test_validate_custom_profile_rejects_bad_id():
    with pytest.raises(ValueError, match="模型 ID"):
        model_settings_service._validate_custom_profile(
            {"label": "Test", "id": "BAD ID", "provider": "openai", "model": "gpt-4o"},
            existing_ids=set(),
        )


def test_resolve_user_profile_returns_custom():
    settings = model_settings_service.UserModelSettings(
        org_id="o1",
        user_id="u1",
        chat_profile="default",
        fast_profile="fast",
        embed_profile="embedding",
        custom_profiles=[
            {
                "id": "my-claude",
                "label": "My Claude",
                "kind": "chat",
                "provider": "anthropic",
                "model": "claude-sonnet-4-6",
                "max_tokens": 4096,
            }
        ],
    )
    with patch.object(model_settings_service, "get_settings", return_value=settings):
        resolved = model_settings_service.resolve_user_profile("o1", "u1", "my-claude")
    assert resolved is not None
    assert resolved.model == "claude-sonnet-4-6"
    assert resolved.provider == "anthropic"


def test_save_preferences_validates_profile():
    mock_conn = MagicMock()
    row = ("o1", "u1", "default", "fast", "embedding", [], None)
    mock_conn.execute.side_effect = [
        MagicMock(fetchone=MagicMock(return_value=row)),
        MagicMock(),
    ]
    with patch.object(model_settings_service, "pg_conn") as pg:
        pg.return_value.__enter__.return_value = mock_conn
        with pytest.raises(ValueError, match="无效的"):
            model_settings_service.save_preferences("o1", "u1", chat_profile="not-a-real-profile")
