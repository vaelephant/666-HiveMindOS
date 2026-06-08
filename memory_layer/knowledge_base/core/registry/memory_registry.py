"""
PostgreSQL persistence for structured memories — 智慧进化的持久化层（核心）。

Extractor 产出的 project / preference / decision 在此落库，
并记录 memory_events（进化时间线）与 memory_sources（溯源到 Chat）。
"""

from __future__ import annotations

import json
from typing import Optional

from memory_layer.knowledge_base.core.db.postgres import pg_conn
from memory_layer.knowledge_base.models.memory import Memory, MemoryCandidate, MemoryEvent, MemoryStats

from memory_layer.knowledge_base.core.domain.taxonomy import p1_memory_types

_P1_TYPES = p1_memory_types()


class MemoryRegistry:
    def list_active(
        self,
        org_id: str,
        user_id: str | None = None,
        memory_types: tuple[str, ...] = _P1_TYPES,
        limit: int = 50,
    ) -> list[Memory]:
        with pg_conn() as conn:
            if user_id:
                rows = conn.execute(
                    """
                    SELECT id, org_id, user_id, memory_type, title, content,
                           importance, status, source_type, source_id,
                           created_at::text, updated_at::text
                    FROM memories
                    WHERE org_id = %s AND user_id = %s AND status = 'active'
                      AND memory_type = ANY(%s)
                    ORDER BY importance DESC, updated_at DESC
                    LIMIT %s
                    """,
                    (org_id, user_id, list(memory_types), limit),
                ).fetchall()
            else:
                rows = conn.execute(
                    """
                    SELECT id, org_id, user_id, memory_type, title, content,
                           importance, status, source_type, source_id,
                           created_at::text, updated_at::text
                    FROM memories
                    WHERE org_id = %s AND status = 'active'
                      AND memory_type = ANY(%s)
                    ORDER BY importance DESC, updated_at DESC
                    LIMIT %s
                    """,
                    (org_id, list(memory_types), limit),
                ).fetchall()
        return [self._row_to_memory(r) for r in rows]

    def list_events(
        self,
        org_id: str,
        user_id: str | None = None,
        limit: int = 50,
    ) -> list[MemoryEvent]:
        with pg_conn() as conn:
            if user_id:
                rows = conn.execute(
                    """
                    SELECT e.id, e.memory_id, e.org_id, e.event_type,
                           e.old_content, e.new_content, e.created_at::text,
                           m.title, m.memory_type, m.source_id
                    FROM memory_events e
                    JOIN memories m ON m.id = e.memory_id
                    WHERE e.org_id = %s AND m.user_id = %s
                    ORDER BY e.created_at DESC
                    LIMIT %s
                    """,
                    (org_id, user_id, limit),
                ).fetchall()
            else:
                rows = conn.execute(
                    """
                    SELECT e.id, e.memory_id, e.org_id, e.event_type,
                           e.old_content, e.new_content, e.created_at::text,
                           m.title, m.memory_type, m.source_id
                    FROM memory_events e
                    JOIN memories m ON m.id = e.memory_id
                    WHERE e.org_id = %s
                    ORDER BY e.created_at DESC
                    LIMIT %s
                    """,
                    (org_id, limit),
                ).fetchall()
        return [self._row_to_event(r) for r in rows]

    def list_events_for_session(
        self,
        org_id: str,
        session_id: str,
        limit: int = 20,
    ) -> list[MemoryEvent]:
        with pg_conn() as conn:
            rows = conn.execute(
                """
                SELECT e.id, e.memory_id, e.org_id, e.event_type,
                       e.old_content, e.new_content, e.created_at::text,
                       m.title, m.memory_type, m.source_id
                FROM memory_events e
                JOIN memories m ON m.id = e.memory_id
                WHERE e.org_id = %s
                  AND (
                    m.source_id = %s
                    OR EXISTS (
                      SELECT 1 FROM memory_sources ms
                      WHERE ms.memory_id = m.id AND ms.source_id = %s
                    )
                  )
                ORDER BY e.created_at DESC
                LIMIT %s
                """,
                (org_id, session_id, session_id, limit),
            ).fetchall()
        return [self._row_to_event(r) for r in rows]

    def get_stats(self, org_id: str, user_id: str | None = None) -> MemoryStats:
        with pg_conn() as conn:
            if user_id:
                type_rows = conn.execute(
                    """
                    SELECT memory_type, COUNT(*)::int
                    FROM memories
                    WHERE org_id = %s AND user_id = %s AND status = 'active'
                      AND memory_type = ANY(%s)
                    GROUP BY memory_type
                    """,
                    (org_id, user_id, list(_P1_TYPES)),
                ).fetchall()
                memories_week = conn.execute(
                    """
                    SELECT COUNT(*)::int FROM memories
                    WHERE org_id = %s AND user_id = %s AND status = 'active'
                      AND created_at >= NOW() - INTERVAL '7 days'
                    """,
                    (org_id, user_id),
                ).fetchone()[0]
                events_week = conn.execute(
                    """
                    SELECT COUNT(*)::int FROM memory_events e
                    JOIN memories m ON m.id = e.memory_id
                    WHERE e.org_id = %s AND m.user_id = %s
                      AND e.created_at >= NOW() - INTERVAL '7 days'
                    """,
                    (org_id, user_id),
                ).fetchone()[0]
            else:
                type_rows = conn.execute(
                    """
                    SELECT memory_type, COUNT(*)::int
                    FROM memories
                    WHERE org_id = %s AND status = 'active'
                      AND memory_type = ANY(%s)
                    GROUP BY memory_type
                    """,
                    (org_id, list(_P1_TYPES)),
                ).fetchall()
                memories_week = conn.execute(
                    """
                    SELECT COUNT(*)::int FROM memories
                    WHERE org_id = %s AND status = 'active'
                      AND created_at >= NOW() - INTERVAL '7 days'
                    """,
                    (org_id,),
                ).fetchone()[0]
                events_week = conn.execute(
                    """
                    SELECT COUNT(*)::int FROM memory_events
                    WHERE org_id = %s
                      AND created_at >= NOW() - INTERVAL '7 days'
                    """,
                    (org_id,),
                ).fetchone()[0]

        counts = {t: 0 for t in _P1_TYPES}
        for mtype, cnt in type_rows:
            counts[mtype] = cnt
        total = sum(counts.values())
        vector_indexed = self._count_vector_indexed(org_id, user_id)
        return MemoryStats(
            total=total,
            project=counts["project"],
            preference=counts["preference"],
            decision=counts["decision"],
            events_this_week=events_week,
            memories_this_week=memories_week,
            vector_indexed=vector_indexed,
        )

    @staticmethod
    def _count_vector_indexed(org_id: str, user_id: str | None) -> int:
        with pg_conn() as conn:
            if user_id:
                row = conn.execute(
                    """
                    SELECT COUNT(*)::int FROM memories
                    WHERE org_id = %s AND user_id = %s AND status = 'active'
                      AND qdrant_point_id IS NOT NULL
                    """,
                    (org_id, user_id),
                ).fetchone()
            else:
                row = conn.execute(
                    """
                    SELECT COUNT(*)::int FROM memories
                    WHERE org_id = %s AND status = 'active'
                      AND qdrant_point_id IS NOT NULL
                    """,
                    (org_id,),
                ).fetchone()
        return row[0] if row else 0

    def get_by_id(self, memory_id: int, org_id: str) -> Optional[Memory]:
        with pg_conn() as conn:
            row = conn.execute(
                """
                SELECT id, org_id, user_id, memory_type, title, content,
                       importance, status, source_type, source_id,
                       created_at::text, updated_at::text
                FROM memories
                WHERE id = %s AND org_id = %s
                """,
                (memory_id, org_id),
            ).fetchone()
        return self._row_to_memory(row) if row else None

    def get_by_ids(self, org_id: str, memory_ids: list[int]) -> list[Memory]:
        if not memory_ids:
            return []
        with pg_conn() as conn:
            rows = conn.execute(
                """
                SELECT id, org_id, user_id, memory_type, title, content,
                       importance, status, source_type, source_id,
                       created_at::text, updated_at::text
                FROM memories
                WHERE org_id = %s AND id = ANY(%s) AND status = 'active'
                """,
                (org_id, memory_ids),
            ).fetchall()
        return [self._row_to_memory(r) for r in rows]

    def list_by_session(
        self,
        org_id: str,
        session_id: str,
        user_id: str | None = None,
    ) -> list[Memory]:
        """本会话溯源的智慧（source_id 或 memory_sources 关联）。"""
        with pg_conn() as conn:
            if user_id:
                rows = conn.execute(
                    """
                    SELECT m.id, m.org_id, m.user_id, m.memory_type, m.title, m.content,
                           m.importance, m.status, m.source_type, m.source_id,
                           m.created_at::text, m.updated_at::text
                    FROM memories m
                    WHERE m.org_id = %s AND m.user_id = %s AND m.status = 'active'
                      AND (
                        m.source_id = %s
                        OR EXISTS (
                            SELECT 1 FROM memory_sources ms
                            WHERE ms.memory_id = m.id AND ms.source_id = %s
                        )
                      )
                    ORDER BY m.updated_at DESC
                    """,
                    (org_id, user_id, session_id, session_id),
                ).fetchall()
            else:
                rows = conn.execute(
                    """
                    SELECT m.id, m.org_id, m.user_id, m.memory_type, m.title, m.content,
                           m.importance, m.status, m.source_type, m.source_id,
                           m.created_at::text, m.updated_at::text
                    FROM memories m
                    WHERE m.org_id = %s AND m.status = 'active'
                      AND (
                        m.source_id = %s
                        OR EXISTS (
                            SELECT 1 FROM memory_sources ms
                            WHERE ms.memory_id = m.id AND ms.source_id = %s
                        )
                      )
                    ORDER BY m.updated_at DESC
                    """,
                    (org_id, session_id, session_id),
                ).fetchall()
        return [self._row_to_memory(r) for r in rows]

    def find_by_title(
        self,
        org_id: str,
        user_id: str | None,
        memory_type: str,
        title: str,
    ) -> Optional[Memory]:
        with pg_conn() as conn:
            row = conn.execute(
                """
                SELECT id, org_id, user_id, memory_type, title, content,
                       importance, status, source_type, source_id,
                       created_at::text, updated_at::text
                FROM memories
                WHERE org_id = %s AND user_id IS NOT DISTINCT FROM %s
                  AND memory_type = %s AND status = 'active'
                  AND lower(title) = lower(%s)
                LIMIT 1
                """,
                (org_id, user_id, memory_type, title),
            ).fetchone()
        return self._row_to_memory(row) if row else None

    def create(
        self,
        org_id: str,
        user_id: str | None,
        candidate: MemoryCandidate,
        source_type: str = "chat",
        source_id: str | None = None,
    ) -> int:
        with pg_conn() as conn:
            row = conn.execute(
                """
                INSERT INTO memories
                    (org_id, user_id, memory_type, title, content, importance,
                     status, source_type, source_id)
                VALUES (%s, %s, %s, %s, %s, %s, 'active', %s, %s)
                RETURNING id
                """,
                (
                    org_id, user_id, candidate.memory_type,
                    candidate.title, candidate.content, candidate.importance,
                    source_type, source_id,
                ),
            ).fetchone()
            memory_id = row[0]
            self._add_event(conn, memory_id, org_id, "created", None, candidate.content)
            if source_id:
                self._link_source(conn, memory_id, "chat_session", source_id)
            conn.commit()
        return memory_id

    def update(
        self,
        memory_id: int,
        org_id: str,
        candidate: MemoryCandidate,
        source_id: str | None = None,
    ) -> None:
        with pg_conn() as conn:
            old = conn.execute(
                "SELECT content FROM memories WHERE id = %s AND org_id = %s",
                (memory_id, org_id),
            ).fetchone()
            old_content = old[0] if old else None

            conn.execute(
                """
                UPDATE memories
                SET title = %s, content = %s, importance = %s,
                    source_type = 'chat', source_id = %s, updated_at = NOW()
                WHERE id = %s AND org_id = %s
                """,
                (
                    candidate.title, candidate.content, candidate.importance,
                    source_id, memory_id, org_id,
                ),
            )
            self._add_event(conn, memory_id, org_id, "updated", old_content, candidate.content)
            if source_id:
                self._link_source(conn, memory_id, "chat_session", source_id)
            conn.commit()

    def archive(
        self,
        memory_id: int,
        org_id: str,
        reason: str,
        session_id: str | None = None,
    ) -> None:
        with pg_conn() as conn:
            old = conn.execute(
                "SELECT content FROM memories WHERE id = %s AND org_id = %s",
                (memory_id, org_id),
            ).fetchone()
            old_content = old[0] if old else None

            conn.execute(
                """
                UPDATE memories
                SET status = 'archived', updated_at = NOW()
                WHERE id = %s AND org_id = %s
                """,
                (memory_id, org_id),
            )
            meta = {"reason": reason}
            if session_id:
                meta["session_id"] = session_id
            self._add_event(
                conn, memory_id, org_id, "archived", old_content, reason, metadata=meta,
            )
            conn.commit()

    def apply_candidates(
        self,
        org_id: str,
        user_id: str | None,
        candidates: list[MemoryCandidate],
        session_id: str,
    ) -> list[int]:
        """
        将 Extractor / Recap 输出写入库（核心写路径）。

        支持 create / update / archive。
        Returns affected memory ids (archived ids included).
        """
        affected: list[int] = []
        for c in candidates:
            if c.action == "archive" and c.match_title:
                existing = self.find_by_title(org_id, user_id, c.memory_type, c.match_title)
                if existing:
                    self.archive(existing.id, org_id, c.content, session_id=session_id)
                    affected.append(existing.id)
                continue
            if c.action == "update" and c.match_title:
                existing = self.find_by_title(org_id, user_id, c.memory_type, c.match_title)
                if existing:
                    self.update(existing.id, org_id, c, source_id=session_id)
                    affected.append(existing.id)
                    continue
            # Also try matching own title for update
            if c.action == "update":
                existing = self.find_by_title(org_id, user_id, c.memory_type, c.title)
                if existing:
                    self.update(existing.id, org_id, c, source_id=session_id)
                    affected.append(existing.id)
                    continue
            mid = self.create(org_id, user_id, c, source_id=session_id)
            affected.append(mid)
        return affected

    @staticmethod
    def _add_event(
        conn,
        memory_id: int,
        org_id: str,
        event_type: str,
        old_content: str | None,
        new_content: str | None,
        metadata: dict | None = None,
    ) -> None:
        conn.execute(
            """
            INSERT INTO memory_events
                (memory_id, org_id, event_type, old_content, new_content, metadata)
            VALUES (%s, %s, %s, %s, %s, %s::jsonb)
            """,
            (
                memory_id, org_id, event_type, old_content, new_content,
                json.dumps(metadata or {}, ensure_ascii=False),
            ),
        )

    @staticmethod
    def _link_source(conn, memory_id: int, source_type: str, source_id: str) -> None:
        conn.execute(
            """
            INSERT INTO memory_sources (memory_id, source_type, source_id)
            VALUES (%s, %s, %s)
            ON CONFLICT (memory_id, source_type, source_id) DO NOTHING
            """,
            (memory_id, source_type, source_id),
        )

    @staticmethod
    def _row_to_event(row) -> MemoryEvent:
        return MemoryEvent(
            id=row[0],
            memory_id=row[1],
            org_id=row[2],
            event_type=row[3],
            old_content=row[4],
            new_content=row[5],
            created_at=row[6],
            memory_title=row[7],
            memory_type=row[8],
            source_id=row[9],
        )

    @staticmethod
    def _row_to_memory(row) -> Memory:
        return Memory(
            id=row[0],
            org_id=row[1],
            user_id=row[2],
            memory_type=row[3],
            title=row[4],
            content=row[5],
            importance=float(row[6]),
            status=row[7],
            source_type=row[8],
            source_id=row[9],
            created_at=row[10],
            updated_at=row[11],
        )
