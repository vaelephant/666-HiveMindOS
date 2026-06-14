"""
Chat pipeline — all chat + memory logic lives in FastAPI.

用户消息 → 保存原始聊天 → Context Builder → 调用模型 → 保存回答 → 异步智慧提取
"""

from __future__ import annotations

import json
from collections.abc import Callable, Iterator
from dataclasses import asdict

from shared import config
from server.logging_config import get_logger
from chat_layer.core.pipelines.chat_agent import ChatAgent
from chat_layer.core.services.context_builder import build_context
from knowledge_base.core.graph.memory_graph import MemoryGraph
from chat_layer.core.registry.chat_registry import ChatRegistry
from model_layer.services.model_settings_service import get_settings as get_model_settings
from knowledge_base.core.wiki.wiki_manager import WikiManager
from model_layer.usage import track_usage

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


def search_history(org_id: str, user_id: str, query: str) -> dict:
    from chat_layer.core.services.context_builder import (
        format_session_search_block,
        search_session_messages,
    )

    hits = search_session_messages(org_id, user_id, query)
    return {
        "query": query,
        "count": len(hits),
        "hits": hits,
        "formatted": format_session_search_block(hits),
    }


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

    memory_block, memories_used, skills_used = build_context(
        org_id, user_id, message, session_id=session_id,
    )

    wiki, graph = _wiki_and_graph(org_id)
    chat_profile = get_model_settings(org_id, user_id).chat_profile
    with track_usage(org_id, user_id, "chat", session_id):
        result = ChatAgent(wiki, graph).run(
            message, prior, org_id, memory_context=memory_block, chat_profile=chat_profile,
            user_id=user_id,
        )

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
        "[chat] turn saved  org=%s  session=%s  sources=%d  memories=%d  skills=%d",
        org_id, session_id[:8], len(result.get("sources") or []), len(memories_used), len(skills_used),
    )

    return {
        "session_id": session_id,
        "answer": result["answer"],
        "sources": result.get("sources") or [],
        "follow_ups": result.get("follow_ups") or [],
        "memories_used": memories_used,
        "skills_used": skills_used,
        "turn": {
            "question": message,
            "answer": result["answer"],
            "sources": result.get("sources") or [],
            "follow_ups": result.get("follow_ups") or [],
            "memories_used": memories_used,
            "skills_used": skills_used,
        },
    }


def _prepare_turn(
    org_id: str,
    message: str,
    session_id: str | None,
    user_id: str,
) -> tuple[str, list[dict], str, list[dict], list[dict]]:
    """Save user message, return (session_id, prior_history, memory_block, memories_used, skills_used)."""
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
    prior = history[:-1] if history else []
    memory_block, memories_used, skills_used = build_context(
        org_id, user_id, message, session_id=session_id,
    )
    return session_id, prior, memory_block, memories_used, skills_used


def send_message_stream(
    org_id: str,
    message: str,
    session_id: str | None = None,
    user_id: str = _DEFAULT_USER,
    cancel_check: Callable[[], bool] | None = None,
) -> Iterator[str]:
    """
    SSE 流：status → sources → token* → done
    每行格式：data: {json}\n\n
    cancel_check 返回 True 时中止流，不保存 assistant 消息、不发送 done。
    """
    session_id, prior, memory_block, memories_used, skills_used = _prepare_turn(
        org_id, message, session_id, user_id,
    )
    wiki, graph = _wiki_and_graph(org_id)
    agent = ChatAgent(wiki, graph)

    answer = ""
    sources: list = []
    follow_ups: list = []

    chat_profile = get_model_settings(org_id, user_id).chat_profile

    def _tracked_stream():
        with track_usage(org_id, user_id, "chat", session_id):
            yield from agent.run_stream(
                message, prior, org_id, memory_context=memory_block, chat_profile=chat_profile,
                user_id=user_id,
            )

    for event in _tracked_stream():
        if cancel_check and cancel_check():
            log.info(
                "[chat] stream aborted  org=%s  session=%s  partial_chars=%d",
                org_id, session_id[:8], len(answer),
            )
            return
        if event["type"] == "token":
            answer += event["text"]
        elif event["type"] == "sources":
            sources = event["sources"]
        elif event["type"] == "complete":
            answer = event["answer"]
            sources = event["sources"]
            follow_ups = event["follow_ups"]
            continue
        yield f"data: {json.dumps(event, ensure_ascii=False)}\n\n"

    if cancel_check and cancel_check():
        log.info(
            "[chat] stream aborted before save  org=%s  session=%s",
            org_id, session_id[:8],
        )
        return

    _registry.add_message(
        session_id,
        org_id,
        user_id,
        "assistant",
        answer,
        sources=sources,
        follow_ups=follow_ups,
    )
    log.info(
        "[chat] stream saved  org=%s  session=%s  sources=%d  memories=%d  skills=%d",
        org_id, session_id[:8], len(sources), len(memories_used), len(skills_used),
    )

    done = {
        "type": "done",
        "session_id": session_id,
        "answer": answer,
        "sources": sources,
        "follow_ups": follow_ups,
        "memories_used": memories_used,
        "skills_used": skills_used,
        "turn": {
            "question": message,
            "answer": answer,
            "sources": sources,
            "follow_ups": follow_ups,
            "memories_used": memories_used,
            "skills_used": skills_used,
        },
    }
    yield f"data: {json.dumps(done, ensure_ascii=False)}\n\n"
