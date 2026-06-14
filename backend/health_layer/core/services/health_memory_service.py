"""Write health report summary into user memories after compile."""

from __future__ import annotations

from server.logging_config import get_logger
from memory_layer.models.memory import MemoryCandidate
from memory_layer.core.registry.memory_registry import MemoryRegistry
from memory_layer.core.services.memory_service import _index_memories
from health_layer.core.registry.health_registry import HealthRegistry
from model_layer.usage import track_usage

log = get_logger("hivemind.health.memory")

_registry = HealthRegistry()
_memory = MemoryRegistry()


def write_health_memory(org_id: str, report_id: str, user_id: str = "demo") -> int | None:
    try:
        with track_usage(org_id, user_id, "health_compile", report_id):
            return _write_inner(org_id, report_id, user_id)
    except Exception as exc:
        log.error("[health-memory] failed  org=%s  report=%s  err=%s", org_id, report_id[:8], exc)
        return None


def _write_inner(org_id: str, report_id: str, user_id: str) -> int | None:
    report = _registry.get_report(report_id, org_id, include_observations=True)
    if not report or report.extract_status != "done":
        return None

    title_parts = [report.report_subtype or "检查报告"]
    if report.report_date:
        title_parts.insert(0, report.report_date[:10])
    title = " ".join(title_parts)

    if report.report_category == "lab" and report.observations:
        abnormal = [o for o in report.observations if o.is_abnormal]
        lines = [report.summary or ""]
        for obs in abnormal[:10]:
            val = obs.value_text if obs.value_num is None else str(obs.value_num)
            unit = obs.unit or ""
            lines.append(f"{obs.display_name} {val}{unit}")
        content = "；".join(x for x in lines if x)
    else:
        content = report.summary or (report.full_text[:400] + "…")

    if not content.strip():
        return None

    memory_id = _memory.create(
        org_id,
        user_id,
        MemoryCandidate(
            action="create",
            memory_type="fact",
            title=title,
            content=content[:2000],
            importance=0.85,
        ),
        source_type="health",
        source_id=report_id,
    )
    _index_memories(org_id, [memory_id])
    log.info("[health-memory] created  org=%s  report=%s  memory=%d", org_id, report_id[:8], memory_id)
    return memory_id
