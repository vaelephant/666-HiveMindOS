"""资料库上传 — 常见文档 / 媒体格式映射（前后端语义一致）。"""

from __future__ import annotations

# 后缀 → source_type（用于存储、编译路由、预览）
SUFFIX_TO_TYPE: dict[str, str] = {
    # PDF
    ".pdf": "pdf",
    # Word
    ".doc": "word",
    ".docx": "word",
    ".docm": "word",
    ".odt": "word",
    ".rtf": "word",
    ".wps": "word",  # WPS 文字
    # Excel
    ".xls": "excel",
    ".xlsx": "excel",
    ".xlsm": "excel",
    ".xlsb": "excel",
    ".ods": "excel",
    ".csv": "excel",
    ".tsv": "excel",
    ".et": "excel",  # WPS 表格
    # PowerPoint
    ".ppt": "ppt",
    ".pptx": "ppt",
    ".pptm": "ppt",
    ".odp": "ppt",
    ".pot": "ppt",
    ".potx": "ppt",
    ".pps": "ppt",
    ".ppsx": "ppt",
    ".dps": "ppt",  # WPS 演示
    # 纯文本 / 标记
    ".txt": "text",
    ".md": "text",
    ".markdown": "text",
    ".json": "text",
    ".xml": "text",
    ".yaml": "text",
    ".yml": "text",
    ".html": "text",
    ".htm": "text",
    ".log": "text",
    # 图片
    ".png": "image",
    ".jpg": "image",
    ".jpeg": "image",
    ".gif": "image",
    ".webp": "image",
    ".svg": "image",
    ".bmp": "image",
    ".ico": "image",
    ".heic": "image",
    ".heif": "image",
    ".tif": "image",
    ".tiff": "image",
    # 视频
    ".mp4": "video",
    ".mov": "video",
    ".webm": "video",
    ".avi": "video",
    ".mkv": "video",
    ".m4v": "video",
    ".wmv": "video",
    ".flv": "video",
    # 音频
    ".mp3": "audio",
    ".wav": "audio",
    ".m4a": "audio",
    ".ogg": "audio",
    ".flac": "audio",
    ".aac": "audio",
    ".wma": "audio",
}

# 仅预览、不参与 AI 编译
MEDIA_SOURCE_TYPES = frozenset({"image", "video", "audio"})

# 浏览器 file input accept（扩展名 + MIME，避免 macOS 文件选择器漏掉 Office 格式）
UPLOAD_ACCEPT_PARTS: list[str] = [
    # 扩展名
    *SUFFIX_TO_TYPE.keys(),
    # MIME — Office（PPT 在部分系统上仅靠扩展名无法选中）
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-word.document.macroEnabled.12",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/vnd.ms-excel.sheet.macroEnabled.12",
    "application/vnd.ms-excel.sheet.binary.macroEnabled.12",
    "application/vnd.ms-powerpoint",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    "application/vnd.ms-powerpoint.presentation.macroEnabled.12",
    "application/vnd.oasis.opendocument.text",
    "application/vnd.oasis.opendocument.spreadsheet",
    "application/vnd.oasis.opendocument.presentation",
    "application/rtf",
    "text/plain",
    "text/csv",
    "text/markdown",
    "text/html",
    "text/xml",
    "application/json",
    "application/xml",
    "image/*",
    "video/*",
    "audio/*",
]


def source_type_from_filename(filename: str) -> str:
    from pathlib import Path

    suffix = Path(filename).suffix.lower()
    return SUFFIX_TO_TYPE.get(suffix, "text")


def is_media_source_type(source_type: str) -> bool:
    return source_type in MEDIA_SOURCE_TYPES
