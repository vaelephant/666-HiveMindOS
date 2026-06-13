import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parents[3]))
from model_layer import client as llm
from shared import config
from server.logging_config import get_logger
from knowledge_base.core.parsers.llm_json import parse_json_object
from prompts import get, render

log = get_logger("hivemind.compiler.entity")

_ENTITY = get("ingest.entity_extractor")


def extract_entities(content: str) -> list[dict]:
    max_chars = _ENTITY.limit("content_max_chars", 16000)
    prompt = render("ingest.entity_extractor", content=content[:max_chars])
    raw = llm.complete(
        prompt,
        system=_ENTITY.system,
        profile=_ENTITY.resolve_profile(),
    )
    log.debug("entity extractor raw response length=%d", len(raw))
    try:
        result = parse_json_object(raw)
        return result.get("entities", [])
    except (json.JSONDecodeError, ValueError) as exc:
        log.warning("entity extractor parse failed: %s", exc)
        return []
