from dotenv import load_dotenv
load_dotenv()

from memory_layer.knowledge_base.app.main import app  # noqa: E402

__all__ = ["app"]
