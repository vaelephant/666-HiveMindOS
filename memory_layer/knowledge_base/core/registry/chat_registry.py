"""PostgreSQL persistence for chat sessions and messages."""

from __future__ import annotations

import json
import uuid
from datetime import datetime, timezone
from typing import Optional

from memory_layer.knowledge_base.core.db.postgres import pg_conn
from memory_layer.knowledge_base.models.chat import ChatSession, ChatSessionSummary

_TITLE_MAX = 28
_DEFAULT_USER = "demo"


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _title_from_message(message: str) -> str:
    t = message.strip().replace("\n", " ")
    if len(t) <= _TITLE_MAX:
        return t
    return f"{t[:_TITLE_MAX]}…"


def _rows_to_turns(rows: list[dict]) -> list[dict]:
    """Pair user/assistant message rows into frontend ChatTurn objects."""
    turns: list[dict] = []
    i = 0
    while i < len(rows):
        row = rows[i]
        if row["role"] != "user":
            i += 1
            continue
        question = row["content"]
        answer = ""
        sources: list = []
        follow_ups: list = []
        if i + 1 < len(rows) and rows[i + 1]["role"] == "assistant":
            ans = rows[i + 1]
            answer = ans["content"]
            sources = ans.get("sources") or []
            follow_ups = ans.get("follow_ups") or []
            i += 2
        else:
            i += 1
        turns.append({
            "question": question,
            "answer": answer,
            "sources": sources,
            "follow_ups": follow_ups,
        })
    return turns


class ChatRegistry:
    def get_org_stats(self, org_id: str, user_id: str = _DEFAULT_USER) -> dict:
        """Aggregate chat counts for knowledge-base overview."""
        with pg_conn() as conn:
            session_count = conn.execute(
                """
                SELECT COUNT(*)::int FROM chat_sessions
                WHERE org_id = %s AND user_id = %s AND status = 'active'
                """,
                (org_id, user_id),
            ).fetchone()[0]
            message_count = conn.execute(
                """
                SELECT COUNT(*)::int FROM chat_messages m
                JOIN chat_sessions s ON s.id = m.session_id
                WHERE s.org_id = %s AND s.user_id = %s AND s.status = 'active'
                """,
                (org_id, user_id),
            ).fetchone()[0]
            sessions_week = conn.execute(
                """
                SELECT COUNT(*)::int FROM chat_sessions
                WHERE org_id = %s AND user_id = %s AND status = 'active'
                  AND updated_at >= NOW() - INTERVAL '7 days'
                """,
                (org_id, user_id),
            ).fetchone()[0]
        return {
            "session_count": session_count,
            "message_count": message_count,
            "sessions_week": sessions_week,
        }

    def get_recap_timestamps(
        self,
        session_id: str,
        org_id: str,
    ) -> tuple[str, str | None] | None:
        """Return (updated_at, recapped_at) ISO strings, or None if missing."""
        with pg_conn() as conn:
            row = conn.execute(
                """
                SELECT updated_at::text, recapped_at::text
                FROM chat_sessions
                WHERE id = %s::uuid AND org_id = %s
                """,
                (session_id, org_id),
            ).fetchone()
        if not row:
            return None
        return row[0], row[1]

    def mark_recapped(self, session_id: str, org_id: str) -> None:
        with pg_conn() as conn:
            conn.execute(
                """
                UPDATE chat_sessions
                SET recapped_at = NOW()
                WHERE id = %s::uuid AND org_id = %s
                """,
                (session_id, org_id),
            )
            conn.commit()

    def list_sessions_pending_recap(
        self,
        org_id: str,
        user_id: str = _DEFAULT_USER,
        idle_hours: int = 24,
        limit: int = 10,
    ) -> list[ChatSessionSummary]:
        """活跃会话：超过 idle_hours 无更新，且自上次复盘后有新消息（或从未复盘）。"""
        with pg_conn() as conn:
            rows = conn.execute(
                """
                SELECT id::text, org_id, user_id, title, status,
                       created_at::text, updated_at::text
                FROM chat_sessions
                WHERE org_id = %s AND user_id = %s AND status = 'active'
                  AND updated_at < NOW() - make_interval(hours => %s)
                  AND (recapped_at IS NULL OR updated_at > recapped_at)
                ORDER BY updated_at ASC
                LIMIT %s
                """,
                (org_id, user_id, idle_hours, limit),
            ).fetchall()
        return [
            ChatSessionSummary(
                id=r[0], org_id=r[1], user_id=r[2], title=r[3],
                status=r[4], created_at=r[5], updated_at=r[6],
            )
            for r in rows
        ]

    def list_sessions(
        self,
        org_id: str,
        user_id: str = _DEFAULT_USER,
        limit: int = 50,
    ) -> list[ChatSessionSummary]:
        with pg_conn() as conn:
            rows = conn.execute(
                """
                SELECT id::text, org_id, user_id, title, status,
                       created_at::text, updated_at::text
                FROM chat_sessions
                WHERE org_id = %s AND user_id = %s AND status = 'active'
                ORDER BY updated_at DESC
                LIMIT %s
                """,
                (org_id, user_id, limit),
            ).fetchall()
        return [
            ChatSessionSummary(
                id=r[0], org_id=r[1], user_id=r[2], title=r[3],
                status=r[4], created_at=r[5], updated_at=r[6],
            )
            for r in rows
        ]

    def get_session(self, session_id: str, org_id: str) -> Optional[ChatSession]:
        with pg_conn() as conn:
            sess = conn.execute(
                """
                SELECT id::text, org_id, user_id, title, status,
                       created_at::text, updated_at::text
                FROM chat_sessions
                WHERE id = %s::uuid AND org_id = %s
                """,
                (session_id, org_id),
            ).fetchone()
            if not sess:
                return None

            msg_rows = conn.execute(
                """
                SELECT role, content, sources, follow_ups
                FROM chat_messages
                WHERE session_id = %s::uuid
                ORDER BY created_at ASC, id ASC
                """,
                (session_id,),
            ).fetchall()

        messages = [
            {
                "role": r[0],
                "content": r[1],
                "sources": r[2] if isinstance(r[2], list) else json.loads(r[2] or "[]"),
                "follow_ups": r[3] if isinstance(r[3], list) else json.loads(r[3] or "[]"),
            }
            for r in msg_rows
        ]

        return ChatSession(
            id=sess[0], org_id=sess[1], user_id=sess[2], title=sess[3],
            status=sess[4], created_at=sess[5], updated_at=sess[6],
            turns=_rows_to_turns(messages),
        )

    def create_session(
        self,
        org_id: str,
        title: str,
        user_id: str = _DEFAULT_USER,
    ) -> str:
        session_id = str(uuid.uuid4())
        now = _now()
        with pg_conn() as conn:
            conn.execute(
                """
                INSERT INTO chat_sessions (id, org_id, user_id, title, status, created_at, updated_at)
                VALUES (%s::uuid, %s, %s, %s, 'active', %s::timestamptz, %s::timestamptz)
                """,
                (session_id, org_id, user_id, title, now, now),
            )
            conn.commit()
        return session_id

    def delete_session(self, session_id: str, org_id: str) -> bool:
        with pg_conn() as conn:
            cur = conn.execute(
                "DELETE FROM chat_sessions WHERE id = %s::uuid AND org_id = %s",
                (session_id, org_id),
            )
            conn.commit()
            return cur.rowcount > 0

    def add_message(
        self,
        session_id: str,
        org_id: str,
        user_id: str,
        role: str,
        content: str,
        sources: list | None = None,
        follow_ups: list | None = None,
    ) -> None:
        with pg_conn() as conn:
            conn.execute(
                """
                INSERT INTO chat_messages
                    (session_id, org_id, user_id, role, content, sources, follow_ups)
                VALUES (%s::uuid, %s, %s, %s, %s, %s::jsonb, %s::jsonb)
                """,
                (
                    session_id, org_id, user_id, role, content,
                    json.dumps(sources or [], ensure_ascii=False),
                    json.dumps(follow_ups or [], ensure_ascii=False),
                ),
            )
            conn.execute(
                "UPDATE chat_sessions SET updated_at = NOW() WHERE id = %s::uuid",
                (session_id,),
            )
            conn.commit()

    def get_history(self, session_id: str) -> list[dict]:
        """Return {role, content} pairs for ChatAgent context."""
        with pg_conn() as conn:
            rows = conn.execute(
                """
                SELECT role, content
                FROM chat_messages
                WHERE session_id = %s::uuid AND role IN ('user', 'assistant')
                ORDER BY created_at ASC, id ASC
                """,
                (session_id,),
            ).fetchall()
        return [{"role": r[0], "content": r[1]} for r in rows]

    def ensure_title(self, session_id: str, first_message: str) -> None:
        title = _title_from_message(first_message)
        with pg_conn() as conn:
            conn.execute(
                """
                UPDATE chat_sessions
                SET title = %s, updated_at = NOW()
                WHERE id = %s::uuid AND (title = '' OR title IS NULL)
                """,
                (title, session_id),
            )
            conn.commit()
