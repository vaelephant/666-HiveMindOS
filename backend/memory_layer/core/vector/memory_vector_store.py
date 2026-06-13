"""
Qdrant vector store for structured memories (P3).

Upsert on create/update; semantic search for Context Builder.
Falls back gracefully when Qdrant or embeddings are unavailable.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Optional

from shared import config
from server.logging_config import get_logger
from shared.db.postgres import pg_conn
from knowledge_base.core.domain.taxonomy import memory_type_label
from memory_layer.models.memory import Memory

log = get_logger("hivemind.vector")


@dataclass
class VectorHit:
    memory_id: int
    score: float


class MemoryVectorStore:
    def __init__(self) -> None:
        self._client = None
        self._ready = False
        self._init_error: str | None = None

    def is_available(self) -> bool:
        if not config.QDRANT_ENABLED:
            return False
        if self._ready:
            return True
        if self._init_error:
            return False
        try:
            self._ensure_client()
            self._ensure_collection()
            self._ready = True
            return True
        except Exception as exc:
            self._init_error = str(exc)
            log.warning("[vector] unavailable: %s", exc)
            return False

    def _ensure_client(self):
        if self._client is not None:
            return
        from qdrant_client import QdrantClient

        kwargs: dict = {"url": config.QDRANT_URL, "check_compatibility": False}
        if config.QDRANT_API_KEY:
            kwargs["api_key"] = config.QDRANT_API_KEY
        self._client = QdrantClient(**kwargs)

    def _ensure_collection(self) -> None:
        from qdrant_client.models import Distance, VectorParams

        self._ensure_client()
        names = {c.name for c in self._client.get_collections().collections}
        if config.QDRANT_COLLECTION in names:
            return
        self._client.create_collection(
            collection_name=config.QDRANT_COLLECTION,
            vectors_config=VectorParams(
                size=config.EMBEDDING_DIM,
                distance=Distance.COSINE,
            ),
        )
        log.info("[vector] created collection %s", config.QDRANT_COLLECTION)

    @staticmethod
    def _memory_text(memory: Memory) -> str:
        label = memory_type_label(memory.memory_type)
        return f"[{label}] {memory.title}: {memory.content}"

    def upsert_memory(self, memory: Memory) -> bool:
        if not self.is_available():
            return False
        try:
            from model_layer import client as llm
            from qdrant_client.models import PointStruct

            vector = llm.embed(
                self._memory_text(memory),
                org_id=memory.org_id,
                user_id=memory.user_id or "demo",
                source="embed",
                source_id=str(memory.id),
            )
            point = PointStruct(
                id=memory.id,
                vector=vector,
                payload={
                    "memory_id": memory.id,
                    "org_id": memory.org_id,
                    "user_id": memory.user_id or "",
                    "memory_type": memory.memory_type,
                    "title": memory.title,
                    "content": memory.content,
                    "importance": memory.importance,
                    "status": memory.status,
                },
            )
            self._client.upsert(
                collection_name=config.QDRANT_COLLECTION,
                points=[point],
            )
            self._set_qdrant_point_id(memory.id, memory.org_id, str(memory.id))
            log.info("[vector] upserted memory_id=%d org=%s", memory.id, memory.org_id)
            return True
        except Exception as exc:
            log.error("[vector] upsert failed memory_id=%d err=%s", memory.id, exc)
            return False

    def search(
        self,
        org_id: str,
        user_id: str,
        query: str,
        limit: int = 8,
    ) -> list[VectorHit]:
        if not self.is_available():
            return []
        try:
            from model_layer import client as llm
            from qdrant_client.models import FieldCondition, Filter, MatchValue

            vector = llm.embed(
                query,
                org_id=org_id,
                user_id=user_id,
                source="embed",
            )
            must = [
                FieldCondition(key="org_id", match=MatchValue(value=org_id)),
                FieldCondition(key="user_id", match=MatchValue(value=user_id)),
                FieldCondition(key="status", match=MatchValue(value="active")),
            ]
            response = self._client.query_points(
                collection_name=config.QDRANT_COLLECTION,
                query=vector,
                query_filter=Filter(must=must),
                limit=limit,
                with_payload=True,
            )
            hits: list[VectorHit] = []
            for point in response.points:
                mid = point.payload.get("memory_id") if point.payload else point.id
                if mid is None:
                    continue
                hits.append(VectorHit(memory_id=int(mid), score=float(point.score)))
            return hits
        except Exception as exc:
            log.error("[vector] search failed org=%s err=%s", org_id, exc)
            return []

    @staticmethod
    def _set_qdrant_point_id(memory_id: int, org_id: str, point_id: str) -> None:
        with pg_conn() as conn:
            conn.execute(
                """
                UPDATE memories SET qdrant_point_id = %s, updated_at = NOW()
                WHERE id = %s AND org_id = %s
                """,
                (point_id, memory_id, org_id),
            )
            conn.commit()


_store: Optional[MemoryVectorStore] = None


def get_vector_store() -> MemoryVectorStore:
    global _store
    if _store is None:
        _store = MemoryVectorStore()
    return _store
