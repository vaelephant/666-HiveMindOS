"""PostgreSQL connection helper for Memory Layer."""

from __future__ import annotations

import atexit
from contextlib import contextmanager
from typing import Iterator

from memory_layer.knowledge_base import config

_pool = None
_pool_atexit_registered = False


def close_pool() -> None:
    """Drain and close the global pool (CLI scripts / process shutdown)."""
    global _pool
    if _pool is None:
        return
    try:
        _pool.close()
    except Exception:
        pass
    _pool = None


def _get_pool():
    global _pool, _pool_atexit_registered
    if _pool is None:
        import psycopg_pool
        _pool = psycopg_pool.ConnectionPool(
            conninfo=config.DATABASE_URL,
            min_size=1,
            max_size=10,
            open=True,
        )
        if not _pool_atexit_registered:
            atexit.register(close_pool)
            _pool_atexit_registered = True
    return _pool


@contextmanager
def pg_conn() -> Iterator:
    pool = _get_pool()
    with pool.connection() as conn:
        yield conn
