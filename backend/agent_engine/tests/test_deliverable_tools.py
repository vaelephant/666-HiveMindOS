"""save_deliverable and action_gates tests."""

from __future__ import annotations

from unittest.mock import patch

import pytest

from agent_engine.execution.exceptions import ApprovalRequired
from agent_engine.execution.executor_engine import check_gate
from agent_engine.models.plan import QueueTask
from agent_engine.tools.task_toolkit import TaskToolExecutor, list_actions


def test_save_deliverable_listed():
    assert "save_deliverable" in list_actions()


def test_save_deliverable_writes_wiki():
    ex = TaskToolExecutor("demo", "user1")
    with patch("agent_engine.tools.task_toolkit.upsert_digest_page", return_value="deliverables/report.md") as upsert:
        with patch.object(ex._wiki, "update_index") as update_index:
            result = ex.execute("save_deliverable", {
                "title": "销售方案",
                "content": "## 摘要\n客户痛点…",
            })
    assert result["wiki_path"] == "deliverables/report.md"
    upsert.assert_called_once()
    update_index.assert_called_once_with("demo")


def test_wechat_send_requires_human_gate():
    task = QueueTask(
        id="t1",
        name="通知客户",
        action="wechat_work_send",
        params={"to_user": "wx1", "content": "hi"},
        gate="auto",
    )
    with pytest.raises(ApprovalRequired, match="人工"):
        check_gate(task, "demo", "user1")
