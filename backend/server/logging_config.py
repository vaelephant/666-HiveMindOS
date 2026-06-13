import logging
import logging.handlers
import os

from shared.config import LOG_DIR

LOG_LEVEL = os.environ.get("LOG_LEVEL", "INFO").upper()

_FMT = "%(asctime)s  %(levelname)-8s  %(name)-30s  %(message)s"
_DATE = "%Y-%m-%d %H:%M:%S"

# ANSI color codes for console
_COLORS = {
    "DEBUG":    "\033[36m",   # cyan
    "INFO":     "\033[32m",   # green
    "WARNING":  "\033[33m",   # yellow
    "ERROR":    "\033[31m",   # red
    "CRITICAL": "\033[35m",   # magenta
}
_RESET = "\033[0m"


class ColorFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        color = _COLORS.get(record.levelname, "")
        record.levelname = f"{color}{record.levelname}{_RESET}"
        return super().format(record)


def setup_logging() -> None:
    LOG_DIR.mkdir(parents=True, exist_ok=True)

    root = logging.getLogger()
    root.setLevel(LOG_LEVEL)

    # Remove existing handlers (avoid duplication on --reload)
    root.handlers.clear()

    # ── Console handler (colored) ────────────────────────────────────────────
    console = logging.StreamHandler()
    console.setFormatter(ColorFormatter(_FMT, datefmt=_DATE))
    root.addHandler(console)

    # ── Rotating file handler (plain text) ───────────────────────────────────
    file_handler = logging.handlers.RotatingFileHandler(
        LOG_DIR / "hivemind.log",
        maxBytes=10 * 1024 * 1024,   # 10 MB per file
        backupCount=5,
        encoding="utf-8",
    )
    file_handler.setFormatter(logging.Formatter(_FMT, datefmt=_DATE))
    root.addHandler(file_handler)

    # Quiet noisy third-party loggers
    for noisy in ("httpx", "httpcore", "openai._base_client"):
        logging.getLogger(noisy).setLevel(logging.WARNING)


def get_logger(name: str) -> logging.Logger:
    return logging.getLogger(name)
