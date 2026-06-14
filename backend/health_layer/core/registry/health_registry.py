"""PostgreSQL persistence for health reports and lab observations."""

from __future__ import annotations

from typing import Any

from shared.db.postgres import pg_conn
from health_layer.models.report import HealthObservation, HealthReport, observation_to_dict


class HealthRegistry:
    def create_report(
        self,
        *,
        org_id: str,
        user_id: str,
        source_id: str | None = None,
        report_date: str | None = None,
        institution: str | None = None,
    ) -> str:
        with pg_conn() as conn:
            row = conn.execute(
                """
                INSERT INTO health_reports
                    (org_id, user_id, source_id, report_date, institution, extract_status)
                VALUES (%s, %s, %s, %s::timestamptz, %s, 'pending')
                RETURNING id::text
                """,
                (org_id, user_id, source_id, report_date, institution),
            ).fetchone()
            conn.commit()
        return row[0]

    def set_status(
        self,
        report_id: str,
        org_id: str,
        status: str,
        *,
        error_message: str | None = None,
    ) -> None:
        with pg_conn() as conn:
            conn.execute(
                """
                UPDATE health_reports
                SET extract_status = %s,
                    error_message = %s,
                    updated_at = NOW()
                WHERE id = %s::uuid AND org_id = %s
                """,
                (status, error_message, report_id, org_id),
            )
            conn.commit()

    def save_compile_result(
        self,
        report_id: str,
        org_id: str,
        *,
        report_category: str,
        report_subtype: str | None,
        report_date: str | None,
        date_inferred: bool,
        institution: str | None,
        full_text: str,
        summary: str | None,
        classification_confidence: float | None,
        observations: list[dict[str, Any]],
        user_id: str,
    ) -> None:
        with pg_conn() as conn:
            conn.execute(
                """
                UPDATE health_reports
                SET report_category = %s,
                    report_subtype = %s,
                    report_date = COALESCE(%s::timestamptz, report_date),
                    date_inferred = %s,
                    institution = COALESCE(%s, institution),
                    full_text = %s,
                    summary = %s,
                    classification_confidence = %s,
                    extract_status = 'done',
                    error_message = NULL,
                    updated_at = NOW()
                WHERE id = %s::uuid AND org_id = %s
                """,
                (
                    report_category,
                    report_subtype,
                    report_date,
                    date_inferred,
                    institution,
                    full_text,
                    summary,
                    classification_confidence,
                    report_id,
                    org_id,
                ),
            )
            conn.execute(
                "DELETE FROM health_observations WHERE report_id = %s::uuid",
                (report_id,),
            )
            for idx, obs in enumerate(observations):
                conn.execute(
                    """
                    INSERT INTO health_observations (
                        report_id, org_id, user_id, code, display_name,
                        value_num, value_text, unit, ref_low, ref_high,
                        is_abnormal, confidence, sort_order
                    ) VALUES (
                        %s::uuid, %s, %s, %s, %s,
                        %s, %s, %s, %s, %s,
                        %s, %s, %s
                    )
                    """,
                    (
                        report_id,
                        org_id,
                        user_id,
                        obs.get("code"),
                        obs["display_name"],
                        obs.get("value_num"),
                        obs.get("value_text"),
                        obs.get("unit"),
                        obs.get("ref_low"),
                        obs.get("ref_high"),
                        obs.get("is_abnormal"),
                        obs.get("confidence"),
                        idx,
                    ),
                )
            conn.commit()

    def get_report(
        self,
        report_id: str,
        org_id: str,
        *,
        include_observations: bool = False,
    ) -> HealthReport | None:
        with pg_conn() as conn:
            row = conn.execute(
                """
                SELECT id::text, org_id, user_id, source_id,
                       report_category, report_subtype,
                       report_date::text, date_inferred, institution,
                       full_text, summary, extract_status, extract_version,
                       classification_confidence, error_message,
                       created_at::text, updated_at::text
                FROM health_reports
                WHERE id = %s::uuid AND org_id = %s
                """,
                (report_id, org_id),
            ).fetchone()
            if not row:
                return None
            report = self._row_to_report(row)
            if include_observations:
                obs_rows = conn.execute(
                    """
                    SELECT id, report_id::text, org_id, user_id, code, display_name,
                           value_num, value_text, unit, ref_low, ref_high,
                           is_abnormal, confidence, sort_order
                    FROM health_observations
                    WHERE report_id = %s::uuid
                    ORDER BY sort_order, id
                    """,
                    (report_id,),
                ).fetchall()
                report.observations = [self._row_to_observation(r) for r in obs_rows]
            return report

    def list_reports(
        self,
        org_id: str,
        user_id: str,
        *,
        limit: int = 20,
        offset: int = 0,
    ) -> list[HealthReport]:
        with pg_conn() as conn:
            rows = conn.execute(
                """
                SELECT id::text, org_id, user_id, source_id,
                       report_category, report_subtype,
                       report_date::text, date_inferred, institution,
                       full_text, summary, extract_status, extract_version,
                       classification_confidence, error_message,
                       created_at::text, updated_at::text
                FROM health_reports
                WHERE org_id = %s AND user_id = %s
                ORDER BY report_date DESC NULLS LAST, created_at DESC
                LIMIT %s OFFSET %s
                """,
                (org_id, user_id, limit, offset),
            ).fetchall()
        return [self._row_to_report(r) for r in rows]

    def query_observations(
        self,
        org_id: str,
        user_id: str,
        *,
        display_name: str | None = None,
        code: str | None = None,
        limit: int = 20,
    ) -> list[dict[str, Any]]:
        clauses = ["o.org_id = %s", "o.user_id = %s", "r.extract_status = 'done'"]
        params: list[Any] = [org_id, user_id]
        if display_name:
            clauses.append("o.display_name ILIKE %s")
            params.append(f"%{display_name}%")
        if code:
            clauses.append("o.code ILIKE %s")
            params.append(code)
        params.append(limit)
        sql = f"""
            SELECT o.id, o.report_id::text, o.display_name, o.code,
                   o.value_num, o.value_text, o.unit,
                   o.ref_low, o.ref_high, o.is_abnormal, o.confidence,
                   r.report_date::text, r.report_subtype, r.institution
            FROM health_observations o
            JOIN health_reports r ON r.id = o.report_id
            WHERE {' AND '.join(clauses)}
            ORDER BY r.report_date DESC NULLS LAST, o.sort_order
            LIMIT %s
        """
        with pg_conn() as conn:
            rows = conn.execute(sql, params).fetchall()
        return [
            {
                "id": r[0],
                "report_id": r[1],
                "display_name": r[2],
                "code": r[3],
                "value_num": r[4],
                "value_text": r[5],
                "unit": r[6],
                "ref_low": r[7],
                "ref_high": r[8],
                "is_abnormal": r[9],
                "confidence": r[10],
                "report_date": r[11],
                "report_subtype": r[12],
                "institution": r[13],
            }
            for r in rows
        ]

    def list_abnormal_observations(
        self,
        org_id: str,
        user_id: str,
        *,
        limit: int = 30,
    ) -> list[dict[str, Any]]:
        with pg_conn() as conn:
            rows = conn.execute(
                """
                SELECT o.id, o.report_id::text, o.display_name, o.code,
                       o.value_num, o.value_text, o.unit,
                       o.ref_low, o.ref_high, o.confidence,
                       r.report_date::text, r.report_subtype, r.institution
                FROM health_observations o
                JOIN health_reports r ON r.id = o.report_id
                WHERE o.org_id = %s AND o.user_id = %s
                  AND o.is_abnormal = true
                  AND r.extract_status = 'done'
                ORDER BY r.report_date DESC NULLS LAST, o.sort_order
                LIMIT %s
                """,
                (org_id, user_id, limit),
            ).fetchall()
        return [
            {
                "id": r[0],
                "report_id": r[1],
                "display_name": r[2],
                "code": r[3],
                "value_num": r[4],
                "value_text": r[5],
                "unit": r[6],
                "ref_low": r[7],
                "ref_high": r[8],
                "confidence": r[9],
                "report_date": r[10],
                "report_subtype": r[11],
                "institution": r[12],
            }
            for r in rows
        ]

    @staticmethod
    def _row_to_report(row) -> HealthReport:
        return HealthReport(
            id=row[0],
            org_id=row[1],
            user_id=row[2],
            source_id=row[3],
            report_category=row[4],
            report_subtype=row[5],
            report_date=row[6],
            date_inferred=row[7],
            institution=row[8],
            full_text=row[9] or "",
            summary=row[10],
            extract_status=row[11],
            extract_version=row[12],
            classification_confidence=row[13],
            error_message=row[14],
            created_at=row[15],
            updated_at=row[16],
        )

    @staticmethod
    def _row_to_observation(row) -> HealthObservation:
        return HealthObservation(
            id=row[0],
            report_id=row[1],
            org_id=row[2],
            user_id=row[3],
            code=row[4],
            display_name=row[5],
            value_num=row[6],
            value_text=row[7],
            unit=row[8],
            ref_low=row[9],
            ref_high=row[10],
            is_abnormal=row[11],
            confidence=row[12],
            sort_order=row[13],
        )

    @staticmethod
    def observation_dict(obs: HealthObservation) -> dict[str, Any]:
        return observation_to_dict(obs)
