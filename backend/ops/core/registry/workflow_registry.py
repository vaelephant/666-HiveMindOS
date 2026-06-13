"""工作流定义与运行记录 — SQLite 持久化。"""

from __future__ import annotations

import json
import sqlite3
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Optional


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


class WorkflowRegistry:
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
                CREATE TABLE IF NOT EXISTS workflows (
                    org_id       TEXT NOT NULL,
                    id           TEXT NOT NULL,
                    label        TEXT NOT NULL,
                    description  TEXT NOT NULL DEFAULT '',
                    category     TEXT NOT NULL DEFAULT 'mixed',
                    cron_hint    TEXT NOT NULL DEFAULT '',
                    enabled      INTEGER NOT NULL DEFAULT 1,
                    steps        TEXT NOT NULL DEFAULT '[]',
                    yaml_source  TEXT NOT NULL DEFAULT '',
                    builtin      INTEGER NOT NULL DEFAULT 0,
                    deleted      INTEGER NOT NULL DEFAULT 0,
                    updated_at   TEXT NOT NULL,
                    PRIMARY KEY (org_id, id)
                )
            """)
            conn.execute("""
                CREATE TABLE IF NOT EXISTS workflow_runs (
                    id          TEXT PRIMARY KEY,
                    org_id      TEXT NOT NULL,
                    workflow_id TEXT NOT NULL,
                    status      TEXT NOT NULL,
                    trigger     TEXT NOT NULL DEFAULT 'manual',
                    summary     TEXT,
                    error       TEXT,
                    started_at  TEXT NOT NULL,
                    finished_at TEXT
                )
            """)
            conn.execute(
                "CREATE INDEX IF NOT EXISTS idx_workflow_runs_org "
                "ON workflow_runs (org_id, workflow_id, started_at DESC)"
            )
            self._migrate(conn)

    def _migrate(self, conn) -> None:
        cols = {row[1] for row in conn.execute("PRAGMA table_info(workflows)").fetchall()}
        if "schedule_enabled" not in cols:
            conn.execute(
                "ALTER TABLE workflows ADD COLUMN schedule_enabled INTEGER NOT NULL DEFAULT 0"
            )
        if "schedule_user_id" not in cols:
            conn.execute(
                "ALTER TABLE workflows ADD COLUMN schedule_user_id TEXT NOT NULL DEFAULT 'demo'"
            )
        if "last_cron_at" not in cols:
            conn.execute("ALTER TABLE workflows ADD COLUMN last_cron_at TEXT")

    def upsert(
        self,
        org_id: str,
        wf: dict,
        *,
        yaml_source: str = "",
        builtin: bool = False,
    ) -> dict:
        steps = json.dumps(wf.get("steps") or [], ensure_ascii=False)
        schedule_enabled = 1 if wf.get("schedule_enabled") else 0
        schedule_user_id = (wf.get("schedule_user_id") or "demo").strip() or "demo"
        with self._conn() as conn:
            conn.execute(
                """INSERT INTO workflows
                   (org_id, id, label, description, category, cron_hint, enabled,
                    schedule_enabled, schedule_user_id, steps, yaml_source, builtin,
                    deleted, updated_at)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?)
                   ON CONFLICT(org_id, id) DO UPDATE SET
                     label = excluded.label,
                     description = excluded.description,
                     category = excluded.category,
                     cron_hint = excluded.cron_hint,
                     enabled = excluded.enabled,
                     schedule_enabled = excluded.schedule_enabled,
                     schedule_user_id = excluded.schedule_user_id,
                     steps = excluded.steps,
                     yaml_source = excluded.yaml_source,
                     builtin = excluded.builtin,
                     deleted = 0,
                     updated_at = excluded.updated_at""",
                (
                    org_id,
                    wf["id"],
                    wf.get("label") or wf["id"],
                    wf.get("description") or "",
                    wf.get("category") or "mixed",
                    wf.get("cron_hint") or "",
                    1 if wf.get("enabled", True) else 0,
                    schedule_enabled,
                    schedule_user_id,
                    steps,
                    yaml_source,
                    1 if builtin else 0,
                    _now(),
                ),
            )
        row = self.get(org_id, wf["id"])
        return row or {}

    def get(self, org_id: str, workflow_id: str, *, include_deleted: bool = False) -> Optional[dict]:
        with self._conn() as conn:
            row = conn.execute(
                """SELECT * FROM workflows WHERE org_id = ? AND id = ?"""
                + ("" if include_deleted else " AND deleted = 0"),
                (org_id, workflow_id),
            ).fetchone()
        return self._wf_row_to_dict(row) if row else None

    def list_workflows(self, org_id: str) -> list[dict]:
        with self._conn() as conn:
            rows = conn.execute(
                """SELECT * FROM workflows
                   WHERE org_id = ? AND deleted = 0
                   ORDER BY builtin DESC, id ASC""",
                (org_id,),
            ).fetchall()
        return [self._wf_row_to_dict(r) for r in rows]

    def list_scheduled(self, org_id: str | None = None) -> list[dict]:
        with self._conn() as conn:
            if org_id:
                rows = conn.execute(
                    """SELECT * FROM workflows
                       WHERE org_id = ? AND deleted = 0 AND enabled = 1
                         AND schedule_enabled = 1 AND cron_hint != ''
                       ORDER BY org_id, id""",
                    (org_id,),
                ).fetchall()
            else:
                rows = conn.execute(
                    """SELECT * FROM workflows
                       WHERE deleted = 0 AND enabled = 1
                         AND schedule_enabled = 1 AND cron_hint != ''
                       ORDER BY org_id, id"""
                ).fetchall()
        return [self._wf_row_to_dict(r) for r in rows]

    def set_schedule(
        self,
        org_id: str,
        workflow_id: str,
        *,
        enabled: bool,
        user_id: str | None = None,
    ) -> Optional[dict]:
        sets = ["schedule_enabled = ?", "updated_at = ?"]
        params: list[Any] = [1 if enabled else 0, _now()]
        if user_id is not None:
            sets.append("schedule_user_id = ?")
            params.append(user_id or "demo")
        params.extend([org_id, workflow_id])
        with self._conn() as conn:
            cur = conn.execute(
                f"""UPDATE workflows SET {", ".join(sets)}
                    WHERE org_id = ? AND id = ? AND deleted = 0""",
                params,
            )
            if cur.rowcount == 0:
                return None
        return self.get(org_id, workflow_id)

    def mark_cron_slot(self, org_id: str, workflow_id: str, slot_iso: str) -> None:
        with self._conn() as conn:
            conn.execute(
                """UPDATE workflows SET last_cron_at = ?, updated_at = ?
                   WHERE org_id = ? AND id = ?""",
                (slot_iso, _now(), org_id, workflow_id),
            )

    def delete(self, org_id: str, workflow_id: str) -> bool:
        with self._conn() as conn:
            cur = conn.execute(
                """UPDATE workflows SET deleted = 1, updated_at = ?
                   WHERE org_id = ? AND id = ? AND deleted = 0""",
                (_now(), org_id, workflow_id),
            )
            return cur.rowcount > 0

    def restore_builtin(self, org_id: str, wf: dict, yaml_source: str) -> dict:
        return self.upsert(org_id, wf, yaml_source=yaml_source, builtin=True)

    def start(self, org_id: str, workflow_id: str, trigger: str = "manual") -> str:
        run_id = str(uuid.uuid4())
        with self._conn() as conn:
            conn.execute(
                """INSERT INTO workflow_runs
                   (id, org_id, workflow_id, status, trigger, started_at)
                   VALUES (?, ?, ?, 'running', ?, ?)""",
                (run_id, org_id, workflow_id, trigger, _now()),
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
                """UPDATE workflow_runs
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

    def get_run(self, run_id: str) -> Optional[dict]:
        with self._conn() as conn:
            row = conn.execute(
                "SELECT * FROM workflow_runs WHERE id = ?", (run_id,)
            ).fetchone()
        return self._run_row_to_dict(row) if row else None

    def list_runs(
        self,
        org_id: str,
        *,
        workflow_id: str | None = None,
        limit: int = 50,
    ) -> list[dict]:
        with self._conn() as conn:
            if workflow_id:
                rows = conn.execute(
                    """SELECT * FROM workflow_runs
                       WHERE org_id = ? AND workflow_id = ?
                       ORDER BY started_at DESC LIMIT ?""",
                    (org_id, workflow_id, limit),
                ).fetchall()
            else:
                rows = conn.execute(
                    """SELECT * FROM workflow_runs
                       WHERE org_id = ?
                       ORDER BY started_at DESC LIMIT ?""",
                    (org_id, limit),
                ).fetchall()
        return [self._run_row_to_dict(r) for r in rows]

    def last_run(self, org_id: str, workflow_id: str) -> Optional[dict]:
        runs = self.list_runs(org_id, workflow_id=workflow_id, limit=1)
        return runs[0] if runs else None

    def delete_run(self, org_id: str, run_id: str) -> bool:
        with self._conn() as conn:
            cur = conn.execute(
                "DELETE FROM workflow_runs WHERE org_id = ? AND id = ?",
                (org_id, run_id),
            )
            return cur.rowcount > 0

    @staticmethod
    def _wf_row_to_dict(row: sqlite3.Row) -> dict:
        d = dict(row)
        d["enabled"] = bool(d.get("enabled"))
        d["schedule_enabled"] = bool(d.get("schedule_enabled"))
        d["builtin"] = bool(d.get("builtin"))
        d["deleted"] = bool(d.get("deleted"))
        if d.get("steps"):
            try:
                d["steps"] = json.loads(d["steps"])
            except json.JSONDecodeError:
                d["steps"] = []
        else:
            d["steps"] = []
        return d

    @staticmethod
    def _run_row_to_dict(row: sqlite3.Row) -> dict:
        d = dict(row)
        if d.get("summary"):
            try:
                d["summary"] = json.loads(d["summary"])
            except json.JSONDecodeError:
                pass
        return d
