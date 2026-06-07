import json
import sqlite3
from pathlib import Path
from typing import Optional

from memory_layer.knowledge_base.models.entity import Entity, Relation


class MemoryGraph:
    def __init__(self, db_path: Path):
        self.db_path = db_path
        db_path.parent.mkdir(parents=True, exist_ok=True)
        self._init_db()

    def _conn(self) -> sqlite3.Connection:
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        return conn

    def _init_db(self):
        with self._conn() as conn:
            conn.executescript("""
                CREATE TABLE IF NOT EXISTS entities (
                    id          TEXT PRIMARY KEY,
                    org_id      TEXT NOT NULL,
                    name        TEXT NOT NULL,
                    entity_type TEXT NOT NULL,
                    wiki_path   TEXT,
                    attributes  TEXT DEFAULT '{}',
                    updated_at  TEXT
                );
                CREATE INDEX IF NOT EXISTS idx_ent_org  ON entities(org_id);
                CREATE INDEX IF NOT EXISTS idx_ent_name ON entities(org_id, name);

                CREATE TABLE IF NOT EXISTS relations (
                    id               TEXT PRIMARY KEY,
                    org_id           TEXT NOT NULL,
                    source_entity_id TEXT NOT NULL,
                    target_entity_id TEXT NOT NULL,
                    relation_type    TEXT NOT NULL,
                    weight           REAL DEFAULT 1.0,
                    metadata         TEXT DEFAULT '{}'
                );
                CREATE INDEX IF NOT EXISTS idx_rel_src ON relations(source_entity_id);
                CREATE INDEX IF NOT EXISTS idx_rel_tgt ON relations(target_entity_id);
            """)

    def upsert_entity(self, entity: Entity):
        with self._conn() as conn:
            conn.execute(
                """INSERT OR REPLACE INTO entities
                   (id, org_id, name, entity_type, wiki_path, attributes, updated_at)
                   VALUES (?, ?, ?, ?, ?, ?, ?)""",
                (
                    entity.id, entity.org_id, entity.name, entity.entity_type,
                    entity.wiki_path,
                    json.dumps(entity.attributes, ensure_ascii=False),
                    entity.updated_at.isoformat(),
                ),
            )

    def get_entity(self, org_id: str, name: str) -> Optional[dict]:
        with self._conn() as conn:
            row = conn.execute(
                "SELECT * FROM entities WHERE org_id=? AND name=? ORDER BY ROWID DESC LIMIT 1",
                (org_id, name),
            ).fetchone()
            return _row_to_dict(row) if row else None

    def list_entities(self, org_id: str, entity_type: Optional[str] = None) -> list[dict]:
        with self._conn() as conn:
            if entity_type:
                rows = conn.execute(
                    "SELECT * FROM entities WHERE org_id=? AND entity_type=?",
                    (org_id, entity_type),
                ).fetchall()
            else:
                rows = conn.execute(
                    "SELECT * FROM entities WHERE org_id=?", (org_id,)
                ).fetchall()
            return [_row_to_dict(r) for r in rows]

    def add_relation(self, relation: Relation):
        with self._conn() as conn:
            conn.execute(
                """INSERT OR REPLACE INTO relations
                   (id, org_id, source_entity_id, target_entity_id, relation_type, weight, metadata)
                   VALUES (?, ?, ?, ?, ?, ?, ?)""",
                (
                    relation.id, relation.org_id,
                    relation.source_entity_id, relation.target_entity_id,
                    relation.relation_type, relation.weight,
                    json.dumps(relation.metadata, ensure_ascii=False),
                ),
            )

    def get_neighbors(self, entity_id: str, org_id: str) -> list[dict]:
        with self._conn() as conn:
            rows = conn.execute(
                """SELECT DISTINCT e.* FROM entities e
                   JOIN relations r ON r.source_entity_id = e.id OR r.target_entity_id = e.id
                   WHERE (r.source_entity_id = ? OR r.target_entity_id = ?)
                     AND r.org_id = ? AND e.id != ?""",
                (entity_id, entity_id, org_id, entity_id),
            ).fetchall()
            return [_row_to_dict(r) for r in rows]

    def get_entity_relations(self, entity_id: str, org_id: str) -> list[dict]:
        """Relations involving entity, with neighbor info and direction."""
        with self._conn() as conn:
            rows = conn.execute(
                """SELECT r.id, r.relation_type, r.source_entity_id, r.target_entity_id,
                          src.name AS source_name, tgt.name AS target_name,
                          src.entity_type AS source_type, tgt.entity_type AS target_type,
                          CASE WHEN r.source_entity_id = ? THEN tgt.wiki_path ELSE src.wiki_path END AS neighbor_wiki_path,
                          CASE WHEN r.source_entity_id = ? THEN tgt.name ELSE src.name END AS neighbor_name,
                          CASE WHEN r.source_entity_id = ? THEN tgt.entity_type ELSE src.entity_type END AS neighbor_type,
                          CASE WHEN r.source_entity_id = ? THEN 'outgoing' ELSE 'incoming' END AS direction
                   FROM relations r
                   JOIN entities src ON src.id = r.source_entity_id
                   JOIN entities tgt ON tgt.id = r.target_entity_id
                   WHERE r.org_id = ? AND (r.source_entity_id = ? OR r.target_entity_id = ?)""",
                (entity_id, entity_id, entity_id, entity_id, org_id, entity_id, entity_id),
            ).fetchall()
        return [_row_to_dict(row) for row in rows]

    def get_snapshot(self, org_id: str) -> dict:
        entities = self.list_entities(org_id)
        id_map = {e["id"]: e for e in entities}
        with self._conn() as conn:
            rows = conn.execute(
                "SELECT * FROM relations WHERE org_id = ?", (org_id,)
            ).fetchall()
        edges = []
        for row in rows:
            rel = _row_to_dict(row)
            src = id_map.get(rel["source_entity_id"])
            tgt = id_map.get(rel["target_entity_id"])
            if not src or not tgt:
                continue
            edges.append(
                {
                    "id": rel["id"],
                    "source_id": rel["source_entity_id"],
                    "target_id": rel["target_entity_id"],
                    "source_name": src["name"],
                    "target_name": tgt["name"],
                    "relation_type": rel["relation_type"],
                    "weight": rel.get("weight", 1.0),
                }
            )
        nodes = [
            {
                "id": e["id"],
                "name": e["name"],
                "entity_type": e["entity_type"],
                "wiki_path": e.get("wiki_path") or "",
            }
            for e in entities
        ]
        return {
            "nodes": nodes,
            "edges": edges,
            "stats": {
                "node_count": len(nodes),
                "edge_count": len(edges),
            },
        }


def _row_to_dict(row: sqlite3.Row) -> dict:
    d = dict(row)
    if "attributes" in d:
        d["attributes"] = json.loads(d["attributes"])
    if "metadata" in d:
        d["metadata"] = json.loads(d["metadata"])
    return d
