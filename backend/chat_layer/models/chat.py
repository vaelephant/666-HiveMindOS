from dataclasses import dataclass, field


@dataclass
class ChatSession:
    id: str
    org_id: str
    user_id: str
    title: str
    status: str
    created_at: str
    updated_at: str
    turns: list[dict] = field(default_factory=list)


@dataclass
class ChatSessionSummary:
    id: str
    org_id: str
    user_id: str
    title: str
    status: str
    created_at: str
    updated_at: str
