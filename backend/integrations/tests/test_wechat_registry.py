"""WeChatWorkRegistry tests (requires PostgreSQL)."""

from __future__ import annotations

import uuid

import pytest

from integrations.tests.conftest import requires_postgres
from integrations.wechat_work.registry import WeChatWorkRegistry

pytestmark = requires_postgres
from shared.db.postgres import pg_conn


def _cleanup(org_id: str) -> None:
    with pg_conn() as conn:
        conn.execute("DELETE FROM wechat_work_user_bindings WHERE org_id = %s", (org_id,))
        conn.execute("DELETE FROM wechat_work_org_config WHERE org_id = %s", (org_id,))
        conn.commit()


@pytest.fixture
def org_id():
    oid = f"test_wxreg_{uuid.uuid4().hex[:8]}"
    yield oid
    _cleanup(oid)


def test_save_and_load_org_config(org_id: str):
    reg = WeChatWorkRegistry()
    reg.upsert_org_config(
        org_id, "corp1", "1000001", "secret123", "tokenabc", "aeskey456", True,
    )
    cfg = reg.get_org_config(org_id)
    assert cfg is not None
    assert cfg.corp_id == "corp1"
    assert cfg.enabled is True

    pub = reg.get_org_config_public(org_id)
    assert pub is not None
    assert "****" in pub["secret"]
    assert pub["secret"] != "secret123"


def test_resolve_platform_user_id(org_id: str):
    reg = WeChatWorkRegistry()
    reg.bind_user(org_id, "platform_u1", "wx_u1", "张三")
    assert reg.resolve_platform_user_id(org_id, "wx_u1") == "platform_u1"
    assert reg.resolve_platform_user_id(org_id, "unknown") is None


def test_list_and_unbind(org_id: str):
    reg = WeChatWorkRegistry()
    bid = reg.bind_user(org_id, "p1", "wx1", "李四")
    bindings = reg.list_bindings(org_id)
    assert len(bindings) == 1
    assert bindings[0]["wechat_userid"] == "wx1"
    assert reg.unbind_user(org_id, bid) is True
    assert reg.list_bindings(org_id) == []
