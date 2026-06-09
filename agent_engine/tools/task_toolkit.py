"""自主任务引擎 Tool 注册表 — 封装 memory / wiki / candidate 服务。"""

from __future__ import annotations

import json
from datetime import datetime, timedelta, timezone
from functools import lru_cache

from memory_layer.knowledge_base import config
from memory_layer.knowledge_base.core.domain.taxonomy import category_to_memory_type
from memory_layer.knowledge_base.core.graph.memory_graph import MemoryGraph
from memory_layer.knowledge_base.core.parsers.llm_json import parse_json_object
from memory_layer.knowledge_base.core.registry.chat_registry import ChatRegistry
from memory_layer.knowledge_base.core.registry.memory_registry import MemoryRegistry
from memory_layer.knowledge_base.core.services.candidate_service import (
    compile_approved_candidates,
    get_candidate_stats,
    resolve_pending_candidates,
)
from memory_layer.knowledge_base.core.tools.kb_toolkit import WikiToolExecutor, tool_runtime
from agent_engine.tools.web_tools import read_url, web_search
from memory_layer.knowledge_base.core.wiki.wiki_manager import WikiManager
from memory_layer.knowledge_base.models.knowledge_candidate import CandidateInput
from memory_layer.knowledge_base.core.registry.candidate_registry import CandidateRegistry
from memory_layer.knowledge_base.prompts import get, render
from agent_engine.settings import load
from model_layer import client as llm

_EXTRACT = get("agents.extract_facts")


@lru_cache(maxsize=1)
def list_actions() -> list[str]:
    return [a["name"] for a in load("task_tools")["actions"]]


def format_tools_for_prompt() -> str:
    lines = []
    for a in load("task_tools")["actions"]:
        params = a.get("params") or {}
        param_str = ", ".join(f"{k}" for k in params) if params else "无"
        lines.append(f"- {a['name']}: {a['description']} (参数: {param_str})")
    return "\n".join(lines)


def _parse_dt(value: str) -> datetime | None:
    if not value:
        return None
    try:
        if value.endswith("Z"):
            value = value[:-1] + "+00:00"
        return datetime.fromisoformat(value)
    except ValueError:
        return None


def _within_days(ts: str | None, since_days: int) -> bool:
    if since_days <= 0:
        return True
    dt = _parse_dt(ts or "")
    if not dt:
        return True
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    cutoff = datetime.now(timezone.utc) - timedelta(days=since_days)
    return dt >= cutoff


class TaskToolExecutor:
    def __init__(self, org_id: str, user_id: str = "demo"):
        self._org_id = org_id
        self._user_id = user_id
        self._memories = MemoryRegistry()
        self._chat = ChatRegistry()
        self._candidates = CandidateRegistry()
        self._wiki = WikiManager(config.WIKI_ROOT)
        self._graph = MemoryGraph(config.GRAPH_ROOT / org_id / "graph.db")
        self._wiki_tools = WikiToolExecutor(self._wiki, self._graph, org_id)
        self._rt = tool_runtime()

    def execute(self, name: str, params: dict) -> dict:
        handler = getattr(self, f"_action_{name}", None)
        if not handler:
            raise ValueError(f"未知 action: {name}")
        return handler(params or {})

    def _action_get_org_stats(self, params: dict) -> dict:
        stats = get_candidate_stats(self._org_id, self._user_id)
        memories = self._memories.list_active(self._org_id, self._user_id, limit=200)
        return {
            "pending": stats.get("pending", 0),
            "approved": stats.get("approved", 0),
            "conflict": stats.get("conflict", 0),
            "merged": stats.get("merged", 0),
            "memory_count": len(memories),
        }

    def _action_search_memories(self, params: dict) -> dict:
        since_days = int(params.get("since_days") or 7)
        category = params.get("category")
        query = (params.get("query") or "").lower()
        mem_type = category_to_memory_type(category) if category else None
        if mem_type:
            rows = self._memories.list_active(
                self._org_id, self._user_id, memory_types=(mem_type,), limit=100,
            )
        else:
            rows = self._memories.list_active(self._org_id, self._user_id, limit=100)

        items = []
        for m in rows:
            if not _within_days(m.updated_at, since_days):
                continue
            if query and query not in (m.title + m.content).lower():
                continue
            items.append({
                "id": m.id,
                "title": m.title,
                "content": m.content[:500],
                "memory_type": m.memory_type,
                "importance": m.importance,
                "updated_at": m.updated_at,
            })
        return {"count": len(items), "items": items}

    def _action_list_sessions(self, params: dict) -> dict:
        since_days = int(params.get("since_days") or 7)
        limit = int(params.get("limit") or 20)
        sessions = self._chat.list_sessions(self._org_id, self._user_id, limit=limit * 2)
        items = []
        for s in sessions:
            if not _within_days(s.updated_at, since_days):
                continue
            items.append({
                "id": s.id,
                "title": s.title,
                "updated_at": s.updated_at,
            })
            if len(items) >= limit:
                break
        return {"count": len(items), "items": items}

    def _action_read_session(self, params: dict) -> dict:
        session_id = params.get("session_id", "")
        session = self._chat.get_session(session_id, self._org_id)
        if not session:
            return {"count": 0, "error": "会话不存在", "items": []}
        turns = []
        for t in session.turns:
            turns.append({
                "question": t.get("question", "")[:800],
                "answer": t.get("answer", "")[:800],
            })
        return {"count": len(turns), "session_id": session_id, "title": session.title, "turns": turns}

    def _action_search_wiki(self, params: dict) -> dict:
        raw = self._wiki_tools.search_wiki(
            params.get("query", ""),
            preview_chars=self._rt.get("task_search_preview_chars", 200),
        )
        try:
            items = json.loads(raw)
            count = len(items) if isinstance(items, list) else 0
        except json.JSONDecodeError:
            items = []
            count = 0
        return {"count": count, "items": items, "raw": raw[:2000]}

    def _action_read_page(self, params: dict) -> dict:
        path = params.get("path", "")
        content = self._wiki_tools.read_page(path)
        ok = not content.startswith("页面不存在")
        return {"ok": ok, "path": path, "chars": len(content), "content": content[:3000]}

    def _action_list_entities(self, params: dict) -> dict:
        raw = self._wiki_tools.list_entities(params.get("entity_type"), include_attributes=True)
        try:
            items = json.loads(raw)
            count = len(items) if isinstance(items, list) else 0
        except json.JSONDecodeError:
            items = []
            count = 0
        return {"count": count, "items": items}

    def _action_extract_facts(self, params: dict) -> dict:
        sources = params.get("sources") or []
        category = params.get("category") or "decision"
        if isinstance(sources, str):
            sources = [sources]
        context_parts = []
        for src in sources:
            if isinstance(src, dict):
                context_parts.append(json.dumps(src, ensure_ascii=False)[:4000])
            else:
                context_parts.append(str(src)[:4000])
        context = "\n\n---\n\n".join(context_parts) or "（无输入）"
        prompt = render(
            "agents.extract_facts",
            category=category,
            context=context,
        )
        raw = llm.complete(prompt, system=_EXTRACT.system, model=_EXTRACT.resolve_model(config))
        data = parse_json_object(raw)
        facts = data.get("facts") or []
        return {"count": len(facts), "facts": facts, "category": category}

    def _action_enqueue_candidates(self, params: dict) -> dict:
        facts = params.get("facts") or []
        if isinstance(facts, dict) and "facts" in facts:
            facts = facts["facts"]
        created = []
        skipped = 0
        for f in facts:
            if not isinstance(f, dict):
                skipped += 1
                continue
            title = (f.get("title") or "").strip()
            content = (f.get("content") or "").strip()
            if not title or not content:
                skipped += 1
                continue
            cat = f.get("category") or "decision"
            dup = self._candidates.find_similar_pending(self._org_id, cat, title)
            if dup:
                skipped += 1
                continue
            cid = self._candidates.create(
                self._org_id,
                self._user_id,
                CandidateInput(
                    category=cat,
                    title=title,
                    content=content,
                    source_type="task",
                    source_id=None,
                    confidence=float(f.get("confidence") or 0.85),
                    proposed_action="create_or_update",
                    metadata={"from": "task_engine"},
                ),
            )
            created.append({"candidate_id": cid, "title": title})
        return {"created": len(created), "skipped": skipped, "items": created}

    def _action_resolve_candidates(self, params: dict) -> dict:
        limit = int(params.get("limit") or 30)
        results = resolve_pending_candidates(self._org_id, self._user_id, limit=limit)
        approved = sum(1 for r in results if r.get("status") == "approved")
        conflict = sum(1 for r in results if r.get("status") == "conflict")
        return {
            "resolved": len(results),
            "approved": approved,
            "conflict": conflict,
            "items": results,
        }

    def _action_compile_candidates(self, params: dict) -> dict:
        limit = int(params.get("limit") or 20)
        results = compile_approved_candidates(self._org_id, self._user_id, limit=limit)
        merged = sum(1 for r in results if r.get("status") == "merged")
        return {"compiled": len(results), "merged": merged, "items": results}

    def _action_llm_generate(self, params: dict) -> dict:
        prompt = params.get("prompt") or ""
        context = params.get("context") or ""
        if isinstance(context, list):
            parts = []
            for c in context:
                if isinstance(c, dict):
                    parts.append(json.dumps(c, ensure_ascii=False)[:4000])
                else:
                    parts.append(str(c)[:4000])
            context = "\n\n---\n\n".join(parts)
        elif isinstance(context, dict):
            context = json.dumps(context, ensure_ascii=False)[:8000]
        full = f"## 参考材料\n{context}\n\n## 任务\n{prompt}".strip() if context else prompt
        text = llm.complete(
            full,
            system="你是 HiveMindOS 企业任务助手，输出清晰、可执行、结构化的 Markdown。",
        )
        return {"chars": len(text), "count": 1, "text": text}

    def _action_web_search(self, params: dict) -> dict:
        return web_search(
            params.get("query") or "",
            limit=int(params.get("limit") or 5),
        )

    def _action_read_url(self, params: dict) -> dict:
        url = params.get("url") or ""
        if isinstance(url, dict):
            url = url.get("first_url") or url.get("url") or ""
        return read_url(url, max_chars=int(params.get("max_chars") or 8000))
