#!/usr/bin/env python3
"""Apply SQL migrations in db/migrations/ to PostgreSQL."""

from __future__ import annotations

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
    for path in (ROOT / ".env", ROOT / "webui" / ".env", ROOT / ".env.local"):
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


def main() -> int:
    load_dotenv()
    url = database_url()

    try:
        import psycopg
    except ImportError:
        print("Install psycopg: pip install 'psycopg[binary]'", file=sys.stderr)
        return 1

    files = sorted(MIGRATIONS_DIR.glob("*.sql"))
    if not files:
        print(f"No migrations in {MIGRATIONS_DIR}", file=sys.stderr)
        return 1

    print(f"Connecting to {url.split('@')[-1]} …")
    with psycopg.connect(url) as conn:
        conn.autocommit = True
        for path in files:
            sql = path.read_text(encoding="utf-8")
            print(f"Applying {path.name} …")
            conn.execute(sql)
            print(f"  OK")

    print("Done.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
