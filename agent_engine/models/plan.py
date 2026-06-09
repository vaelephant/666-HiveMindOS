"""任务规划数据模型 — Planner 输出与任务队列。"""

from __future__ import annotations

from dataclasses import dataclass, field


@dataclass
class QueueTask:
    id: str
    name: str
    action: str
    params: dict = field(default_factory=dict)
    status: str = "pending"
    gate: str = "auto"
    when: str | None = None
    reason: str = ""
    retry_count: int = 0

    @classmethod
    def from_dict(cls, d: dict) -> QueueTask:
        action = d.get("action") or d.get("tool") or ""
        return cls(
            id=str(d["id"]),
            name=d.get("name") or action,
            action=action,
            params=dict(d.get("params") or {}),
            status=d.get("status", "pending"),
            gate=d.get("gate", "auto"),
            when=d.get("when"),
            reason=d.get("reason", ""),
            retry_count=int(d.get("retry_count") or 0),
        )

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "name": self.name,
            "action": self.action,
            "params": self.params,
            "status": self.status,
            "gate": self.gate,
            "when": self.when,
            "reason": self.reason,
            "retry_count": self.retry_count,
        }


@dataclass
class Plan:
    goal: str
    task_type: str
    rubric_id: str
    success_criteria: list[str]
    tasks: list[QueueTask]
    estimated_risk: str = "low"
    planning_mode: str | None = None
    planning_minutes: list[dict] = field(default_factory=list)
    planning_active_role: str | None = None
    committee_roles: list[dict] = field(default_factory=list)

    @classmethod
    def from_dict(cls, d: dict) -> Plan:
        raw_tasks = d.get("tasks") or d.get("steps") or []
        task_type = d.get("task_type") or d.get("rubric_id") or "generic_goal"
        rubric_id = d.get("rubric_id") or task_type
        return cls(
            goal=d["goal"],
            task_type=task_type,
            rubric_id=rubric_id,
            success_criteria=list(d.get("success_criteria") or []),
            tasks=[QueueTask.from_dict(t) for t in raw_tasks],
            estimated_risk=d.get("estimated_risk", "low"),
            planning_mode=d.get("planning_mode"),
            planning_minutes=list(d.get("planning_minutes") or []),
            planning_active_role=d.get("planning_active_role"),
            committee_roles=list(d.get("committee_roles") or []),
        )

    def to_dict(self) -> dict:
        out = {
            "goal": self.goal,
            "task_type": self.task_type,
            "rubric_id": self.rubric_id,
            "success_criteria": self.success_criteria,
            "estimated_risk": self.estimated_risk,
            "tasks": [t.to_dict() for t in self.tasks],
        }
        if self.planning_mode:
            out["planning_mode"] = self.planning_mode
        if self.planning_minutes:
            out["planning_minutes"] = self.planning_minutes
        if self.planning_active_role:
            out["planning_active_role"] = self.planning_active_role
        if self.committee_roles:
            out["committee_roles"] = self.committee_roles
        return out
