"""Shared fixtures for integrations tests."""

from __future__ import annotations

import sys
from pathlib import Path

import pytest

_ROOT = Path(__file__).resolve().parents[2]
if str(_ROOT) not in sys.path:
    sys.path.insert(0, str(_ROOT))


def postgres_available() -> bool:
    try:
        import psycopg

        from knowledge_base import config

        with psycopg.connect(config.DATABASE_URL, connect_timeout=2) as conn:
            conn.execute("SELECT 1")
        return True
    except Exception:
        return False


requires_postgres = pytest.mark.skipif(
    not postgres_available(),
    reason="PostgreSQL not available (start local PG or set DATABASE_URL)",
)
