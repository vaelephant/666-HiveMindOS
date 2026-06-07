import json
import uuid
from datetime import datetime
from pathlib import Path

_LOG_DIR = Path("audit_layer/logs")


def log(
    org_id: str,
    agent: str,
    action: str,
    input_data: dict,
    output_data: dict,
    duration_ms: int = 0,
    tokens_used: int = 0,
    approved_by: str = "auto",
) -> str:
    _LOG_DIR.mkdir(parents=True, exist_ok=True)
    event = {
        "event_id": f"evt_{uuid.uuid4().hex[:12]}",
        "timestamp": datetime.utcnow().isoformat() + "Z",
        "org_id": org_id,
        "agent": agent,
        "action": action,
        "input": input_data,
        "output": output_data,
        "approved_by": approved_by,
        "duration_ms": duration_ms,
        "tokens_used": tokens_used,
    }
    log_file = _LOG_DIR / f"{org_id}_{datetime.utcnow().strftime('%Y%m%d')}.jsonl"
    with log_file.open("a", encoding="utf-8") as f:
        f.write(json.dumps(event, ensure_ascii=False) + "\n")
    return event["event_id"]
