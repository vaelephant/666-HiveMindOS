"""
PostgreSQL persistence for structured memories — 智慧进化的持久化层（核心）。

Extractor 产出的 project / preference / decision 在此落库，
并记录 memory_events（进化时间线）与 memory_sources（溯源到 Chat）。
"""

from __future__ import annotations

import json
from typing import Optional

from knowledge_base.core.db.postgres import pg_conn
from knowledge_base.models.memory import Memory, MemoryCandidate, MemoryEvent, MemoryStats

from knowledge_base.core.domain.taxonomy import ingest_l3_memory_types, p1_memory_types

_P1_TYPES = p1_memory_types()
_INGEST_L3_TYPES = ingest_l3_memory_types()


class MemoryRegistry:
    def list_active(
        self,
        org_id: str,
        user_id: str | None = None,
        memory_types: tuple[str, ...] | None = None,
        source_type: str | None = None,
        limit: int = 50,
    ) -> list[Memory]:
        types = list(memory_types or _P1_TYPES)
        if source_type == "ingest":
            types = list(_INGEST_L3_TYPES)
        clauses = ["org_id = %s", "status = 'active'", "memory_type = ANY(%s)"]
        params: list = [org_id, types]
        if source_type == "chat" and user_id:
            clauses.append("user_id = %s")
            clauses.append("source_type = 'chat'")
            params.append(user_id)
        elif source_type == "ingest":
            clauses.append("source_type = 'ingest'")
        elif user_id:
            clauses.append("(user_id = %s OR (user_id IS NULL AND source_type = 'ingest'))")
            params.append(user_id)
        if source_type and source_type not in ("chat", "ingest"):
            clauses.append("source_type = %s")
            params.append(source_type)
        params.append(limit)
        sql = f"""
            SELECT id, org_id, user_id, memory_type, title, content,
                   importance, status, source_type, source_id,
                   created_at::text, updated_at::text
            FROM memories
            WHERE {' AND '.join(clauses)}
            ORDER BY importance DESC, updated_at DESC
            LIMIT %s
        """
        with pg_conn() as conn:
            rows = conn.execute(sql, params).fetchall()
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
        vis, vis_params = self._visible_clause(user_id)
        with pg_conn() as conn:
            if user_id:
                type_rows = conn.execute(
                    f"""
                    SELECT memory_type, COUNT(*)::int
                    FROM memories
                    WHERE org_id = %s AND status = 'active' AND {vis}
                      AND memory_type = ANY(%s)
                    GROUP BY memory_type
                    """,
                    [org_id, *vis_params, list(_P1_TYPES)],
                ).fetchall()
                memories_week = conn.execute(
                    f"""
                    SELECT COUNT(*)::int FROM memories
                    WHERE org_id = %s AND status = 'active' AND {vis}
                      AND created_at >= NOW() - INTERVAL '7 days'
                    """,
                    [org_id, *vis_params],
                ).fetchone()[0]
                ev_vis, ev_params = self._visible_clause(user_id, prefix="m.")
                events_week = conn.execute(
                    f"""
                    SELECT COUNT(*)::int FROM memory_events e
                    JOIN memories m ON m.id = e.memory_id
                    WHERE e.org_id = %s AND {ev_vis}
                      AND e.created_at >= NOW() - INTERVAL '7 days'
                    """,
                    [org_id, *ev_params],
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
        total = self._count_active(org_id, user_id)
        by_source = self._count_by_source(org_id, user_id)
        vector_indexed = self._count_vector_indexed(org_id, user_id)
        return MemoryStats(
            total=total,
            project=counts["project"],
            preference=counts["preference"],
            decision=counts["decision"],
            events_this_week=events_week,
            memories_this_week=memories_week,
            vector_indexed=vector_indexed,
            by_source_chat=by_source.get("chat", 0),
            by_source_ingest=by_source.get("ingest", 0),
        )

    @staticmethod
    def _visible_clause(user_id: str | None, *, prefix: str = "") -> tuple[str, list]:
        p = prefix
        if user_id:
            return (
                f"({p}user_id = %s OR ({p}user_id IS NULL AND {p}source_type = 'ingest'))",
                [user_id],
            )
        return ("TRUE", [])

    def _count_active(self, org_id: str, user_id: str | None) -> int:
        vis, vis_params = self._visible_clause(user_id)
        with pg_conn() as conn:
            row = conn.execute(
                f"""
                SELECT COUNT(*)::int FROM memories
                WHERE org_id = %s AND status = 'active' AND {vis}
                """,
                [org_id, *vis_params],
            ).fetchone()
        return row[0] if row else 0

    def _count_by_source(self, org_id: str, user_id: str | None) -> dict[str, int]:
        vis, vis_params = self._visible_clause(user_id)
        with pg_conn() as conn:
            rows = conn.execute(
                f"""
                SELECT COALESCE(source_type, 'unknown'), COUNT(*)::int
                FROM memories
                WHERE org_id = %s AND status = 'active' AND {vis}
                GROUP BY source_type
                """,
                [org_id, *vis_params],
            ).fetchall()
        return {r[0]: r[1] for r in rows}

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
        link_source_type: str | None = None,
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
                resolved_link = link_source_type or (
                    "chat_session" if source_type == "chat" else None
                )
                if resolved_link:
                    self._link_source(conn, memory_id, resolved_link, source_id)
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

    def apply_ingest_candidates(
        self,
        org_id: str,
        source_id: str,
        candidates: list[MemoryCandidate],
    ) -> list[int]:
        """L3 文档提炼写入（组织级，source_type=ingest）。"""
        affected: list[int] = []
        for c in candidates:
            mid = self.create(
                org_id,
                None,
                c,
                source_type="ingest",
                source_id=source_id,
                link_source_type="ingest",
            )
            affected.append(mid)
        return affected

    def archive_ingest_source(self, org_id: str, source_id: str) -> int:
        """重新编译前归档该资料来源的旧智慧。"""
        with pg_conn() as conn:
            rows = conn.execute(
                """
                SELECT id FROM memories
                WHERE org_id = %s AND source_type = 'ingest' AND source_id = %s
                  AND status = 'active'
                """,
                (org_id, source_id),
            ).fetchall()
        count = 0
        for row in rows:
            self.archive(row[0], org_id, "资料重新编译，旧版本归档")
            count += 1
        return count

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
