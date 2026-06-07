import sqlite3
from dataclasses import dataclass, asdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional


@dataclass
class SourceRecord:
    id: str
    org_id: str
    filename: str
    file_path: str
    source_type: str
    status: str  # uploaded | compiling | done | error
    created_at: str
    error: Optional[str] = None
    entities_extracted: Optional[int] = None
    workflows_extracted: Optional[int] = None
    wiki_pages_created: Optional[int] = None


class SourceRegistry:
    def __init__(self, db_path: Path):
        db_path.parent.mkdir(parents=True, exist_ok=True)
        self._db = str(db_path)
        self._init()

    def _conn(self):
        conn = sqlite3.connect(self._db)
        conn.row_factory = sqlite3.Row
        return conn

    def _init(self):
        with self._conn() as conn:
            conn.execute("""
                CREATE TABLE IF NOT EXISTS sources (
                    id                  TEXT PRIMARY KEY,
                    org_id              TEXT NOT NULL,
                    filename            TEXT NOT NULL,
                    file_path           TEXT NOT NULL,
                    source_type         TEXT NOT NULL,
                    status              TEXT NOT NULL DEFAULT 'uploaded',
                    created_at          TEXT NOT NULL,
                    error               TEXT,
                    entities_extracted  INTEGER,
                    workflows_extracted INTEGER,
                    wiki_pages_created  INTEGER
                )
            """)

    def add(self, record: SourceRecord) -> SourceRecord:
        with self._conn() as conn:
            conn.execute(
                """INSERT INTO sources VALUES (
                    :id, :org_id, :filename, :file_path, :source_type,
                    :status, :created_at, :error, :entities_extracted,
                    :workflows_extracted, :wiki_pages_created
                )""",
                asdict(record),
            )
        return record

    def list(self, org_id: str) -> list[SourceRecord]:
        with self._conn() as conn:
            rows = conn.execute(
                "SELECT * FROM sources WHERE org_id = ? ORDER BY created_at DESC",
                (org_id,),
            ).fetchall()
        return [SourceRecord(**dict(r)) for r in rows]

    def get(self, source_id: str) -> Optional[SourceRecord]:
        with self._conn() as conn:
            row = conn.execute(
                "SELECT * FROM sources WHERE id = ?", (source_id,)
            ).fetchone()
        return SourceRecord(**dict(row)) if row else None

    def update(self, source_id: str, **kwargs):
        if not kwargs:
            return
        sets = ", ".join(f"{k} = ?" for k in kwargs)
        values = list(kwargs.values()) + [source_id]
        with self._conn() as conn:
            conn.execute(f"UPDATE sources SET {sets} WHERE id = ?", values)

    @staticmethod
    def now_iso() -> str:
        return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
