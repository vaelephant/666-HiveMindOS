from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Optional


class JobStatus(str, Enum):
    PENDING = "pending"
    RUNNING = "running"
    DONE = "done"
    FAILED = "failed"


@dataclass
class CompileJob:
    id: str
    org_id: str
    source_id: str
    status: JobStatus = JobStatus.PENDING
    result: dict = field(default_factory=dict)
    error: str = ""
    created_at: datetime = field(default_factory=datetime.utcnow)
    completed_at: Optional[datetime] = None
