from __future__ import annotations

import json
import sqlite3
from dataclasses import dataclass, field, asdict
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
    wiki_pages: list[str] = field(default_factory=list)
    collection: Optional[str] = None  # 虚拟集合（逻辑分类，不改变 raw 物理路径）


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
                    wiki_pages_created  INTEGER,
                    wiki_pages          TEXT DEFAULT '[]'
                )
            """)
            # 兼容旧表：若列不存在则添加
            for ddl in (
                "ALTER TABLE sources ADD COLUMN wiki_pages TEXT DEFAULT '[]'",
                "ALTER TABLE sources ADD COLUMN collection TEXT DEFAULT NULL",
            ):
                try:
                    conn.execute(ddl)
                except sqlite3.OperationalError:
                    pass  # 列已存在

    def add(self, record: SourceRecord) -> SourceRecord:
        with self._conn() as conn:
            conn.execute(
                """INSERT INTO sources
                   (id, org_id, filename, file_path, source_type,
                    status, created_at, error, entities_extracted,
                    workflows_extracted, wiki_pages_created, wiki_pages, collection)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                (
                    record.id, record.org_id, record.filename, record.file_path,
                    record.source_type, record.status, record.created_at,
                    record.error, record.entities_extracted,
                    record.workflows_extracted, record.wiki_pages_created,
                    json.dumps(record.wiki_pages, ensure_ascii=False),
                    record.collection,
                ),
            )
        return record

    def list_collections(self, org_id: str) -> list[dict]:
        with self._conn() as conn:
            rows = conn.execute(
                """
                SELECT collection, COUNT(*) AS cnt
                FROM sources
                WHERE org_id = ? AND collection IS NOT NULL AND collection != ''
                GROUP BY collection
                ORDER BY collection COLLATE NOCASE
                """,
                (org_id,),
            ).fetchall()
        return [{"name": r[0], "count": r[1]} for r in rows]

    def count_uncategorized(self, org_id: str) -> int:
        with self._conn() as conn:
            row = conn.execute(
                """
                SELECT COUNT(*) FROM sources
                WHERE org_id = ? AND (collection IS NULL OR collection = '')
                """,
                (org_id,),
            ).fetchone()
        return int(row[0]) if row else 0

    def list(self, org_id: str) -> list[SourceRecord]:
        with self._conn() as conn:
            rows = conn.execute(
                "SELECT * FROM sources WHERE org_id = ? ORDER BY created_at DESC",
                (org_id,),
            ).fetchall()
        return [self._from_row(r) for r in rows]

    def list_for_wiki_page(self, org_id: str, wiki_path: str) -> list[SourceRecord]:
        return [
            s for s in self.list(org_id)
            if wiki_path in s.wiki_pages
        ]

    def get(self, source_id: str) -> Optional[SourceRecord]:
        with self._conn() as conn:
            row = conn.execute(
                "SELECT * FROM sources WHERE id = ?", (source_id,)
            ).fetchone()
        return self._from_row(row) if row else None

    def update(self, source_id: str, **kwargs):
        if not kwargs:
            return
        # wiki_pages list → JSON string
        if "wiki_pages" in kwargs and isinstance(kwargs["wiki_pages"], list):
            kwargs["wiki_pages"] = json.dumps(kwargs["wiki_pages"], ensure_ascii=False)
        sets = ", ".join(f"{k} = ?" for k in kwargs)
        values = list(kwargs.values()) + [source_id]
        with self._conn() as conn:
            conn.execute(f"UPDATE sources SET {sets} WHERE id = ?", values)

    def delete(self, source_id: str):
        with self._conn() as conn:
            conn.execute("DELETE FROM sources WHERE id = ?", (source_id,))

    @staticmethod
    def _from_row(row: sqlite3.Row) -> SourceRecord:
        d = dict(row)
        d["wiki_pages"] = json.loads(d.get("wiki_pages") or "[]")
        if "collection" not in d:
            d["collection"] = None
        return SourceRecord(**d)

    @staticmethod
    def now_iso() -> str:
        return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
