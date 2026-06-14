"""Render PDF pages to PNG bytes for OpenAI Vision."""

from __future__ import annotations

from pathlib import Path

from server.logging_config import get_logger

log = get_logger("hivemind.health.pdf")

_MAX_PAGES = 10


def render_pdf_pages(path: Path, *, max_pages: int = _MAX_PAGES) -> list[bytes]:
    try:
        import pypdfium2 as pdfium
    except ImportError:
        log.warning("pypdfium2 not installed — PDF vision fallback unavailable")
        return []

    images: list[bytes] = []
    try:
        pdf = pdfium.PdfDocument(str(path))
        page_count = min(len(pdf), max_pages)
        for i in range(page_count):
            page = pdf[i]
            bitmap = page.render(scale=2)
            pil = bitmap.to_pil()
            from io import BytesIO

            buf = BytesIO()
            pil.save(buf, format="PNG")
            images.append(buf.getvalue())
    except Exception as exc:
        log.warning("PDF render failed  path=%s  err=%s", path.name, exc)
    return images
