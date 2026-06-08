import os
from pathlib import Path

try:
    from dotenv import load_dotenv

    _cfg_root = Path(__file__).resolve().parents[2]
    load_dotenv(_cfg_root / ".env")
    load_dotenv(_cfg_root / "webui" / ".env", override=True)
except ImportError:
    pass

OPENAI_API_KEY: str = os.environ.get("OPENAI_API_KEY", "")
DEFAULT_MODEL: str = os.environ.get("DEFAULT_MODEL", "claude-opus-4-7")
FAST_MODEL: str = os.environ.get("FAST_MODEL", "claude-sonnet-4-6")

_BASE = Path(__file__).parent
PROMPTS_FILE: Path = _BASE / "prompts" / "prompts.yaml"
SETTINGS_DIR: Path = _BASE / "settings"
STORAGE_ROOT: Path = Path(os.environ.get("STORAGE_ROOT", str(_BASE / "storage")))
RAW_ROOT: Path = STORAGE_ROOT / "raw"
WIKI_ROOT: Path = STORAGE_ROOT / "wiki"
GRAPH_ROOT: Path = STORAGE_ROOT / "graph"
REGISTRY_DB: Path = STORAGE_ROOT / "registry.db"
TASK_DB:        Path = STORAGE_ROOT / "tasks.db"
AUTOMATION_DB:  Path = STORAGE_ROOT / "automation_runs.db"
LOG_DIR: Path = STORAGE_ROOT / "logs"

MAX_FILE_SIZE_BYTES: int = 20 * 1024 * 1024  # 20MB

# PostgreSQL — Memory Layer（Raw Chat + Structured Memory）
# Qdrant — Layer 3 语义检索（智慧向量）
QDRANT_URL: str = os.environ.get("QDRANT_URL", "http://localhost:6333")
QDRANT_API_KEY: str = os.environ.get("QDRANT_API_KEY", "")
QDRANT_COLLECTION: str = os.environ.get("QDRANT_COLLECTION", "hivemind_memories")
EMBEDDING_MODEL: str = os.environ.get("EMBEDDING_MODEL", "text-embedding-3-small")
EMBEDDING_DIM: int = int(os.environ.get("EMBEDDING_DIM", "1536"))
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
