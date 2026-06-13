"""YAML 工作流定义解析与校验。"""

from __future__ import annotations

import re

import yaml

_STEP_ID = re.compile(r"^[a-z][a-z0-9_]*$")
_ALLOWED_ACTION_PREFIXES = ("automation.", "tool.")


def parse_workflow_yaml(text: str) -> dict:
    """解析 YAML 文本为规范化的工作流 dict。"""
    if not (text or "").strip():
        raise ValueError("工作流 YAML 不能为空")
    try:
        data = yaml.safe_load(text)
    except yaml.YAMLError as exc:
        raise ValueError(f"YAML 语法错误: {exc}") from exc
    if not isinstance(data, dict):
        raise ValueError("工作流根节点必须是 mapping")
    return normalize_workflow_dict(data)


def normalize_workflow_dict(data: dict) -> dict:
    wf_id = (data.get("id") or "").strip()
    if not wf_id or not _STEP_ID.match(wf_id):
        raise ValueError("id 必填，且仅允许小写字母、数字、下划线，并以字母开头")

    label = (data.get("label") or wf_id).strip()
    steps_raw = data.get("steps")
    if not isinstance(steps_raw, list) or not steps_raw:
        raise ValueError("steps 必须是非空列表")

    steps: list[dict] = []
    seen_ids: set[str] = set()
    for i, raw in enumerate(steps_raw):
        if not isinstance(raw, dict):
            raise ValueError(f"steps[{i}] 必须是 mapping")
        step_id = (raw.get("id") or "").strip()
        if not step_id or not _STEP_ID.match(step_id):
            raise ValueError(f"steps[{i}].id 无效: {step_id!r}")
        if step_id in seen_ids:
            raise ValueError(f"重复的 step id: {step_id}")
        seen_ids.add(step_id)

        action = (raw.get("action") or "").strip()
        if not action:
            raise ValueError(f"steps[{i}] 缺少 action")
        if not any(action.startswith(p) for p in _ALLOWED_ACTION_PREFIXES):
            raise ValueError(
                f"steps[{i}].action 须以 automation.* 或 tool.* 开头，收到: {action}",
            )

        params = raw.get("params") or {}
        if not isinstance(params, dict):
            raise ValueError(f"steps[{i}].params 必须是 mapping")

        when = raw.get("when")
        if when is not None and not isinstance(when, str):
            raise ValueError(f"steps[{i}].when 必须是字符串")

        steps.append({
            "id": step_id,
            "action": action,
            "params": params,
            **({"when": when.strip()} if when else {}),
        })

    enabled = data.get("enabled", True)
    if not isinstance(enabled, bool):
        enabled = str(enabled).lower() in ("1", "true", "yes", "on")

    schedule_enabled = data.get("schedule_enabled", False)
    if not isinstance(schedule_enabled, bool):
        schedule_enabled = str(schedule_enabled).lower() in ("1", "true", "yes", "on")

    cron_hint = (data.get("cron_hint") or "").strip()
    if schedule_enabled and not cron_hint:
        raise ValueError("启用 schedule_enabled 时必须填写 cron_hint")

    schedule_user_id = (data.get("schedule_user_id") or "demo").strip() or "demo"

    return {
        "id": wf_id,
        "label": label,
        "description": (data.get("description") or "").strip(),
        "category": (data.get("category") or "mixed").strip(),
        "cron_hint": cron_hint,
        "enabled": enabled,
        "schedule_enabled": schedule_enabled,
        "schedule_user_id": schedule_user_id,
        "steps": steps,
    }


def workflow_to_yaml(data: dict) -> str:
    """将规范化 dict 转回 YAML（供 UI 编辑）。"""
    payload = {
        "id": data["id"],
        "label": data.get("label") or data["id"],
        "description": data.get("description") or "",
        "category": data.get("category") or "mixed",
        "cron_hint": data.get("cron_hint") or "",
        "enabled": bool(data.get("enabled", True)),
        "schedule_enabled": bool(data.get("schedule_enabled", False)),
        "schedule_user_id": data.get("schedule_user_id") or "demo",
        "steps": data.get("steps") or [],
    }
    return yaml.safe_dump(payload, allow_unicode=True, sort_keys=False, default_flow_style=False)
