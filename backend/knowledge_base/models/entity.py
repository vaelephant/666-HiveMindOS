from dataclasses import dataclass, field
from datetime import datetime


@dataclass
class Entity:
    id: str
    org_id: str
    name: str
    entity_type: str   # person / product / process / rule / customer / contract
    wiki_path: str
    attributes: dict = field(default_factory=dict)
    updated_at: datetime = field(default_factory=datetime.utcnow)


@dataclass
class Relation:
    id: str
    org_id: str
    source_entity_id: str
    target_entity_id: str
    relation_type: str  # owns / involves / requires / triggers
    weight: float = 1.0
    metadata: dict = field(default_factory=dict)
