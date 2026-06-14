import mimetypes
import uuid
from pathlib import Path

from fastapi import APIRouter, BackgroundTasks, File, Form, HTTPException, Query, UploadFile
from fastapi.responses import FileResponse

from shared import config
from server.logging_config import get_logger
from knowledge_base.core.domain.source_formats import source_type_from_filename
from knowledge_base.core.registry.source_registry import SourceRecord, SourceRegistry
from health_layer.core.registry.health_registry import HealthRegistry
from health_layer.core.pipelines.health_compile_agent import HealthCompileAgent
from health_layer.core.services.health_memory_service import write_health_memory
from model_layer.usage import track_usage

router = APIRouter()
log = get_logger("hivemind.health")

_registry = SourceRegistry(config.REGISTRY_DB)
_health = HealthRegistry()
_compile = HealthCompileAgent()

_ALLOWED_SUFFIXES = {
    ".pdf", ".png", ".jpg", ".jpeg", ".webp", ".tif", ".tiff", ".bmp", ".gif",
    ".heic", ".heif", ".txt", ".json",
}


def _compile_background(report_id: str, org_id: str, user_id: str) -> None:
    try:
        with track_usage(org_id, user_id, "health_compile", report_id):
            result = _compile.run(report_id, org_id, user_id)
        if result.get("status") == "done":
            write_health_memory(org_id, report_id, user_id)
    except Exception as exc:
        log.error("[health] compile failed  org=%s  report=%s  err=%s", org_id, report_id[:8], exc)
        _health.set_status(report_id, org_id, "failed", error_message=str(exc))


@router.post("/orgs/{org_id}/health/reports")
async def upload_health_report(
    org_id: str,
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    user_id: str = Form("demo"),
    report_date: str | None = Form(None),
    institution: str | None = Form(None),
):
    """Upload a PDF/image health report and start async compilation."""
    content = await file.read()
    filename = file.filename or "report"
    suffix = Path(filename).suffix.lower()
    if suffix not in _ALLOWED_SUFFIXES:
        raise HTTPException(status_code=400, detail=f"不支持的文件类型: {suffix}")

    raw_dir = config.RAW_ROOT / org_id / "health"
    raw_dir.mkdir(parents=True, exist_ok=True)
    source_id = str(uuid.uuid4())
    stem = Path(filename).stem
    save_path = raw_dir / filename
    if save_path.exists():
        save_path = raw_dir / f"{stem}_{source_id[:8]}{suffix}"
    save_path.write_bytes(content)

    source_type = source_type_from_filename(filename)
    record = SourceRecord(
        id=source_id,
        org_id=org_id,
        filename=filename,
        file_path=str(save_path),
        source_type=source_type,
        status="uploaded",
        created_at=SourceRegistry.now_iso(),
        collection="health",
    )
    _registry.add(record)

    report_id = _health.create_report(
        org_id=org_id,
        user_id=user_id,
        source_id=source_id,
        report_date=report_date,
        institution=institution,
    )
    background_tasks.add_task(_compile_background, report_id, org_id, user_id)

    log.info(
        "[health] upload  org=%s  user=%s  report=%s  file=%s  bytes=%d",
        org_id, user_id, report_id[:8], filename, len(content),
    )
    report = _health.get_report(report_id, org_id)
    return report.to_dict() if report else {"id": report_id}


@router.get("/orgs/{org_id}/health/reports")
def list_health_reports(
    org_id: str,
    user_id: str = Query("demo"),
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
):
    reports = _health.list_reports(org_id, user_id, limit=limit, offset=offset)
    return {
        "reports": [
            {
                "id": r.id,
                "source_id": r.source_id,
                "report_category": r.report_category,
                "report_subtype": r.report_subtype,
                "report_date": r.report_date,
                "institution": r.institution,
                "summary": r.summary,
                "extract_status": r.extract_status,
                "error_message": r.error_message,
                "created_at": r.created_at,
            }
            for r in reports
        ],
        "limit": limit,
        "offset": offset,
    }


@router.get("/orgs/{org_id}/health/reports/{report_id}")
def get_health_report(
    org_id: str,
    report_id: str,
    user_id: str = Query("demo"),
    include_full_text: bool = Query(False),
):
    report = _health.get_report(report_id, org_id, include_observations=True)
    if not report or report.user_id != user_id:
        raise HTTPException(status_code=404, detail="Report not found")
    payload = report.to_dict()
    if not include_full_text:
        payload.pop("full_text", None)
    return payload


@router.get("/orgs/{org_id}/health/reports/{report_id}/file")
def download_health_report_file(org_id: str, report_id: str, download: bool = False):
    report = _health.get_report(report_id, org_id)
    if not report or not report.source_id:
        raise HTTPException(status_code=404, detail="Report not found")
    record = _registry.get(report.source_id)
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


@router.post("/orgs/{org_id}/health/reports/{report_id}/compile")
def recompile_health_report(
    org_id: str,
    report_id: str,
    background_tasks: BackgroundTasks,
    user_id: str = Query("demo"),
):
    report = _health.get_report(report_id, org_id)
    if not report or report.user_id != user_id:
        raise HTTPException(status_code=404, detail="Report not found")
    if report.extract_status == "processing":
        raise HTTPException(status_code=409, detail="正在解析中")
    background_tasks.add_task(_compile_background, report_id, org_id, user_id)
    _health.set_status(report_id, org_id, "pending")
    return {"report_id": report_id, "extract_status": "pending"}
