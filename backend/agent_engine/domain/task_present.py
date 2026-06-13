"""任务 API 展示层：拆分交付物与执行复盘（兼容历史数据）。"""

from __future__ import annotations

from dataclasses import asdict

from agent_engine.domain.deliverable import extract_deliverable
from agent_engine.models.task import Task

_RECAP_MARKERS = ("执行总结", "执行复盘", "变更清单", "是否满足成功标准", "Rubric")


def _looks_like_recap(text: str) -> bool:
    return any(m in text for m in _RECAP_MARKERS)


def task_to_api_dict(task: Task) -> dict:
    d = asdict(task)
    if task.status != "done" or not task.result:
        return d

    if task.reflection_report:
        return d

    deliverable = extract_deliverable(
        task.input,
        task.steps or [],
        task.task_type or "generic_goal",
        checkpoints=task.checkpoints or {},
    )
    if deliverable and _looks_like_recap(task.result or ""):
        d["reflection_report"] = task.result
        d["result"] = deliverable
    return d
