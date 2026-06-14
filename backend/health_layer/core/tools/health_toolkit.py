"""Chat tools for querying patient health reports."""

from __future__ import annotations

import json
from functools import lru_cache

from shared.settings import load
from health_layer.core.registry.health_registry import HealthRegistry

_registry = HealthRegistry()


@lru_cache(maxsize=1)
def health_tool_schemas() -> list[dict]:
    return list(load("tools").get("health_schemas") or [])


class HealthToolExecutor:
    def __init__(self, org_id: str, user_id: str):
        self._org_id = org_id
        self._user_id = user_id

    def __call__(self, name: str, args: dict) -> str:
        if name == "list_health_reports":
            return self.list_health_reports(args.get("limit", 10))
        if name == "get_health_report":
            return self.get_health_report(args.get("report_id", ""))
        if name == "query_lab_observations":
            return self.query_lab_observations(
                display_name=args.get("display_name"),
                code=args.get("code"),
                limit=args.get("limit", 20),
            )
        if name == "list_abnormal_observations":
            return self.list_abnormal_observations(args.get("limit", 30))
        return f"未知健康工具: {name}"

    def list_health_reports(self, limit: int = 10) -> str:
        reports = _registry.list_reports(
            self._org_id, self._user_id, limit=min(int(limit), 20),
        )
        if not reports:
            return "暂无检查报告"
        rows = [
            {
                "id": r.id,
                "report_category": r.report_category,
                "report_subtype": r.report_subtype,
                "report_date": r.report_date,
                "institution": r.institution,
                "summary": r.summary,
                "extract_status": r.extract_status,
            }
            for r in reports
        ]
        return json.dumps(rows, ensure_ascii=False, indent=2)

    def get_health_report(self, report_id: str) -> str:
        if not report_id:
            return "请提供 report_id"
        report = _registry.get_report(
            report_id, self._org_id, include_observations=True,
        )
        if not report:
            return f"未找到报告: {report_id}"
        payload = report.to_dict()
        if report.report_category != "lab":
            payload.pop("observations", None)
        payload["full_text"] = (report.full_text or "")[:4000]
        return json.dumps(payload, ensure_ascii=False, indent=2)

    def query_lab_observations(
        self,
        *,
        display_name: str | None = None,
        code: str | None = None,
        limit: int = 20,
    ) -> str:
        if not display_name and not code:
            return "请提供 display_name 或 code"
        rows = _registry.query_observations(
            self._org_id,
            self._user_id,
            display_name=display_name,
            code=code,
            limit=min(int(limit), 50),
        )
        if not rows:
            return "未找到匹配的检验指标历史记录"
        return json.dumps(rows, ensure_ascii=False, indent=2)

    def list_abnormal_observations(self, limit: int = 30) -> str:
        rows = _registry.list_abnormal_observations(
            self._org_id, self._user_id, limit=min(int(limit), 50),
        )
        if not rows:
            return "暂无异常检验指标记录"
        return json.dumps(rows, ensure_ascii=False, indent=2)
