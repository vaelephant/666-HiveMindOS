from dataclasses import dataclass, field


@dataclass
class KnowledgeCandidateRecord:
    id: int
    org_id: str
    user_id: str | None
    category: str
    title: str
    content: str
    source_type: str
    source_id: str | None
    confidence: float
    proposed_action: str
    status: str
    resolver_action: str | None
    resolver_note: str | None
    target_wiki_path: str | None
    memory_id: int | None
    metadata: dict = field(default_factory=dict)
    created_at: str = ""
    updated_at: str = ""


@dataclass
class CandidateInput:
    """写入候选池的标准结构（聊天/文档/复盘统一）。"""
    category: str
    title: str
    content: str
    source_type: str
    source_id: str | None = None
    confidence: float = 0.5
    proposed_action: str = "create_or_update"
    memory_id: int | None = None
    metadata: dict | None = None


@dataclass
class CandidateStats:
    pending: int
    approved: int
    merged: int
    rejected: int
    conflict: int
    pending_week: int
