import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parents[4]))
from model_layer import client as llm
from memory_layer.knowledge_base import config
from memory_layer.knowledge_base.app.logging_config import get_logger
from memory_layer.knowledge_base.core.parsers.llm_json import parse_json_object
from memory_layer.knowledge_base.prompts import get, render

log = get_logger("hivemind.compiler.workflow")

_WORKFLOW = get("ingest.workflow_extractor")


def extract_workflows(content: str) -> dict:
    max_chars = _WORKFLOW.limit("content_max_chars", 16000)
    prompt = render("ingest.workflow_extractor", content=content[:max_chars])
    raw = llm.complete(
        prompt,
        system=_WORKFLOW.system,
        model=_WORKFLOW.resolve_model(config),
    )
    log.debug("workflow extractor raw response length=%d", len(raw))
    try:
        result = parse_json_object(raw)
        log.debug(
            "parsed %d workflows, %d rules",
            len(result.get("workflows", [])),
            len(result.get("rules", [])),
        )
        return result
    except (json.JSONDecodeError, ValueError) as exc:
        log.warning("workflow extractor parse failed: %s", exc)
        return {"workflows": [], "rules": []}
