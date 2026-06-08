from dataclasses import dataclass


@dataclass
class Memory:
    id: int
    org_id: str
    user_id: str | None
    memory_type: str
    title: str
    content: str
    importance: float
    status: str
    source_type: str | None
    source_id: str | None
    created_at: str
    updated_at: str


@dataclass
class MemoryEvent:
    id: int
    memory_id: int
    org_id: str
    event_type: str
    old_content: str | None
    new_content: str | None
    created_at: str
    memory_title: str
    memory_type: str
    source_id: str | None


@dataclass
class MemoryStats:
    total: int
    project: int
    preference: int
    decision: int
    events_this_week: int
    memories_this_week: int
    vector_indexed: int = 0


@dataclass
class MemoryCandidate:
    action: str  # create | update | skip
    memory_type: str
    title: str
    content: str
    importance: float
    match_title: str | None = None  # for update: existing memory title to match
