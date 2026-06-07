import os
from pathlib import Path

ANTHROPIC_API_KEY: str = os.environ.get("ANTHROPIC_API_KEY", "")
DEFAULT_MODEL: str = os.environ.get("DEFAULT_MODEL", "claude-opus-4-7")
FAST_MODEL: str = os.environ.get("FAST_MODEL", "claude-sonnet-4-6")

_BASE = Path(__file__).parent
STORAGE_ROOT: Path = Path(os.environ.get("STORAGE_ROOT", str(_BASE / "storage")))
RAW_ROOT: Path = STORAGE_ROOT / "raw"
WIKI_ROOT: Path = STORAGE_ROOT / "wiki"
GRAPH_ROOT: Path = STORAGE_ROOT / "graph"
REGISTRY_DB: Path = STORAGE_ROOT / "registry.db"

MAX_FILE_SIZE_BYTES: int = 20 * 1024 * 1024  # 20MB
