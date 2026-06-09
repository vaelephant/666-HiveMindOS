"""agent_experience — 成功任务路径沉淀。"""

from __future__ import annotations

import json
import sqlite3
import uuid
from pathlib import Path

from memory_layer.knowledge_base.settings import load


class ExperienceRegistry:
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
                CREATE TABLE IF NOT EXISTS agent_experience (
                    id           TEXT PRIMARY KEY,
                    org_id       TEXT NOT NULL,
                    task_type    TEXT NOT NULL,
                    goal         TEXT NOT NULL,
                    success      INTEGER NOT NULL,
                    score        INTEGER,
                    workflow     TEXT NOT NULL,
                    reflection   TEXT,
                    final_output TEXT,
                    tags         TEXT DEFAULT '[]',
                    created_at   TEXT NOT NULL
                )
            """)
            conn.execute(
                "CREATE INDEX IF NOT EXISTS idx_exp_org_type ON agent_experience(org_id, task_type)"
            )

    def save(
        self,
        org_id: str,
        task_type: str,
        goal: str,
        *,
        success: bool,
        score: int | None,
        workflow: list | dict,
        reflection: dict | None = None,
        final_output: str | None = None,
        tags: list[str] | None = None,
    ) -> str:
        exp_id = str(uuid.uuid4())
        with self._conn() as conn:
            conn.execute(
                """INSERT INTO agent_experience
                   (id, org_id, task_type, goal, success, score, workflow, reflection,
                    final_output, tags, created_at)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))""",
                (
                    exp_id, org_id, task_type, goal,
                    1 if success else 0, score,
                    json.dumps(workflow, ensure_ascii=False),
                    json.dumps(reflection or {}, ensure_ascii=False),
                    (final_output or "")[:2000],
                    json.dumps(tags or [], ensure_ascii=False),
                ),
            )
        return exp_id

    def latest_high_score(
        self,
        org_id: str,
        task_type: str,
        *,
        min_score: int | None = None,
        limit: int = 1,
    ) -> list[dict]:
        min_score = min_score or int(load("task_gates").get("experience_min_score") or 80)
        with self._conn() as conn:
            rows = conn.execute(
                """
                SELECT * FROM agent_experience
                WHERE org_id = ? AND task_type = ? AND success = 1 AND score >= ?
                ORDER BY score DESC, created_at DESC
                LIMIT ?
                """,
                (org_id, task_type, min_score, limit),
            ).fetchall()
        out = []
        for r in rows:
            d = dict(r)
            d["workflow"] = json.loads(d.get("workflow") or "[]")
            d["reflection"] = json.loads(d.get("reflection") or "{}")
            d["tags"] = json.loads(d.get("tags") or "[]")
            d["success"] = bool(d["success"])
            out.append(d)
        return out

    def list_recent(self, org_id: str, limit: int = 20) -> list[dict]:
        with self._conn() as conn:
            rows = conn.execute(
                """
                SELECT id, org_id, task_type, goal, success, score, created_at
                FROM agent_experience
                WHERE org_id = ?
                ORDER BY created_at DESC
                LIMIT ?
                """,
                (org_id, limit),
            ).fetchall()
        return [dict(r) for r in rows]
