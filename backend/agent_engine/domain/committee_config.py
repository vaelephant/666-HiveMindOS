"""规划委员会配置 — 从 agent_engine/settings/planning_committee.yaml 加载角色与触发条件。"""

from __future__ import annotations

from dataclasses import dataclass
from functools import lru_cache

from agent_engine.settings import load


@dataclass(frozen=True)
class CommitteeRole:
    id: str
    label: str
    description: str
    prompt: str
    order: int
    synthesizes_plan: bool = False
    reads_prior: tuple[str, ...] = ()


def _parse_role(raw: dict) -> CommitteeRole:
    return CommitteeRole(
        id=str(raw["id"]),
        label=str(raw.get("label") or raw["id"]),
        description=str(raw.get("description") or ""),
        prompt=str(raw.get("prompt") or f"planning_{raw['id']}"),
        order=int(raw.get("order") or 0),
        synthesizes_plan=bool(raw.get("synthesizes_plan")),
        reads_prior=tuple(raw.get("reads_prior") or []),
    )


@lru_cache(maxsize=1)
def load_committee_config() -> dict:
    return load("planning_committee")


def reload_committee_config() -> None:
    load_committee_config.cache_clear()
    from agent_engine.settings import reload

    reload("planning_committee")


def committee_meta() -> dict:
    cfg = load_committee_config()
    return {
        "label": cfg.get("label", "规划委员会"),
        "description": cfg.get("description", ""),
    }


def committee_roles() -> list[CommitteeRole]:
    cfg = load_committee_config()
    roles = [_parse_role(r) for r in (cfg.get("roles") or [])]
    if not roles:
        raise ValueError("planning_committee.yaml: roles 不能为空")
    return sorted(roles, key=lambda r: r.order)


def role_labels() -> dict[str, str]:
    return {r.id: r.label for r in committee_roles()}


def role_by_id(role_id: str) -> CommitteeRole | None:
    return next((r for r in committee_roles() if r.id == role_id), None)


def trigger_sources() -> frozenset[str]:
    cfg = load_committee_config()
    sources = cfg.get("trigger_sources") or ["chat_upgrade", "task_center"]
    return frozenset(str(s) for s in sources)


def should_trigger_committee(constraints: dict | None) -> bool:
    src = (constraints or {}).get("source")
    return bool(src and src in trigger_sources())


def is_chat_upgrade(constraints: dict | None) -> bool:
    return (constraints or {}).get("source") == "chat_upgrade"


def committee_roles_for_ui() -> list[dict]:
    """供写入 plan JSON，前端展示与 yaml 一致的角色列表。"""
    return [
        {
            "id": r.id,
            "label": r.label,
            "description": r.description,
            "order": r.order,
        }
        for r in committee_roles()
    ]


def fallback_risk_for_task_type(task_type: str) -> dict:
    cfg = load_committee_config()
    fb = (cfg.get("fallback") or {}).get("risk") or {}
    by_type = fb.get("by_task_type") or {}
    data = dict(by_type.get(task_type) or fb.get("default") or {})
    data.setdefault("estimated_risk", "low")
    data.setdefault("summary", "按企业 gate 策略标注高风险写操作")
    data.setdefault("gate_overrides", [])
    data.setdefault("concerns", [])
    return data


def fallback_domain_summary() -> str:
    cfg = load_committee_config()
    return (
        (cfg.get("fallback") or {})
        .get("domain", {})
        .get("default_summary", "按任务类型拆解标准步骤")
    )
