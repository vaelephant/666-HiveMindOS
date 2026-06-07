from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from enum import Enum


class StepStatus(str, Enum):
    PENDING = "pending"
    RUNNING = "running"
    WAITING_APPROVAL = "waiting_approval"
    DONE = "done"
    FAILED = "failed"


@dataclass
class WorkflowStep:
    id: str
    name: str
    agent: str
    action: str
    depends_on: list[str] = field(default_factory=list)
    condition: str = ""
    status: StepStatus = StepStatus.PENDING
    result: dict = field(default_factory=dict)


@dataclass
class Workflow:
    name: str
    steps: list[WorkflowStep]
    trigger: str = ""
