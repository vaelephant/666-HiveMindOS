"""StepReflect / FinalReflect 结构化结果。"""

from __future__ import annotations

from dataclasses import dataclass, field


@dataclass
class StepReflectResult:
    score: int
    passed: bool
    status: str
    reason: str
    problems: list[str] = field(default_factory=list)
    dimensions: dict = field(default_factory=dict)
    next_action: str = "continue"
    new_tasks: list[dict] = field(default_factory=list)

    @classmethod
    def from_dict(cls, d: dict) -> StepReflectResult:
        status = d.get("status", "pass")
        return cls(
            score=int(d.get("score") or 0),
            passed=bool(d.get("passed", status == "pass")),
            status=status,
            reason=str(d.get("reason") or ""),
            problems=list(d.get("problems") or []),
            dimensions=dict(d.get("dimensions") or {}),
            next_action=str(d.get("next_action") or "continue"),
            new_tasks=list(d.get("new_tasks") or []),
        )

    def to_dict(self) -> dict:
        return {
            "score": self.score,
            "passed": self.passed,
            "status": self.status,
            "reason": self.reason,
            "problems": self.problems,
            "dimensions": self.dimensions,
            "next_action": self.next_action,
            "new_tasks": self.new_tasks,
        }
