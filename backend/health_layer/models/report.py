from __future__ import annotations

from dataclasses import dataclass
from typing import Any


@dataclass
class HealthObservation:
    id: int
    report_id: str
    org_id: str
    user_id: str
    code: str | None
    display_name: str
    value_num: float | None
    value_text: str | None
    unit: str | None
    ref_low: float | None
    ref_high: float | None
    is_abnormal: bool | None
    confidence: float | None
    sort_order: int


@dataclass
class HealthReport:
    id: str
    org_id: str
    user_id: str
    source_id: str | None
    report_category: str
    report_subtype: str | None
    report_date: str | None
    date_inferred: bool
    institution: str | None
    full_text: str
    summary: str | None
    extract_status: str
    extract_version: str
    classification_confidence: float | None
    error_message: str | None
    created_at: str
    updated_at: str
    observations: list[HealthObservation] | None = None

    def to_dict(self) -> dict[str, Any]:
        d: dict[str, Any] = {
            "id": self.id,
            "org_id": self.org_id,
            "user_id": self.user_id,
            "source_id": self.source_id,
            "report_category": self.report_category,
            "report_subtype": self.report_subtype,
            "report_date": self.report_date,
            "date_inferred": self.date_inferred,
            "institution": self.institution,
            "full_text": self.full_text,
            "summary": self.summary,
            "extract_status": self.extract_status,
            "extract_version": self.extract_version,
            "classification_confidence": self.classification_confidence,
            "error_message": self.error_message,
            "created_at": self.created_at,
            "updated_at": self.updated_at,
        }
        if self.observations is not None:
            d["observations"] = [observation_to_dict(o) for o in self.observations]
        return d


def observation_to_dict(obs: HealthObservation) -> dict[str, Any]:
    return {
        "id": obs.id,
        "report_id": obs.report_id,
        "code": obs.code,
        "display_name": obs.display_name,
        "value_num": obs.value_num,
        "value_text": obs.value_text,
        "unit": obs.unit,
        "ref_low": obs.ref_low,
        "ref_high": obs.ref_high,
        "is_abnormal": obs.is_abnormal,
        "confidence": obs.confidence,
        "sort_order": obs.sort_order,
    }
