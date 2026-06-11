"""ChatRegistry channel-scoped session tests (requires PostgreSQL)."""

from __future__ import annotations

import uuid

import pytest

from memory_layer.knowledge_base.core.db.postgres import pg_conn
from memory_layer.knowledge_base.core.registry.chat_registry import ChatRegistry


def _cleanup(org_id: str) -> None:
    with pg_conn() as conn:
        conn.execute(
            "DELETE FROM chat_messages WHERE org_id = %s",
            (org_id,),
        )
        conn.execute(
            "DELETE FROM chat_sessions WHERE org_id = %s",
            (org_id,),
        )
        conn.commit()


@pytest.fixture
def org_id():
    oid = f"test_wechat_{uuid.uuid4().hex[:8]}"
    yield oid
    _cleanup(oid)


def test_create_session_with_channel(org_id: str):
    reg = ChatRegistry()
    sid = reg.create_session(
        org_id, "",
        user_id="user1",
        channel="wechat_work",
        external_session_id="wx_zhangsan",
    )
    assert sid
    found = reg.find_active_session(
        org_id, "user1",
        channel="wechat_work",
        external_session_id="wx_zhangsan",
    )
    assert found == sid


def test_find_active_wechat_session_returns_existing(org_id: str):
    reg = ChatRegistry()
    sid1 = reg.create_session(
        org_id, "first",
        user_id="user1",
        channel="wechat_work",
        external_session_id="wx_lisi",
    )
    found = reg.find_active_session(
        org_id, "user1",
        channel="wechat_work",
        external_session_id="wx_lisi",
    )
    assert found == sid1


def test_wechat_sessions_isolated_by_external_id(org_id: str):
    reg = ChatRegistry()
    sid_a = reg.create_session(
        org_id, "",
        user_id="user1",
        channel="wechat_work",
        external_session_id="wx_a",
    )
    sid_b = reg.create_session(
        org_id, "",
        user_id="user1",
        channel="wechat_work",
        external_session_id="wx_b",
    )
    assert sid_a != sid_b
    assert reg.find_active_session(
        org_id, "user1", channel="wechat_work", external_session_id="wx_a",
    ) == sid_a
