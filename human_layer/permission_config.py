import json
from pathlib import Path
from dataclasses import dataclass, field, asdict

CONFIG_PATH = Path("human_layer/permissions.json")

_DEFAULT_CONFIG = {
    "auto_allowed": ["web_search", "file_read", "crm_read", "wiki_query"],
    "require_approval": ["wechat_work_send", "email_send", "crm_write", "contract_generate"],
    "always_forbidden": ["delete_customer", "modify_financial_records"],
}


def load(org_id: str) -> dict:
    path = CONFIG_PATH.parent / f"{org_id}_permissions.json"
    if path.exists():
        return json.loads(path.read_text())
    return _DEFAULT_CONFIG


def save(org_id: str, config: dict):
    CONFIG_PATH.parent.mkdir(parents=True, exist_ok=True)
    path = CONFIG_PATH.parent / f"{org_id}_permissions.json"
    path.write_text(json.dumps(config, ensure_ascii=False, indent=2))
