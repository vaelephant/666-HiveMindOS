"""Org playbook read/write — default YAML + per-org markdown override."""

from __future__ import annotations

from chat_layer.settings import load as load_chat
from shared import config
from server.logging_config import get_logger
from chat_layer.core.registry.chat_registry import ChatRegistry
from chat_layer.core.services.context_builder import _load_playbook
from shared.domain.taxonomy import memory_type_label

log = get_logger("hivemind.playbook")
_chat_registry = ChatRegistry()


def playbook_override_path(org_id: str):
    return config.ORGS_ROOT / org_id / "playbook.md"


def _invalidate_pinned_sessions(org_id: str) -> int:
    cleared = _chat_registry.clear_pinned_context_for_org(org_id)
    if cleared:
        log.info("[playbook] cleared pinned_context  org=%s  sessions=%d", org_id, cleared)
    return cleared


def get_playbook(org_id: str) -> dict:
    override = playbook_override_path(org_id)
    default_pb = load_chat("playbook")
    default_lines = []
    if default_pb.get("tone"):
        default_lines.append(f"语气：{default_pb['tone']}")
    for rule in default_pb.get("rules") or []:
        default_lines.append(f"- {rule}")
    default_body = "\n".join(default_lines)

    if override.is_file():
        content = override.read_text(encoding="utf-8")
        return {
            "source": "override",
            "content": content,
            "default_title": default_pb.get("title", "HiveMind"),
            "default_preview": default_body,
        }
    return {
        "source": "default",
        "content": _load_playbook(org_id),
        "default_title": default_pb.get("title", "HiveMind"),
        "default_preview": default_body,
    }


def save_playbook(org_id: str, content: str) -> dict:
    path = playbook_override_path(org_id)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content.strip() + "\n", encoding="utf-8")
    cleared = _invalidate_pinned_sessions(org_id)
    result = get_playbook(org_id)
    result["pinned_sessions_cleared"] = cleared
    return result


def reset_playbook(org_id: str) -> dict:
    path = playbook_override_path(org_id)
    if path.is_file():
        path.unlink()
    cleared = _invalidate_pinned_sessions(org_id)
    result = get_playbook(org_id)
    result["pinned_sessions_cleared"] = cleared
    return result


def preview_playbook(org_id: str, user_id: str, content: str | None = None) -> dict:
    """Preview the Chat pinned block (playbook draft + pinned memories)."""
    from chat_layer.core.services.context_builder import build_pinned_block

    kwargs: dict = {}
    if content is not None:
        kwargs["playbook_text"] = content.strip()
    block, pinned = build_pinned_block(org_id, user_id, **kwargs)
    cfg = load_chat("recall").get("pinned") or {}
    char_limit = int(cfg.get("char_limit") or 2200)
    return {
        "block": block,
        "char_count": len(block),
        "char_limit": char_limit,
        "truncated": len(block) >= char_limit,
        "memories_count": len(pinned),
        "memories": [
            {
                "id": m.id,
                "title": m.title,
                "memory_type": m.memory_type,
                "memory_type_label": memory_type_label(m.memory_type),
                "importance": m.importance,
            }
            for m in pinned
        ],
    }
