from pathlib import Path

from dotenv import load_dotenv

_repo_root = Path(__file__).resolve().parent.parent
load_dotenv(_repo_root / ".env")
load_dotenv(_repo_root / "webui" / ".env", override=True)

from server.main import app  # noqa: E402

__all__ = ["app"]
