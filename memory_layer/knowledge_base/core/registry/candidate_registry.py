"""PostgreSQL persistence for knowledge_candidates — 候选知识层。"""

from __future__ import annotations

import json
from typing import Optional

from memory_layer.knowledge_base.core.db.postgres import pg_conn
from memory_layer.knowledge_base.models.knowledge_candidate import (
    CandidateInput,
    CandidateStats,
    KnowledgeCandidateRecord,
)

_PENDING = "pending"


class CandidateRegistry:
    def create(
        self,
        org_id: str,
        user_id: str | None,
        item: CandidateInput,
        *,
        status: str = _PENDING,
        target_wiki_path: str | None = None,
        resolver_action: str | None = None,
        resolver_note: str | None = None,
    ) -> int:
        with pg_conn() as conn:
            row = conn.execute(
                """
                INSERT INTO knowledge_candidates
                    (org_id, user_id, category, title, content,
                     source_type, source_id, confidence, proposed_action,
                     status, resolver_action, resolver_note, target_wiki_path,
                     memory_id, metadata)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s::jsonb)
                RETURNING id
                """,
                (
                    org_id, user_id, item.category, item.title, item.content,
                    item.source_type, item.source_id, item.confidence,
                    item.proposed_action, status, resolver_action, resolver_note,
                    target_wiki_path, item.memory_id,
                    json.dumps(item.metadata or {}, ensure_ascii=False),
                ),
            ).fetchone()
            conn.commit()
        return row[0]

    def exists_merged_path(self, org_id: str, wiki_path: str) -> bool:
        with pg_conn() as conn:
            row = conn.execute(
                """
                SELECT 1 FROM knowledge_candidates
                WHERE org_id = %s AND target_wiki_path = %s AND status = 'merged'
                LIMIT 1
                """,
                (org_id, wiki_path),
            ).fetchone()
        return row is not None

    def list_by_source(
        self,
        org_id: str,
        source_id: str,
        limit: int = 50,
    ) -> list[KnowledgeCandidateRecord]:
        with pg_conn() as conn:
            rows = conn.execute(
                """
                SELECT id, org_id, user_id, category, title, content,
                       source_type, source_id, confidence, proposed_action,
                       status, resolver_action, resolver_note, target_wiki_path,
                       memory_id, metadata, created_at::text, updated_at::text
                FROM knowledge_candidates
                WHERE org_id = %s AND source_id = %s
                ORDER BY created_at DESC
                LIMIT %s
                """,
                (org_id, source_id, limit),
            ).fetchall()
        return [self._row_to_record(r) for r in rows]

    def list_recent(self, org_id: str, limit: int = 10) -> list[KnowledgeCandidateRecord]:
        return self.list_by_status(org_id, status=None, limit=limit)

    def list_by_status(
        self,
        org_id: str,
        user_id: str | None = None,
        status: str | None = None,
        limit: int = 100,
    ) -> list[KnowledgeCandidateRecord]:
        with pg_conn() as conn:
            if user_id and status:
                rows = conn.execute(
                    """
                    SELECT id, org_id, user_id, category, title, content,
                           source_type, source_id, confidence, proposed_action,
                           status, resolver_action, resolver_note, target_wiki_path,
                           memory_id, metadata, created_at::text, updated_at::text
                    FROM knowledge_candidates
                    WHERE org_id = %s AND user_id = %s AND status = %s
                    ORDER BY confidence DESC, created_at DESC
                    LIMIT %s
                    """,
                    (org_id, user_id, status, limit),
                ).fetchall()
            elif user_id:
                rows = conn.execute(
                    """
                    SELECT id, org_id, user_id, category, title, content,
                           source_type, source_id, confidence, proposed_action,
                           status, resolver_action, resolver_note, target_wiki_path,
                           memory_id, metadata, created_at::text, updated_at::text
                    FROM knowledge_candidates
                    WHERE org_id = %s AND user_id = %s
                    ORDER BY created_at DESC
                    LIMIT %s
                    """,
                    (org_id, user_id, limit),
                ).fetchall()
            elif status:
                rows = conn.execute(
                    """
                    SELECT id, org_id, user_id, category, title, content,
                           source_type, source_id, confidence, proposed_action,
                           status, resolver_action, resolver_note, target_wiki_path,
                           memory_id, metadata, created_at::text, updated_at::text
                    FROM knowledge_candidates
                    WHERE org_id = %s AND status = %s
                    ORDER BY confidence DESC, created_at DESC
                    LIMIT %s
                    """,
                    (org_id, status, limit),
                ).fetchall()
            else:
                rows = conn.execute(
                    """
                    SELECT id, org_id, user_id, category, title, content,
                           source_type, source_id, confidence, proposed_action,
                           status, resolver_action, resolver_note, target_wiki_path,
                           memory_id, metadata, created_at::text, updated_at::text
                    FROM knowledge_candidates
                    WHERE org_id = %s
                    ORDER BY created_at DESC
                    LIMIT %s
                    """,
                    (org_id, limit),
                ).fetchall()
        return [self._row_to_record(r) for r in rows]

    def get_by_id(self, candidate_id: int, org_id: str) -> Optional[KnowledgeCandidateRecord]:
        with pg_conn() as conn:
            row = conn.execute(
                """
                SELECT id, org_id, user_id, category, title, content,
                       source_type, source_id, confidence, proposed_action,
                       status, resolver_action, resolver_note, target_wiki_path,
                       memory_id, metadata, created_at::text, updated_at::text
                FROM knowledge_candidates
                WHERE id = %s AND org_id = %s
                """,
                (candidate_id, org_id),
            ).fetchone()
        return self._row_to_record(row) if row else None

    def update_resolver(
        self,
        candidate_id: int,
        org_id: str,
        *,
        status: str,
        resolver_action: str | None = None,
        resolver_note: str | None = None,
        target_wiki_path: str | None = None,
    ) -> None:
        with pg_conn() as conn:
            conn.execute(
                """
                UPDATE knowledge_candidates
                SET status = %s,
                    resolver_action = %s,
                    resolver_note = %s,
                    target_wiki_path = %s,
                    updated_at = NOW()
                WHERE id = %s AND org_id = %s
                """,
                (status, resolver_action, resolver_note, target_wiki_path, candidate_id, org_id),
            )
            conn.commit()

    def get_stats(self, org_id: str, user_id: str | None = None) -> CandidateStats:
        with pg_conn() as conn:
            if user_id:
                rows = conn.execute(
                    """
                    SELECT status, COUNT(*)::int
                    FROM knowledge_candidates
                    WHERE org_id = %s AND user_id = %s
                    GROUP BY status
                    """,
                    (org_id, user_id),
                ).fetchall()
                week = conn.execute(
                    """
                    SELECT COUNT(*)::int FROM knowledge_candidates
                    WHERE org_id = %s AND user_id = %s AND status = 'pending'
                      AND created_at >= NOW() - INTERVAL '7 days'
                    """,
                    (org_id, user_id),
                ).fetchone()[0]
            else:
                rows = conn.execute(
                    """
                    SELECT status, COUNT(*)::int
                    FROM knowledge_candidates
                    WHERE org_id = %s
                    GROUP BY status
                    """,
                    (org_id,),
                ).fetchall()
                week = conn.execute(
                    """
                    SELECT COUNT(*)::int FROM knowledge_candidates
                    WHERE org_id = %s AND status = 'pending'
                      AND created_at >= NOW() - INTERVAL '7 days'
                    """,
                    (org_id,),
                ).fetchone()[0]

        counts = {s: 0 for s in ("pending", "approved", "merged", "rejected", "conflict")}
        for status, cnt in rows:
            counts[status] = cnt
        return CandidateStats(
            pending=counts["pending"],
            approved=counts["approved"],
            merged=counts["merged"],
            rejected=counts["rejected"],
            conflict=counts["conflict"],
            pending_week=week,
        )

    def find_similar_pending(
        self,
        org_id: str,
        category: str,
        title: str,
    ) -> Optional[KnowledgeCandidateRecord]:
        with pg_conn() as conn:
            row = conn.execute(
                """
                SELECT id, org_id, user_id, category, title, content,
                       source_type, source_id, confidence, proposed_action,
                       status, resolver_action, resolver_note, target_wiki_path,
                       memory_id, metadata, created_at::text, updated_at::text
                FROM knowledge_candidates
                WHERE org_id = %s AND category = %s AND status = 'pending'
                  AND lower(title) = lower(%s)
                LIMIT 1
                """,
                (org_id, category, title),
            ).fetchone()
        return self._row_to_record(row) if row else None

    @staticmethod
    def _row_to_record(row) -> KnowledgeCandidateRecord:
        meta = row[15]
        if isinstance(meta, str):
            meta = json.loads(meta or "{}")
        elif meta is None:
            meta = {}
        return KnowledgeCandidateRecord(
            id=row[0],
            org_id=row[1],
            user_id=row[2],
            category=row[3],
            title=row[4],
            content=row[5],
            source_type=row[6],
            source_id=row[7],
            confidence=float(row[8]),
            proposed_action=row[9],
            status=row[10],
            resolver_action=row[11],
            resolver_note=row[12],
            target_wiki_path=row[13],
            memory_id=row[14],
            metadata=meta,
            created_at=row[16],
            updated_at=row[17],
        )
