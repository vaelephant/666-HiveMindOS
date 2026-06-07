from dataclasses import dataclass, field
from typing import Optional


@dataclass
class Task:
    id: str
    org_id: str
    input: str
    status: str = "pending"   # pending | running | done | error
    steps: list[dict] = field(default_factory=list)
    result: Optional[str] = None
    error: Optional[str] = None
    created_at: str = ""
    completed_at: Optional[str] = None
