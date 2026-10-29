from __future__ import annotations

from datetime import datetime, timezone

import numpy as np
from sklearn.ensemble import IsolationForest
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..models import ApprovedIntake, Enrolment, Finding, Institution


ACTIVE = {"accepted", "enrolled", "flagged", "completed"}


def feature_rows(db: Session, academic_year: str = "2025-26") -> list[dict]:
    institutions = db.scalars(select(Institution).order_by(Institution.name)).all()
    rows: list[dict] = []
    for institution in institutions:
        enrolments = db.scalars(
            select(Enrolment).where(
                Enrolment.institution_id == institution.id,
                Enrolment.academic_year == academic_year,
                Enrolment.status.in_(ACTIVE),
            )
        ).all()
        capacity = (
            db.scalar(
                select(func.sum(ApprovedIntake.regular_capacity)).where(
                    ApprovedIntake.institution_id == institution.id,
                    ApprovedIntake.academic_year == academic_year,
                )
            )
            or 0
        )
        total = len(enrolments)
        super_count = sum(1 for item in enrolments if item.seat_type == "supernumerary")
        nri = sum(1 for item in enrolments if item.nri_category)
        flagged = sum(1 for item in enrolments if item.status == "flagged")
        rows.append(
            {
                "institution_id": institution.id,
                "institution": institution.name,
                "academic_year": academic_year,
                "enrolment": total,
                "capacity": capacity,
                "utilization": total / capacity if capacity else 0.0,
                "supernumerary_ratio": super_count / total if total else 0.0,
                "nri_ratio": nri / total if total else 0.0,
                "flagged_ratio": flagged / total if total else 0.0,
            }
        )
    return rows


def run_isolation_forest(db: Session, academic_year: str = "2025-26") -> dict:
    rows = feature_rows(db, academic_year)
    if len(rows) < 10:
        return {
            "evaluated": len(rows),
            "findings": 0,
            "message": "At least 10 institutions are required.",
        }
    matrix = np.array(
        [
            [
                r["utilization"],
                r["supernumerary_ratio"],
                r["nri_ratio"],
                r["flagged_ratio"],
            ]
            for r in rows
        ]
    )
    model = IsolationForest(n_estimators=160, contamination=0.06, random_state=26263)
    labels = model.fit_predict(matrix)
    scores = model.decision_function(matrix)
    created = 0
    for row, label, score in zip(rows, labels, scores, strict=True):
        if label != -1:
            continue
        existing = db.scalar(
            select(Finding).where(
                Finding.institution_id == row["institution_id"],
                Finding.academic_year == academic_year,
                Finding.finding_type == "statistical_enrolment_outlier",
                Finding.review_state != "resolved",
            )
        )
        evidence = {
            **row,
            "model": "IsolationForest",
            "features": [
                "utilization",
                "supernumerary_ratio",
                "nri_ratio",
                "flagged_ratio",
            ],
        }
        explanation = (
            "The institution-level pattern differs from the synthetic peer distribution across intake utilization, "
            "supernumerary share, NRI share and flagged-record share. The score is an outlier ranking, not a probability "
            "of misconduct, and requires human review."
        )
        if existing:
            existing.evidence = evidence
            existing.model_score = float(score)
            existing.updated_at = datetime.now(timezone.utc)
        else:
            db.add(
                Finding(
                    institution_id=row["institution_id"],
                    academic_year=academic_year,
                    finding_type="statistical_enrolment_outlier",
                    source="isolation_forest",
                    severity="medium",
                    title="Unusual institution-level enrolment pattern",
                    explanation=explanation,
                    evidence=evidence,
                    model_score=float(score),
                )
            )
            created += 1
    db.commit()
    return {
        "evaluated": len(rows),
        "findings": int(sum(labels == -1)),
        "created": created,
        "model": "IsolationForest",
        "random_state": 26263,
    }
