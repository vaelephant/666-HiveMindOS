import mimetypes
import uuid
from dataclasses import asdict
from pathlib import Path

from fastapi import APIRouter, BackgroundTasks, HTTPException, Query, UploadFile, File, Form
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field

from memory_layer.knowledge_base import config
from memory_layer.knowledge_base.app.logging_config import get_logger
from memory_layer.knowledge_base.core.agents.ingest_agent import IngestAgent
from memory_layer.knowledge_base.core.services.doc_memory_service import extract_memories_from_ingest
from memory_layer.knowledge_base.core.domain.source_formats import (
    MEDIA_SOURCE_TYPES,
    source_type_from_filename,
)
from memory_layer.knowledge_base.core.registry.source_registry import SourceRecord, SourceRegistry
from memory_layer.knowledge_base.core.wiki.wiki_manager import WikiManager
from memory_layer.knowledge_base.core.wiki import wiki_meta
from memory_layer.knowledge_base.core.graph.memory_graph import MemoryGraph
from model_layer.usage import track_usage

router = APIRouter()
log = get_logger("hivemind.ingest")

_MEDIA_TYPES = MEDIA_SOURCE_TYPES

_registry = SourceRegistry(config.REGISTRY_DB)

_COLLECTION_MAX_LEN = 64


def _normalize_collection(value: str | None) -> str | None:
    if value is None:
        return None
    name = value.strip()
    if not name:
        return None
    if len(name) > _COLLECTION_MAX_LEN:
        raise HTTPException(status_code=400, detail=f"集合名称不能超过 {_COLLECTION_MAX_LEN} 个字符")
    if "/" in name or "\\" in name:
        raise HTTPException(status_code=400, detail="集合名称不能包含斜杠")
    return name


class SourcePatch(BaseModel):
    collection: str | None = Field(default=None)


def _make_agent(org_id: str) -> IngestAgent:
    wiki = WikiManager(config.WIKI_ROOT)
    graph = MemoryGraph(config.GRAPH_ROOT / org_id / "graph.db")
    return IngestAgent(wiki, graph)


# ── Step 1: Upload & save ────────────────────────────────────────────────────

@router.post("/orgs/{org_id}/sources")
async def upload_source(
    org_id: str,
    file: UploadFile = File(...),
    collection: str | None = Form(None),
):
    """Save the raw file and record it. No AI processing yet."""
    collection = _normalize_collection(collection)
    content = await file.read()
    filename = file.filename or "upload"
    source_type = source_type_from_filename(filename)
    suffix = Path(filename).suffix.lower()

    raw_dir = config.RAW_ROOT / org_id
    raw_dir.mkdir(parents=True, exist_ok=True)
    source_id = str(uuid.uuid4())
    stem = Path(filename).stem
    save_path = raw_dir / filename
    if save_path.exists():
        save_path = raw_dir / f"{stem}_{source_id[:8]}{suffix}"
    save_path.write_bytes(content)

    record = SourceRecord(
        id=source_id,
        org_id=org_id,
        filename=filename,
        file_path=str(save_path),
        source_type=source_type,
        status="uploaded",
        created_at=SourceRegistry.now_iso(),
        collection=collection,
    )
    _registry.add(record)
    log.info("[upload] org=%s  file=%s  collection=%s  size=%d bytes  saved=%s",
             org_id, filename, collection or "-", len(content), save_path.name)
    return asdict(record)


# ── List sources ─────────────────────────────────────────────────────────────

@router.get("/orgs/{org_id}/sources")
def list_sources(org_id: str):
    return {"sources": [asdict(r) for r in _registry.list(org_id)]}


@router.get("/orgs/{org_id}/collections")
def list_collections(org_id: str):
    return {
        "collections": _registry.list_collections(org_id),
        "uncategorized": _registry.count_uncategorized(org_id),
    }


@router.patch("/orgs/{org_id}/sources/{source_id}")
def patch_source(org_id: str, source_id: str, body: SourcePatch):
    record = _registry.get(source_id)
    if not record or record.org_id != org_id:
        raise HTTPException(status_code=404, detail="Source not found")
    collection = _normalize_collection(body.collection)
    _registry.update(source_id, collection=collection)
    log.info("[patch] org=%s  source=%s  collection=%s", org_id, source_id[:8], collection or "-")
    return asdict(_registry.get(source_id))


# ── Delete source ─────────────────────────────────────────────────────────────

@router.delete("/orgs/{org_id}/sources/{source_id}")
def delete_source(org_id: str, source_id: str):
    """Delete a source: remove wiki pages, raw file, and registry record."""
    record = _registry.get(source_id)
    if not record:
        raise HTTPException(status_code=404, detail="Source not found")

    # 删除关联的 Wiki 文件
    wiki_root = config.WIKI_ROOT / org_id
    deleted_pages = 0
    for rel_path in record.wiki_pages or []:
        p = wiki_root / rel_path
        if p.exists():
            p.unlink()
            deleted_pages += 1
        wiki_meta.delete_meta(config.WIKI_ROOT, org_id, rel_path)

    # 删除原始文件
    raw_path = Path(record.file_path)
    if raw_path.exists():
        raw_path.unlink()

    # 删除 registry 记录
    _registry.delete(source_id)

    log.info("[delete] org=%s  source=%s  file=%s  wiki_pages_removed=%d",
             org_id, source_id[:8], record.filename, deleted_pages)
    return {"deleted": source_id}


# ── Step 2: Compile ──────────────────────────────────────────────────────────

@router.post("/orgs/{org_id}/sources/{source_id}/compile")
def compile_source(
    org_id: str,
    source_id: str,
    background_tasks: BackgroundTasks,
    user_id: str = Query("demo"),
):
    """Trigger AI compilation for an uploaded source."""
    record = _registry.get(source_id)
    if not record:
        raise HTTPException(status_code=404, detail="Source not found")
    if record.source_type in _MEDIA_TYPES:
        raise HTTPException(status_code=400, detail="图片 / 视频 / 音频文件仅支持预览，暂不支持编译")
    if record.status == "done":
        raise HTTPException(status_code=409, detail="已编译完成，无需重复处理")
    if record.status == "compiling":
        raise HTTPException(status_code=409, detail="正在编译中，请稍候")

    # 删除上次编译生成的旧 Wiki 文件
    old_pages = record.wiki_pages or []
    if old_pages:
        wiki_root = config.WIKI_ROOT / org_id
        deleted = 0
        for rel_path in old_pages:
            p = wiki_root / rel_path
            if p.exists():
                p.unlink()
                deleted += 1
            wiki_meta.delete_meta(config.WIKI_ROOT, org_id, rel_path)
        log.info("[compile] cleaned %d old wiki pages for source=%s", deleted, source_id[:8])

    _registry.update(source_id, status="compiling")
    log.info("[compile] start  org=%s  source=%s  file=%s", org_id, source_id[:8], record.filename)
    try:
        with track_usage(org_id, user_id, "ingest", source_id):
            result = _make_agent(org_id).run(
                Path(record.file_path), org_id, record.source_type, source_id=source_id
            )
        _registry.update(
            source_id,
            status="done",
            entities_extracted=result["entities_extracted"],
            workflows_extracted=result["workflows_extracted"],
            wiki_pages_created=result["wiki_pages_created"],
            wiki_pages=result["pages"],
        )
        log.info(
            "[compile] done   org=%s  source=%s  "
            "entities=%d(new=%d merged=%d) conflicts=%d  workflows=%d  pages=%d",
            org_id, source_id[:8],
            result["entities_extracted"],
            result.get("entities_new", 0),
            result.get("entities_merged", 0),
            result.get("conflicts_detected", 0),
            result["workflows_extracted"],
            result["wiki_pages_created"],
        )
    except Exception as exc:
        _registry.update(source_id, status="error", error=str(exc))
        log.error("[compile] error  org=%s  source=%s  err=%s", org_id, source_id[:8], exc)
        raise HTTPException(status_code=500, detail=str(exc))

    background_tasks.add_task(extract_memories_from_ingest, org_id, source_id, result, user_id)
    return asdict(_registry.get(source_id))


@router.get("/orgs/{org_id}/sources/{source_id}/file")
def download_source_file(org_id: str, source_id: str, download: bool = False):
    """Serve original uploaded file. Default inline (preview); ?download=true forces attachment."""
    record = _registry.get(source_id)
    if not record or record.org_id != org_id:
        raise HTTPException(status_code=404, detail="Source not found")
    path = Path(record.file_path)
    if not path.exists():
        raise HTTPException(status_code=404, detail="原始文件不存在")
    media, _ = mimetypes.guess_type(record.filename)
    return FileResponse(
        path,
        media_type=media or "application/octet-stream",
        filename=record.filename,
        content_disposition_type="attachment" if download else "inline",
    )

