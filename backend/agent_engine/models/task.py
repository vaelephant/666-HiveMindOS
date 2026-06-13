from dataclasses import dataclass, field
from typing import Optional


@dataclass
class Task:
    id: str
    org_id: str
    input: str
    status: str = "pending"
    steps: list[dict] = field(default_factory=list)
    result: Optional[str] = None
    reflection_report: Optional[str] = None
    error: Optional[str] = None
    created_at: str = ""
    completed_at: Optional[str] = None
    # Goal engine (Plan → Execute → Reflect)
    task_type: str = "generic_goal"
    rubric_id: str = ""
    constraints: dict = field(default_factory=dict)
    phase: str = "pending"
    plan: Optional[dict] = None
    queue: list = field(default_factory=list)
    checkpoints: dict = field(default_factory=dict)
    reflections: list = field(default_factory=list)
    score: Optional[int] = None
    experience_id: Optional[str] = None
    pending_step_id: Optional[str] = None
