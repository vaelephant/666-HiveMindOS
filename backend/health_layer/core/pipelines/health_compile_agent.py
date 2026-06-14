"""Compile uploaded health reports: Vision OCR → classify → lab extract or summary."""

from __future__ import annotations

from pathlib import Path

from server.logging_config import get_logger
from shared import config
from knowledge_base.core.registry.source_registry import SourceRegistry
from health_layer.core.compiler.vision_ocr import extract_full_text
from health_layer.core.compiler.report_classifier import classify_report
from health_layer.core.compiler.lab_extractor import extract_lab_observations, summarize_report
from health_layer.core.registry.health_registry import HealthRegistry

log = get_logger("hivemind.health.compile")

_source_registry = SourceRegistry(config.REGISTRY_DB)
_health_registry = HealthRegistry()


class HealthCompileAgent:
    def run(
        self,
        report_id: str,
        org_id: str,
        user_id: str,
    ) -> dict:
        report = _health_registry.get_report(report_id, org_id)
        if not report:
            raise ValueError(f"report not found: {report_id}")
        if not report.source_id:
            raise ValueError("report has no source file")

        source = _source_registry.get(report.source_id)
        if not source or source.org_id != org_id:
            raise ValueError("source not found")

        _health_registry.set_status(report_id, org_id, "processing")
        path = Path(source.file_path)
        log.info(
            "[health] compile start  org=%s  report=%s  file=%s",
            org_id, report_id[:8], source.filename,
        )

        full_text, ocr_note = extract_full_text(path, source.source_type)
        if not full_text.strip():
            _health_registry.set_status(
                report_id, org_id, "failed", error_message="未能从文件中提取文字",
            )
            return {"status": "failed", "error": "未能从文件中提取文字"}

        classification = classify_report(full_text)
        category = classification["report_category"]
        observations: list[dict] = []
        summary: str | None = None

        if category == "lab":
            observations = extract_lab_observations(full_text)
            abnormal = [o for o in observations if o.get("is_abnormal")]
            parts = [
                classification.get("report_subtype") or "检验报告",
                f"共 {len(observations)} 项",
            ]
            if abnormal:
                names = "、".join(o["display_name"] for o in abnormal[:8])
                parts.append(f"异常：{names}")
            summary = "；".join(parts)
        else:
            summary = summarize_report(full_text, classification.get("report_subtype"))

        if ocr_note and summary:
            summary = f"{summary}（{ocr_note}）"
        elif ocr_note:
            summary = ocr_note

        report_date = classification.get("report_date") or report.report_date
        date_inferred = report.report_date is None and classification.get("report_date") is not None
        institution = report.institution or classification.get("institution")

        _health_registry.save_compile_result(
            report_id,
            org_id,
            report_category=category,
            report_subtype=classification.get("report_subtype"),
            report_date=report_date,
            date_inferred=date_inferred,
            institution=institution,
            full_text=full_text,
            summary=summary,
            classification_confidence=classification.get("confidence"),
            observations=observations,
            user_id=user_id,
        )

        log.info(
            "[health] compile done  org=%s  report=%s  category=%s  obs=%d",
            org_id, report_id[:8], category, len(observations),
        )
        return {
            "status": "done",
            "report_id": report_id,
            "report_category": category,
            "observations_count": len(observations),
            "summary": summary,
        }
