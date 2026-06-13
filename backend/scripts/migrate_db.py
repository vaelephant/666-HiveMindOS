#!/usr/bin/env python3
"""
Apply pending SQL migrations in db/migrations/ to PostgreSQL.

Tracks applied versions in schema_migrations (created by 001_memory_layer.sql).

Usage:
    python scripts/migrate_db.py              # apply all pending
    python scripts/migrate_db.py --list       # show status only
    python scripts/migrate_db.py 006          # apply from 006 onward
    python scripts/migrate_db.py --only 006_memory_sources_ingest
"""

from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MIGRATIONS_DIR = ROOT / "db" / "migrations"


def load_dotenv() -> None:
    try:
        from dotenv import load_dotenv as _load
    except ImportError:
        return
    for path in (ROOT.parent / ".env", ROOT.parent / "webui" / ".env", ROOT.parent / ".env.local"):
        if path.is_file():
            _load(path, override=False)


def database_url() -> str:
    url = os.environ.get("DATABASE_URL")
    if url:
        return url
    host = os.environ.get("DB_HOST", "localhost")
    port = os.environ.get("DB_PORT", "5432")
    user = os.environ.get("DB_USER", "postgres")
    password = os.environ.get("DB_PASSWORD", "")
    name = os.environ.get("DB_NAME", "hivemindos")
    return f"postgresql://{user}:{password}@{host}:{port}/{name}"


def migration_version(path: Path) -> str:
    return path.stem  # e.g. 006_memory_sources_ingest


def sorted_migrations() -> list[Path]:
    return sorted(MIGRATIONS_DIR.glob("*.sql"), key=lambda p: p.name)


def fetch_applied(conn) -> set[str]:
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS schema_migrations (
            version     TEXT PRIMARY KEY,
            applied_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
        """
    )
    rows = conn.execute("SELECT version FROM schema_migrations").fetchall()
    return {r[0] for r in rows}


def repair_sequences(url: str) -> None:
    sys.path.insert(0, str(ROOT))
    from knowledge_base.core.db.sequences import repair_serial_sequences

    import psycopg

    with psycopg.connect(url) as conn:
        conn.autocommit = False
        fixed = repair_serial_sequences(conn)
        conn.commit()
    for line in fixed:
        print(f"  sequence  {line}")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Apply PostgreSQL migrations")
    parser.add_argument(
        "from_prefix",
        nargs="?",
        help="Only run migrations whose filename starts with this prefix (e.g. 006)",
    )
    parser.add_argument(
        "--only",
        metavar="VERSION",
        help="Run a single migration by full version name (e.g. 006_memory_sources_ingest)",
    )
    parser.add_argument(
        "--list",
        action="store_true",
        help="List migration status and exit",
    )
    return parser.parse_args()


def main() -> int:
    load_dotenv()
    args = parse_args()
    url = database_url()

    try:
        import psycopg
    except ImportError:
        print("Install psycopg: pip install 'psycopg[binary]'", file=sys.stderr)
        return 1

    files = sorted_migrations()
    if not files:
        print(f"No migrations in {MIGRATIONS_DIR}", file=sys.stderr)
        return 1

    if args.from_prefix:
        files = [f for f in files if f.name.startswith(args.from_prefix)]
    if args.only:
        files = [f for f in files if migration_version(f) == args.only]
        if not files:
            print(f"Migration not found: {args.only}", file=sys.stderr)
            return 1

    print(f"Connecting to {url.split('@')[-1]} …")

    with psycopg.connect(url) as conn:
        conn.autocommit = True
        applied = fetch_applied(conn)

        if args.list:
            for path in sorted_migrations():
                version = migration_version(path)
                status = "applied" if version in applied else "pending"
                print(f"  [{status:7}]  {path.name}")
            return 0

        pending = [f for f in files if migration_version(f) not in applied]
        if not pending:
            print("No pending migrations.")
            return 0

        for path in pending:
            version = migration_version(path)
            sql = path.read_text(encoding="utf-8")
            print(f"Applying {path.name} …")
            try:
                conn.execute(sql)
            except Exception as exc:
                print(f"  FAILED: {exc}", file=sys.stderr)
                return 1
            # 若 SQL 未写入 schema_migrations，由脚本补记
            conn.execute(
                """
                INSERT INTO schema_migrations (version)
                VALUES (%s)
                ON CONFLICT (version) DO NOTHING
                """,
                (version,),
            )
            print("  OK")

    repair_sequences(url)
    print("Done.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
