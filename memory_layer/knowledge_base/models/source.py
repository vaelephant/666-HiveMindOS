import hashlib
from dataclasses import dataclass, field
from datetime import datetime


@dataclass
class RawSource:
    id: str
    org_id: str
    filename: str
    content_hash: str
    source_type: str   # pdf / word / excel / text
    file_path: str
    created_at: datetime = field(default_factory=datetime.utcnow)
    metadata: dict = field(default_factory=dict)

    @staticmethod
    def compute_hash(content: bytes) -> str:
        return hashlib.sha256(content).hexdigest()
