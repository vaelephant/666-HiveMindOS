"""交付物提取与 API 展示层测试。"""

import sys
from pathlib import Path

from agent_engine.domain.deliverable import extract_deliverable
from agent_engine.domain.task_present import task_to_api_dict
from agent_engine.models.task import Task


def test_extract_from_step_summary():
    steps = [
        {
            "task_id": "t1",
            "action": "llm_generate",
            "status": "done",
            "result_summary": {"chars": 500, "text": "## 推广策略\n\n面向 B2B 客户的 Geo 产品方案…" * 5},
        }
    ]
    out = extract_deliverable("写一个 geo 产品推广计划", steps)
    assert out is not None
    assert "推广策略" in out
    assert out.startswith("#")


def test_extract_from_result_raw():
    text = "A" * 120
    raw = str({"chars": 120, "count": 1, "text": text})
    steps = [
        {"task_id": "t1", "action": "llm_generate", "status": "done", "result_raw": raw},
    ]
    out = extract_deliverable("目标", steps)
    assert out is not None
    assert text in out


def test_task_present_splits_legacy_recap():
    plan_text = "A" * 120
    raw = str({"text": plan_text})
    recap = "# Geo产品推广计划复盘报告\n\n## 执行总结\n逐步执行…"
    task = Task(
        id="x",
        org_id="demo",
        input="写一个geo的产品推广计划",
        status="done",
        result=recap,
        steps=[{"action": "llm_generate", "status": "done", "result_raw": raw}],
        created_at="",
    )
    d = task_to_api_dict(task)
    assert d["reflection_report"] == recap
    assert plan_text in d["result"]


if __name__ == "__main__":
    test_extract_from_step_summary()
    test_extract_from_result_raw()
    test_task_present_splits_legacy_recap()
    print("ok")
