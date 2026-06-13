"""Backward-compatible re-export — prefer `from shared.db.postgres import pg_conn`."""

from shared.db.postgres import close_pool, pg_conn

__all__ = ["close_pool", "pg_conn"]
