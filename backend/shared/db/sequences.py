"""Repair BIGSERIAL sequences after manual imports or restores."""

from __future__ import annotations

_SERIAL_TABLES = (
    ("chat_messages", "id"),
    ("memories", "id"),
    ("memory_events", "id"),
    ("memory_sources", "id"),
    ("knowledge_candidates", "id"),
)


def repair_serial_sequences(conn) -> list[str]:
    fixed: list[str] = []
    for table, col in _SERIAL_TABLES:
        seq = conn.execute(
            "SELECT pg_get_serial_sequence(%s, %s)",
            (table, col),
        ).fetchone()
        if not seq or not seq[0]:
            continue
        row = conn.execute(f"SELECT COALESCE(MAX({col}), 0) FROM {table}").fetchone()
        max_id = int(row[0]) if row else 0
        conn.execute("SELECT setval(%s, %s, %s)", (seq[0], max_id, True))
        fixed.append(f"{table}.{col} → next {max_id + 1}")
    return fixed
