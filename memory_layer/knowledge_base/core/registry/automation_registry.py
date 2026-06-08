"""自动化任务运行记录 — SQLite 持久化。"""

from __future__ import annotations

import json
import sqlite3
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Optional


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


class AutomationRegistry:
    def __init__(self, db_path: Path):
        db_path.parent.mkdir(parents=True, exist_ok=True)
        self._db = str(db_path)
        self._init()

    def _conn(self):
        conn = sqlite3.connect(self._db)
        conn.row_factory = sqlite3.Row
        return conn

    def _init(self) -> None:
        with self._conn() as conn:
            conn.execute("""
                CREATE TABLE IF NOT EXISTS automation_jobs (
                    org_id       TEXT NOT NULL,
                    id           TEXT NOT NULL,
                    label        TEXT NOT NULL,
                    description  TEXT NOT NULL DEFAULT '',
                    category     TEXT NOT NULL DEFAULT 'other',
                    cron_hint    TEXT NOT NULL DEFAULT '',
                    defaults     TEXT NOT NULL DEFAULT '{}',
                    builtin      INTEGER NOT NULL DEFAULT 0,
                    deleted      INTEGER NOT NULL DEFAULT 0,
                    updated_at   TEXT NOT NULL,
                    PRIMARY KEY (org_id, id)
                )
            """)
            conn.execute("""
                CREATE TABLE IF NOT EXISTS automation_runs (
                    id          TEXT PRIMARY KEY,
                    org_id      TEXT NOT NULL,
                    job_id      TEXT NOT NULL,
                    status      TEXT NOT NULL,
                    trigger     TEXT NOT NULL DEFAULT 'manual',
                    summary     TEXT,
                    error       TEXT,
                    started_at  TEXT NOT NULL,
                    finished_at TEXT
                )
            """)
            conn.execute(
                "CREATE INDEX IF NOT EXISTS idx_automation_runs_org_job "
                "ON automation_runs (org_id, job_id, started_at DESC)"
            )

    def ensure_job(self, org_id: str, job: dict, *, builtin: bool = False) -> dict:
        existing = self.get_job(org_id, job["id"], include_deleted=True)
        if existing:
            return existing if not existing.get("deleted") else existing
        defaults = json.dumps(job.get("defaults") or {}, ensure_ascii=False)
        with self._conn() as conn:
            conn.execute(
                """INSERT INTO automation_jobs
                   (org_id, id, label, description, category, cron_hint, defaults,
                    builtin, deleted, updated_at)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?)""",
                (
                    org_id,
                    job["id"],
                    job["label"],
                    job.get("description", ""),
                    job.get("category", "other"),
                    job.get("cron_hint", ""),
                    defaults,
                    1 if builtin else 0,
                    _now(),
                ),
            )
        return self.get_job(org_id, job["id"]) or {}

    def restore_job(self, org_id: str, job: dict) -> dict:
        defaults = json.dumps(job.get("defaults") or {}, ensure_ascii=False)
        with self._conn() as conn:
            conn.execute(
                """INSERT INTO automation_jobs
                   (org_id, id, label, description, category, cron_hint, defaults,
                    builtin, deleted, updated_at)
                   VALUES (?, ?, ?, ?, ?, ?, ?, 1, 0, ?)
                   ON CONFLICT(org_id, id) DO UPDATE SET
                     label = excluded.label,
                     description = excluded.description,
                     category = excluded.category,
                     cron_hint = excluded.cron_hint,
                     defaults = excluded.defaults,
                     builtin = 1,
                     deleted = 0,
                     updated_at = excluded.updated_at""",
                (
                    org_id,
                    job["id"],
                    job["label"],
                    job.get("description", ""),
                    job.get("category", "other"),
                    job.get("cron_hint", ""),
                    defaults,
                    _now(),
                ),
            )
        return self.get_job(org_id, job["id"]) or {}

    def get_job(self, org_id: str, job_id: str, *, include_deleted: bool = False) -> Optional[dict]:
        with self._conn() as conn:
            row = conn.execute(
                """SELECT * FROM automation_jobs
                   WHERE org_id = ? AND id = ?"""
                + ("" if include_deleted else " AND deleted = 0"),
                (org_id, job_id),
            ).fetchone()
        return self._job_row_to_dict(row) if row else None

    def list_jobs(self, org_id: str) -> list[dict]:
        with self._conn() as conn:
            rows = conn.execute(
                """SELECT * FROM automation_jobs
                   WHERE org_id = ? AND deleted = 0
                   ORDER BY builtin DESC, id ASC""",
                (org_id,),
            ).fetchall()
        return [self._job_row_to_dict(r) for r in rows]

    def update_job(self, org_id: str, job_id: str, patch: dict) -> Optional[dict]:
        allowed = {"label", "description", "category", "cron_hint", "defaults"}
        updates = {k: v for k, v in patch.items() if k in allowed and v is not None}
        if not updates:
            return self.get_job(org_id, job_id)
        if "defaults" in updates and isinstance(updates["defaults"], dict):
            updates["defaults"] = json.dumps(updates["defaults"], ensure_ascii=False)
        updates["updated_at"] = _now()
        sets = ", ".join(f"{k} = ?" for k in updates)
        with self._conn() as conn:
            cur = conn.execute(
                f"""UPDATE automation_jobs SET {sets}
                    WHERE org_id = ? AND id = ? AND deleted = 0""",
                [*updates.values(), org_id, job_id],
            )
            if cur.rowcount == 0:
                return None
        return self.get_job(org_id, job_id)

    def delete_job(self, org_id: str, job_id: str) -> bool:
        with self._conn() as conn:
            cur = conn.execute(
                """UPDATE automation_jobs SET deleted = 1, updated_at = ?
                   WHERE org_id = ? AND id = ? AND deleted = 0""",
                (_now(), org_id, job_id),
            )
            return cur.rowcount > 0

    def delete_run(self, org_id: str, run_id: str) -> bool:
        with self._conn() as conn:
            cur = conn.execute(
                "DELETE FROM automation_runs WHERE org_id = ? AND id = ?",
                (org_id, run_id),
            )
            return cur.rowcount > 0

    def start(self, org_id: str, job_id: str, trigger: str = "manual") -> str:
        run_id = str(uuid.uuid4())
        with self._conn() as conn:
            conn.execute(
                """INSERT INTO automation_runs
                   (id, org_id, job_id, status, trigger, started_at)
                   VALUES (?, ?, ?, 'running', ?, ?)""",
                (run_id, org_id, job_id, trigger, _now()),
            )
        return run_id

    def finish(
        self,
        run_id: str,
        *,
        status: str,
        summary: dict[str, Any] | None = None,
        error: str | None = None,
    ) -> None:
        with self._conn() as conn:
            conn.execute(
                """UPDATE automation_runs
                   SET status = ?, summary = ?, error = ?, finished_at = ?
                   WHERE id = ?""",
                (
                    status,
                    json.dumps(summary or {}, ensure_ascii=False) if summary else None,
                    error,
                    _now(),
                    run_id,
                ),
            )

    def get(self, run_id: str) -> Optional[dict]:
        with self._conn() as conn:
            row = conn.execute(
                "SELECT * FROM automation_runs WHERE id = ?", (run_id,)
            ).fetchone()
        return self._row_to_dict(row) if row else None

    def list_runs(
        self,
        org_id: str,
        *,
        job_id: str | None = None,
        limit: int = 50,
    ) -> list[dict]:
        with self._conn() as conn:
            if job_id:
                rows = conn.execute(
                    """SELECT * FROM automation_runs
                       WHERE org_id = ? AND job_id = ?
                       ORDER BY started_at DESC LIMIT ?""",
                    (org_id, job_id, limit),
                ).fetchall()
            else:
                rows = conn.execute(
                    """SELECT * FROM automation_runs
                       WHERE org_id = ?
                       ORDER BY started_at DESC LIMIT ?""",
                    (org_id, limit),
                ).fetchall()
        return [self._row_to_dict(r) for r in rows]

    def last_run(self, org_id: str, job_id: str) -> Optional[dict]:
        runs = self.list_runs(org_id, job_id=job_id, limit=1)
        return runs[0] if runs else None

    @staticmethod
    def _job_row_to_dict(row: sqlite3.Row) -> dict:
        d = dict(row)
        d["builtin"] = bool(d.get("builtin"))
        d["deleted"] = bool(d.get("deleted"))
        if d.get("defaults"):
            try:
                d["defaults"] = json.loads(d["defaults"])
            except json.JSONDecodeError:
                d["defaults"] = {}
        return d

    @staticmethod
    def _row_to_dict(row: sqlite3.Row) -> dict:
        d = dict(row)
        if d.get("summary"):
            try:
                d["summary"] = json.loads(d["summary"])
            except json.JSONDecodeError:
                pass
        return d
