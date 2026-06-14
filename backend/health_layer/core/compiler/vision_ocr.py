"""OpenAI Vision OCR for health report images and PDF pages."""

from __future__ import annotations

import base64
from pathlib import Path

from server.logging_config import get_logger
from prompts import get, render
from model_layer import client as llm
from health_layer.core.compiler.pdf_pages import render_pdf_pages

log = get_logger("hivemind.health.vision")

_VISION = get("health.vision_ocr")
_IMAGE_SUFFIXES = {".png", ".jpg", ".jpeg", ".webp", ".tif", ".tiff", ".bmp", ".gif", ".heic", ".heif"}
_MIN_TEXT_CHARS = 80


def extract_full_text(path: Path, source_type: str) -> tuple[str, str | None]:
    """
    Returns (full_text, note).
    note is optional warning e.g. truncated pages.
    """
    suffix = path.suffix.lower()
    if suffix == ".pdf" or source_type == "pdf":
        return _extract_pdf(path)
    if suffix in _IMAGE_SUFFIXES or source_type == "image":
        text = _vision_ocr([path.read_bytes()], path.name)
        return text, None
    # Plain text/json fallback
    try:
        return path.read_text(encoding="utf-8", errors="replace"), None
    except OSError:
        return "", "无法读取文件"


def _extract_pdf(path: Path) -> tuple[str, str | None]:
    text = _pdf_text_layer(path)
    note = None
    if len(text.strip()) >= _MIN_TEXT_CHARS:
        return text, note

    pages = render_pdf_pages(path)
    if not pages:
        if text.strip():
            return text, "PDF 文本层不完整，未能渲染页面图片"
        return "", "PDF 无法提取文本且未能渲染页面"

    log.info("PDF vision OCR  pages=%d  file=%s", len(pages), path.name)
    vision_text = _vision_ocr(pages, path.name)
    if text.strip():
        combined = f"{text.strip()}\n\n--- OCR ---\n\n{vision_text}".strip()
    else:
        combined = vision_text
    try:
        import pypdfium2 as pdfium

        total_pages = len(pdfium.PdfDocument(str(path)))
    except Exception:
        total_pages = len(pages)
    if total_pages > len(pages):
        note = f"仅处理前 {len(pages)} 页"
    return combined, note


def _pdf_text_layer(path: Path) -> str:
    try:
        import PyPDF2

        reader = PyPDF2.PdfReader(str(path))
        chunks = []
        for i, page in enumerate(reader.pages, 1):
            page_text = page.extract_text() or ""
            chunks.append(f"[第{i}页]\n{page_text}")
        return "\n\n".join(chunks)
    except Exception as exc:
        log.warning("PDF text extraction failed: %s", exc)
        return ""


def _vision_ocr(image_bytes_list: list[bytes], filename: str) -> str:
    if not image_bytes_list:
        return ""
    prompt = render("health.vision_ocr", filename=filename)
    return llm.complete_vision(
        images=image_bytes_list,
        prompt=prompt,
        system=_VISION.system,
        profile=_VISION.resolve_profile(),
        max_tokens=_VISION.limit("max_tokens", 8192),
    )
