import json
import sqlite3
from dataclasses import asdict
from pathlib import Path
from typing import Optional

from agent_engine.models.task import Task

_JSON_FIELDS = frozenset({"steps", "plan", "queue", "checkpoints", "reflections", "constraints"})


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
            self._migrate(conn)

    def _migrate(self, conn: sqlite3.Connection) -> None:
        cols = {row[1] for row in conn.execute("PRAGMA table_info(tasks)").fetchall()}
        additions = [
            ("task_type", "TEXT NOT NULL DEFAULT 'generic_goal'"),
            ("rubric_id", "TEXT NOT NULL DEFAULT ''"),
            ("constraints", "TEXT DEFAULT '{}'"),
            ("phase", "TEXT NOT NULL DEFAULT 'pending'"),
            ("plan", "TEXT"),
            ("queue", "TEXT DEFAULT '[]'"),
            ("checkpoints", "TEXT DEFAULT '{}'"),
            ("reflections", "TEXT DEFAULT '[]'"),
            ("score", "INTEGER"),
            ("experience_id", "TEXT"),
            ("pending_step_id", "TEXT"),
            ("reflection_report", "TEXT"),
        ]
        for name, ddl in additions:
            if name not in cols:
                conn.execute(f"ALTER TABLE tasks ADD COLUMN {name} {ddl}")

    def add(self, task: Task) -> Task:
        d = asdict(task)
        with self._conn() as conn:
            conn.execute(
                """INSERT INTO tasks (
                    id, org_id, input, status, steps, result, error, created_at, completed_at,
                    task_type, rubric_id, constraints, phase, plan, queue, checkpoints,
                    reflections, score, experience_id, pending_step_id, reflection_report
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                (
                    d["id"], d["org_id"], d["input"], d["status"],
                    self._dump_json(d["steps"]),
                    d["result"], d["error"], d["created_at"], d["completed_at"],
                    d["task_type"], d["rubric_id"],
                    self._dump_json(d["constraints"]),
                    d["phase"],
                    self._dump_json(d["plan"]) if d["plan"] is not None else None,
                    self._dump_json(d["queue"]),
                    self._dump_json(d["checkpoints"]),
                    self._dump_json(d["reflections"]),
                    d["score"], d["experience_id"], d["pending_step_id"],
                    d.get("reflection_report"),
                ),
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
        for key in list(kwargs.keys()):
            if key in _JSON_FIELDS and isinstance(kwargs[key], (list, dict)):
                kwargs[key] = self._dump_json(kwargs[key])
            elif key == "plan" and kwargs[key] is not None and isinstance(kwargs[key], dict):
                kwargs[key] = self._dump_json(kwargs[key])
        sets = ", ".join(f"{k} = ?" for k in kwargs)
        with self._conn() as conn:
            conn.execute(f"UPDATE tasks SET {sets} WHERE id = ?", [*kwargs.values(), task_id])

    @staticmethod
    def _dump_json(value) -> str:
        return json.dumps(value, ensure_ascii=False)

    @staticmethod
    def _load_json(value, default):
        if value is None:
            return default
        if isinstance(value, (list, dict)):
            return value
        return json.loads(value)

    @classmethod
    def _from_row(cls, row: sqlite3.Row) -> Task:
        d = dict(row)
        d["steps"] = cls._load_json(d.get("steps"), [])
        d["constraints"] = cls._load_json(d.get("constraints"), {})
        d["plan"] = cls._load_json(d.get("plan"), None) if d.get("plan") else None
        d["queue"] = cls._load_json(d.get("queue"), [])
        d["checkpoints"] = cls._load_json(d.get("checkpoints"), {})
        d["reflections"] = cls._load_json(d.get("reflections"), [])
        for key in ("task_type", "rubric_id", "phase"):
            d.setdefault(key, "pending" if key == "phase" else ("generic_goal" if key == "task_type" else ""))
        return Task(**{k: d[k] for k in Task.__dataclass_fields__})
