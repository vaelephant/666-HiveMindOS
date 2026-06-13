"""Qdrant 经验向量检索 — Phase 1.5。"""

from __future__ import annotations

import uuid
from typing import Optional

from knowledge_base import config
from server.logging_config import get_logger

log = get_logger("hivemind.experience.vector")


class ExperienceVectorStore:
    def __init__(self) -> None:
        self._client = None
        self._ready = False
        self._init_error: str | None = None

    @property
    def collection(self) -> str:
        return config.EXPERIENCE_COLLECTION

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
            log.warning("[exp-vector] unavailable: %s", exc)
            return False

    def _ensure_client(self):
        if self._client is not None:
            return
        from qdrant_client import QdrantClient

        kwargs: dict = {"url": config.QDRANT_URL}
        if config.QDRANT_API_KEY:
            kwargs["api_key"] = config.QDRANT_API_KEY
        self._client = QdrantClient(**kwargs)

    def _ensure_collection(self) -> None:
        from qdrant_client.models import Distance, VectorParams

        self._ensure_client()
        names = {c.name for c in self._client.get_collections().collections}
        if self.collection in names:
            return
        self._client.create_collection(
            collection_name=self.collection,
            vectors_config=VectorParams(
                size=config.EMBEDDING_DIM,
                distance=Distance.COSINE,
            ),
        )
        log.info("[exp-vector] created collection %s", self.collection)

    @staticmethod
    def _experience_text(goal: str, task_type: str, workflow: list) -> str:
        steps = " → ".join(
            f"{w.get('action', w.get('name', ''))}" for w in (workflow or [])[:12]
        )
        return f"[{task_type}] {goal}\n流程: {steps}"

    def upsert(
        self,
        exp_id: str,
        org_id: str,
        task_type: str,
        goal: str,
        workflow: list,
        score: int | None,
    ) -> bool:
        if not self.is_available():
            return False
        try:
            from model_layer import client as llm
            from qdrant_client.models import PointStruct

            text = self._experience_text(goal, task_type, workflow)
            vector = llm.embed(
                text,
                org_id=org_id,
                source="embed",
                source_id=exp_id,
            )
            point_id = str(uuid.uuid5(uuid.NAMESPACE_URL, exp_id))
            point = PointStruct(
                id=point_id,
                vector=vector,
                payload={
                    "experience_id": exp_id,
                    "org_id": org_id,
                    "task_type": task_type,
                    "goal": goal[:500],
                    "score": score or 0,
                    "workflow": workflow,
                },
            )
            self._client.upsert(collection_name=self.collection, points=[point])
            log.info("[exp-vector] upserted exp_id=%s", exp_id[:8])
            return True
        except Exception as exc:
            log.error("[exp-vector] upsert failed: %s", exc)
            return False

    def search(
        self,
        org_id: str,
        task_type: str,
        query: str,
        limit: int = 3,
    ) -> list[dict]:
        if not self.is_available():
            return []
        try:
            from model_layer import client as llm
            from qdrant_client.models import FieldCondition, Filter, MatchValue

            vector = llm.embed(
                query,
                org_id=org_id,
                source="embed",
            )
            must = [
                FieldCondition(key="org_id", match=MatchValue(value=org_id)),
                FieldCondition(key="task_type", match=MatchValue(value=task_type)),
            ]
            response = self._client.query_points(
                collection_name=self.collection,
                query=vector,
                query_filter=Filter(must=must),
                limit=limit,
                with_payload=True,
            )
            out: list[dict] = []
            for point in response.points:
                if not point.payload:
                    continue
                out.append({
                    "id": point.payload.get("experience_id"),
                    "goal": point.payload.get("goal"),
                    "score": point.payload.get("score"),
                    "workflow": point.payload.get("workflow") or [],
                    "similarity": float(point.score),
                })
            return out
        except Exception as exc:
            log.error("[exp-vector] search failed: %s", exc)
            return []


_store: Optional[ExperienceVectorStore] = None


def get_experience_vector_store() -> ExperienceVectorStore:
    global _store
    if _store is None:
        _store = ExperienceVectorStore()
    return _store
