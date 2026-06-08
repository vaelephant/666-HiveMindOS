from pathlib import Path

from dotenv import load_dotenv

_root = Path(__file__).resolve().parent
load_dotenv(_root / ".env")
load_dotenv(_root / "webui" / ".env", override=True)

from memory_layer.knowledge_base.app.main import app  # noqa: E402

__all__ = ["app"]
