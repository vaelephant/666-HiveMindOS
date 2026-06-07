import json
import sqlite3
from dataclasses import asdict
from pathlib import Path
from typing import Optional

from memory_layer.knowledge_base.models.task import Task


class TaskRegistry:
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
                CREATE TABLE IF NOT EXISTS tasks (
                    id           TEXT PRIMARY KEY,
                    org_id       TEXT NOT NULL,
                    input        TEXT NOT NULL,
                    status       TEXT NOT NULL DEFAULT 'pending',
                    steps        TEXT DEFAULT '[]',
                    result       TEXT,
                    error        TEXT,
                    created_at   TEXT NOT NULL,
                    completed_at TEXT
                )
            """)

    def add(self, task: Task) -> Task:
        with self._conn() as conn:
            conn.execute(
                """INSERT INTO tasks (id, org_id, input, status, steps, result, error, created_at, completed_at)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                (task.id, task.org_id, task.input, task.status,
                 json.dumps(task.steps, ensure_ascii=False),
                 task.result, task.error, task.created_at, task.completed_at),
            )
        return task

    def get(self, task_id: str) -> Optional[Task]:
        with self._conn() as conn:
            row = conn.execute("SELECT * FROM tasks WHERE id = ?", (task_id,)).fetchone()
        return self._from_row(row) if row else None

    def list(self, org_id: str, limit: int = 20) -> list[Task]:
        with self._conn() as conn:
            rows = conn.execute(
                "SELECT * FROM tasks WHERE org_id = ? ORDER BY created_at DESC LIMIT ?",
                (org_id, limit),
            ).fetchall()
        return [self._from_row(r) for r in rows]

    def update(self, task_id: str, **kwargs):
        if not kwargs:
            return
        if "steps" in kwargs and isinstance(kwargs["steps"], list):
            kwargs["steps"] = json.dumps(kwargs["steps"], ensure_ascii=False)
        sets = ", ".join(f"{k} = ?" for k in kwargs)
        with self._conn() as conn:
            conn.execute(f"UPDATE tasks SET {sets} WHERE id = ?", [*kwargs.values(), task_id])

    @staticmethod
    def _from_row(row: sqlite3.Row) -> Task:
        d = dict(row)
        d["steps"] = json.loads(d.get("steps") or "[]")
        return Task(**d)
