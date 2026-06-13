"""HiveMindOS 全局配置 — 路径、数据库、Qdrant、模型 env。"""

from __future__ import annotations

import os
from pathlib import Path

try:
    from dotenv import load_dotenv

    _repo_root = Path(__file__).resolve().parents[2]
    load_dotenv(_repo_root / ".env")
    load_dotenv(_repo_root / "webui" / ".env", override=True)
except ImportError:
    pass

from model_layer.registry import resolve_chat, resolve_embed

_BACKEND = Path(__file__).resolve().parent.parent
_REPO_ROOT = Path(__file__).resolve().parents[2]


def _resolve_path(env_key: str, default: Path) -> Path:
    raw = os.environ.get(env_key)
    if not raw:
        return default
    p = Path(raw)
    if p.is_absolute():
        return p
    return (_REPO_ROOT / p).resolve()


OPENAI_API_KEY: str = os.environ.get("OPENAI_API_KEY", "")
ANTHROPIC_API_KEY: str = os.environ.get("ANTHROPIC_API_KEY", "")

DEFAULT_MODEL: str = resolve_chat("default").model
FAST_MODEL: str = resolve_chat("fast").model

# 运行时数据（默认仓库根 storage/；相对路径均相对 repo 根解析）
STORAGE_ROOT: Path = _resolve_path("STORAGE_ROOT", _REPO_ROOT / "storage")
RAW_ROOT: Path = STORAGE_ROOT / "raw"
WIKI_ROOT: Path = STORAGE_ROOT / "wiki"
GRAPH_ROOT: Path = STORAGE_ROOT / "graph"
SKILLS_ROOT: Path = _resolve_path(
    "SKILLS_ROOT",
    _BACKEND / "agent_engine" / "storage" / "skills",
)
ORGS_ROOT: Path = STORAGE_ROOT / "orgs"
REGISTRY_DB: Path = STORAGE_ROOT / "registry.db"
TASK_DB: Path = STORAGE_ROOT / "tasks.db"
AUTOMATION_DB: Path = STORAGE_ROOT / "automation_runs.db"
WORKFLOW_DB: Path = STORAGE_ROOT / "workflows.db"
LOG_DIR: Path = STORAGE_ROOT / "logs"

# PostgreSQL
QDRANT_URL: str = os.environ.get("QDRANT_URL", "http://localhost:6333")
QDRANT_API_KEY: str = os.environ.get("QDRANT_API_KEY", "")
QDRANT_COLLECTION: str = os.environ.get("QDRANT_COLLECTION", "hivemind_memories")
EXPERIENCE_COLLECTION: str = os.environ.get("EXPERIENCE_COLLECTION", "hivemind_experiences")
EMBEDDING_MODEL: str = resolve_embed("embedding").model
EMBEDDING_DIM: int = resolve_embed("embedding").dim or 1536
QDRANT_ENABLED: bool = os.environ.get("QDRANT_ENABLED", "true").lower() in ("1", "true", "yes")

DATABASE_URL: str = os.environ.get(
    "DATABASE_URL",
    (
        f"postgresql://{os.environ.get('DB_USER', 'postgres')}"
        f":{os.environ.get('DB_PASSWORD', '')}"
        f"@{os.environ.get('DB_HOST', 'localhost')}"
        f":{os.environ.get('DB_PORT', '5432')}"
        f"/{os.environ.get('DB_NAME', 'hivemindos')}"
    ),
)

# 向后兼容（旧代码可能仍引用）
SETTINGS_DIR: Path = _BACKEND / "knowledge_base" / "settings"
PROMPTS_FILE: Path = _BACKEND / "prompts" / "prompts.yaml"
