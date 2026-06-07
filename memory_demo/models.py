from dataclasses import dataclass, field
from datetime import datetime
from typing import List


def _now_iso() -> str:
    return datetime.now().isoformat(timespec="minutes")


@dataclass
class Message:
    role: str
    content: str
    created_at: str = field(default_factory=_now_iso)


@dataclass
class SummaryNode:
    summary_id: str
    content: str
    source_indexes: List[int] = field(default_factory=list)
    depth: int = 0
    parent_ids: List[str] = field(default_factory=list)
    child_ids: List[str] = field(default_factory=list)
    earliest_at: str = ""   # 所覆盖的最早消息时间
    latest_at: str = ""     # 所覆盖的最晚消息时间
    quality: str = "normal" # 摘要质量：normal / simplified / truncated