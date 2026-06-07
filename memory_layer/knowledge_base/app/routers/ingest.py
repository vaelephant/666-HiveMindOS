import uuid
from dataclasses import asdict
from pathlib import Path

from fastapi import APIRouter, HTTPException, UploadFile, File

from memory_layer.knowledge_base import config
from memory_layer.knowledge_base.core.agents.ingest_agent import IngestAgent
from memory_layer.knowledge_base.core.registry.source_registry import SourceRecord, SourceRegistry
from memory_layer.knowledge_base.core.wiki.wiki_manager import WikiManager
from memory_layer.knowledge_base.core.graph.memory_graph import MemoryGraph

router = APIRouter()

_SUFFIX_TO_TYPE = {
    ".pdf": "pdf", ".docx": "word", ".doc": "word",
    ".xlsx": "excel", ".xls": "excel", ".txt": "text",
}

_registry = SourceRegistry(config.REGISTRY_DB)


def _make_agent(org_id: str) -> IngestAgent:
    wiki = WikiManager(config.WIKI_ROOT)
    graph = MemoryGraph(config.GRAPH_ROOT / org_id / "graph.db")
    return IngestAgent(wiki, graph)


# ── Step 1: Upload & save ────────────────────────────────────────────────────

@router.post("/orgs/{org_id}/sources")
async def upload_source(org_id: str, file: UploadFile = File(...)):
    """Save the raw file and record it. No AI processing yet."""
    content = await file.read()
    if len(content) > config.MAX_FILE_SIZE_BYTES:
        raise HTTPException(status_code=413, detail="文件超过 20MB 限制")

    suffix = Path(file.filename).suffix.lower()
    source_type = _SUFFIX_TO_TYPE.get(suffix, "text")

    raw_dir = config.RAW_ROOT / org_id
    raw_dir.mkdir(parents=True, exist_ok=True)
    source_id = str(uuid.uuid4())
    stem = Path(file.filename).stem
    save_path = raw_dir / file.filename
    if save_path.exists():
        save_path = raw_dir / f"{stem}_{source_id[:8]}{suffix}"
    save_path.write_bytes(content)

    record = SourceRecord(
        id=source_id,
        org_id=org_id,
        filename=file.filename,
        file_path=str(save_path),
        source_type=source_type,
        status="uploaded",
        created_at=SourceRegistry.now_iso(),
    )
    _registry.add(record)
    return asdict(record)


# ── List sources ─────────────────────────────────────────────────────────────

@router.get("/orgs/{org_id}/sources")
def list_sources(org_id: str):
    return {"sources": [asdict(r) for r in _registry.list(org_id)]}


# ── Step 2: Compile ──────────────────────────────────────────────────────────

@router.post("/orgs/{org_id}/sources/{source_id}/compile")
def compile_source(org_id: str, source_id: str):
    """Trigger AI compilation for an uploaded source."""
    record = _registry.get(source_id)
    if not record:
        raise HTTPException(status_code=404, detail="Source not found")
    if record.status == "done":
        raise HTTPException(status_code=409, detail="已编译完成，无需重复处理")
    if record.status == "compiling":
        raise HTTPException(status_code=409, detail="正在编译中，请稍候")

    _registry.update(source_id, status="compiling")
    try:
        result = _make_agent(org_id).run(
            Path(record.file_path), org_id, record.source_type
        )
        _registry.update(
            source_id,
            status="done",
            entities_extracted=result["entities_extracted"],
            workflows_extracted=result["workflows_extracted"],
            wiki_pages_created=result["wiki_pages_created"],
        )
    except Exception as exc:
        _registry.update(source_id, status="error", error=str(exc))
        raise HTTPException(status_code=500, detail=str(exc))

    return asdict(_registry.get(source_id))
