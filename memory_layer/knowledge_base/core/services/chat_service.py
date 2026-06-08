"""
Chat pipeline — all chat + memory logic lives in FastAPI.

用户消息 → 保存原始聊天 → Context Builder → 调用模型 → 保存回答 → 异步智慧提取
"""

from __future__ import annotations

from dataclasses import asdict

from memory_layer.knowledge_base import config
from memory_layer.knowledge_base.app.logging_config import get_logger
from memory_layer.knowledge_base.core.agents.chat_agent import ChatAgent
from memory_layer.knowledge_base.core.services.context_builder import build_context
from memory_layer.knowledge_base.core.graph.memory_graph import MemoryGraph
from memory_layer.knowledge_base.core.registry.chat_registry import ChatRegistry
from memory_layer.knowledge_base.core.wiki.wiki_manager import WikiManager

log = get_logger("hivemind.chat.service")

_registry = ChatRegistry()
_DEFAULT_USER = "demo"


def _wiki_and_graph(org_id: str):
    return (
        WikiManager(config.WIKI_ROOT),
        MemoryGraph(config.GRAPH_ROOT / org_id / "graph.db"),
    )


def list_sessions(org_id: str, user_id: str = _DEFAULT_USER) -> list[dict]:
    return [asdict(s) for s in _registry.list_sessions(org_id, user_id)]


def get_session(org_id: str, session_id: str) -> dict | None:
    session = _registry.get_session(session_id, org_id)
    return asdict(session) if session else None


def delete_session(org_id: str, session_id: str) -> bool:
    return _registry.delete_session(session_id, org_id)


def send_message(
    org_id: str,
    message: str,
    session_id: str | None = None,
    user_id: str = _DEFAULT_USER,
) -> dict:
    """
    Full chat turn pipeline:
    1. Ensure session exists
    2. Persist user message
    3. Load history from DB
    4. Call ChatAgent
    5. Persist assistant message
    6. Schedule memory extraction (async via router BackgroundTasks)
    """
    message = message.strip()
    if not message:
        raise ValueError("消息不能为空")

    if not session_id:
        session_id = _registry.create_session(org_id, "", user_id=user_id)

    is_first = len(_registry.get_history(session_id)) == 0
    _registry.add_message(session_id, org_id, user_id, "user", message)
    if is_first:
        _registry.ensure_title(session_id, message)

    history = _registry.get_history(session_id)
    # Exclude the message we just saved from history passed to agent
    prior = history[:-1] if history else []

    memory_block, memories_used = build_context(org_id, user_id, message)

    wiki, graph = _wiki_and_graph(org_id)
    result = ChatAgent(wiki, graph).run(message, prior, org_id, memory_context=memory_block)

    _registry.add_message(
        session_id,
        org_id,
        user_id,
        "assistant",
        result["answer"],
        sources=result.get("sources"),
        follow_ups=result.get("follow_ups"),
    )

    log.info(
        "[chat] turn saved  org=%s  session=%s  sources=%d  memories=%d",
        org_id, session_id[:8], len(result.get("sources") or []), len(memories_used),
    )

    return {
        "session_id": session_id,
        "answer": result["answer"],
        "sources": result.get("sources") or [],
        "follow_ups": result.get("follow_ups") or [],
        "memories_used": memories_used,
        "turn": {
            "question": message,
            "answer": result["answer"],
            "sources": result.get("sources") or [],
            "follow_ups": result.get("follow_ups") or [],
            "memories_used": memories_used,
        },
    }
