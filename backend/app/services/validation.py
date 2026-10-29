from __future__ import annotations

import re
from dataclasses import dataclass, field
from datetime import date

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..models import (
    ApprovedIntake,
    CapacityPolicy,
    Enrolment,
    Finding,
    Programme,
    Student,
)
from ..security import opaque_hash


APAAR_PATTERN = re.compile(r"^[0-9]{12}$")
ACTIVE_STATUSES = {"accepted", "enrolled", "completed", "flagged"}


@dataclass
class RowValidation:
    result: str = "accepted"
    errors: list[str] = field(default_factory=list)
    flags: list[str] = field(default_factory=list)


def valid_apaar_format(value: str | None) -> bool:
    return bool(value and APAAR_PATTERN.fullmatch(value.strip()))


def validate_student_row(
    db: Session, data: dict, institution_id: str, academic_year: str
) -> RowValidation:
    outcome = RowValidation()
    apaar = str(data.get("apaar_id") or "").strip()
    name = str(data.get("full_name") or "").strip()
    if not apaar:
        outcome.errors.append("APAAR identifier is missing")
    elif not valid_apaar_format(apaar):
        outcome.errors.append("APAAR identifier must contain exactly 12 digits")
    if not name:
        outcome.errors.append("Student name is required")
    if not str(data.get("institution_student_id") or "").strip():
        outcome.errors.append("Institution student ID is required")
    seat_type = str(data.get("seat_type") or "regular").lower()
    if seat_type not in {"regular", "supernumerary"}:
        outcome.errors.append("Seat type must be regular or supernumerary")
    if data.get("academic_year") and data["academic_year"] != academic_year:
        outcome.errors.append("Academic year does not match submission context")
    programme_id = data.get("programme_id")
    if programme_id:
        programme = db.get(Programme, programme_id)
        if not programme or programme.institution_id != institution_id:
            outcome.errors.append(
                "Programme does not belong to the selected institution"
            )
    for key in ("nri_category", "oci_status", "foreign_national"):
        if str(data.get(key, "")).strip().lower() not in {
            "",
            "true",
            "false",
            "yes",
            "no",
            "y",
            "n",
            "1",
            "0",
        }:
            outcome.errors.append(f"Invalid boolean value for {key}")
    if apaar and valid_apaar_format(apaar):
        existing = db.scalars(
            select(Student).where(Student.apaar_lookup == opaque_hash(apaar))
        ).all()
        for student in existing:
            if student.full_name.casefold() != name.casefold():
                outcome.flags.append(
                    "Same APAAR-like identifier is associated with a different internal name"
                )
            dob = parse_date(data.get("date_of_birth"))
            if dob and student.date_of_birth and dob != student.date_of_birth:
                outcome.flags.append(
                    "Date of birth conflicts with existing internal identity"
                )
            local = db.scalar(
                select(Enrolment).where(
                    Enrolment.student_id == student.id,
                    Enrolment.institution_id == institution_id,
                    Enrolment.academic_year == academic_year,
                    Enrolment.status.in_(ACTIVE_STATUSES),
                )
            )
            if local:
                outcome.errors.append(
                    "Duplicate active student enrolment within institution and academic year"
                )
            cross = db.scalar(
                select(Enrolment).where(
                    Enrolment.student_id == student.id,
                    Enrolment.institution_id != institution_id,
                    Enrolment.academic_year == academic_year,
                    Enrolment.status.in_(ACTIVE_STATUSES),
                )
            )
            incoming_intake = (
                db.scalar(
                    select(ApprovedIntake).where(
                        ApprovedIntake.programme_id == data.get("programme_id"),
                        ApprovedIntake.academic_year == academic_year,
                    )
                )
                if data.get("programme_id")
                else None
            )
            incoming_policy = (
                db.get(CapacityPolicy, incoming_intake.policy_id)
                if incoming_intake
                else None
            )
            permitted_concurrent = bool(
                incoming_policy
                and incoming_policy.rules.get("allow_concurrent_enrolment")
            )
            if cross and not permitted_concurrent:
                outcome.flags.append(
                    "Potential cross-institution active enrolment conflict"
                )
    if outcome.errors:
        outcome.result = "rejected"
    elif outcome.flags:
        outcome.result = "flagged"
    return outcome


def capacity_snapshot(
    db: Session, institution_id: str, programme_id: str, academic_year: str
) -> dict:
    intake = db.scalar(
        select(ApprovedIntake).where(
            ApprovedIntake.institution_id == institution_id,
            ApprovedIntake.programme_id == programme_id,
            ApprovedIntake.academic_year == academic_year,
        )
    )
    if not intake:
        return {"configured": False, "message": "No centrally authorized intake record"}
    policy = db.get(CapacityPolicy, intake.policy_id)
    rules = policy.rules if policy else {}
    count_statuses = rules.get("count_statuses", list(ACTIVE_STATUSES))
    rows = db.execute(
        select(Enrolment.seat_type, func.count(Enrolment.id))
        .where(
            Enrolment.institution_id == institution_id,
            Enrolment.programme_id == programme_id,
            Enrolment.academic_year == academic_year,
            Enrolment.status.in_(count_statuses),
        )
        .group_by(Enrolment.seat_type)
    ).all()
    counts = {key: value for key, value in rows}
    regular = sum(
        counts.get(seat, 0) for seat in rules.get("regular_counts", ["regular"])
    )
    supernumerary = sum(
        counts.get(seat, 0)
        for seat in rules.get("supernumerary_counts", ["supernumerary"])
    )
    if rules.get("nri_exempt_from_regular", False):
        regular -= (
            db.scalar(
                select(func.count(Enrolment.id)).where(
                    Enrolment.institution_id == institution_id,
                    Enrolment.programme_id == programme_id,
                    Enrolment.academic_year == academic_year,
                    Enrolment.status.in_(count_statuses),
                    Enrolment.seat_type == "regular",
                    Enrolment.nri_category.is_(True),
                )
            )
            or 0
        )
    return {
        "configured": True,
        "regular_capacity": intake.regular_capacity,
        "regular_enrolment": regular,
        "regular_utilization": round((regular / intake.regular_capacity * 100), 1)
        if intake.regular_capacity
        else 0,
        "regular_excess": max(0, regular - intake.regular_capacity),
        "regular_vacant": max(0, intake.regular_capacity - regular),
        "supernumerary_capacity": intake.supernumerary_capacity,
        "supernumerary_enrolment": supernumerary,
        "supernumerary_excess": max(0, supernumerary - intake.supernumerary_capacity),
        "policy_reference": policy.version if policy else "unconfigured",
        "counted_statuses": count_statuses,
        "category_policy": rules,
        "explanation": "Regular and authorized supernumerary seats are counted separately under the active demonstration policy.",
    }


def refresh_intake_finding(
    db: Session, institution_id: str, programme_id: str, academic_year: str
) -> Finding | None:
    snapshot = capacity_snapshot(db, institution_id, programme_id, academic_year)
    if not snapshot.get("configured") or snapshot["regular_excess"] <= 0:
        return None
    finding = db.scalar(
        select(Finding).where(
            Finding.institution_id == institution_id,
            Finding.programme_id == programme_id,
            Finding.academic_year == academic_year,
            Finding.finding_type == "intake_exceeded",
            Finding.review_state != "resolved",
        )
    )
    if not finding:
        finding = Finding(
            institution_id=institution_id,
            programme_id=programme_id,
            academic_year=academic_year,
            finding_type="intake_exceeded",
            source="deterministic",
            severity="critical" if snapshot["regular_excess"] >= 10 else "high",
            title=f"Regular intake exceeded by {snapshot['regular_excess']} admissions",
            explanation=(
                f"{snapshot['regular_enrolment']} active regular-seat enrolments were counted against "
                f"{snapshot['regular_capacity']} centrally authorized demonstration seats. "
                "Supernumerary records were excluded from this regular-seat calculation."
            ),
            evidence=snapshot,
        )
        db.add(finding)
    else:
        finding.evidence = snapshot
        finding.explanation = f"Counted regular enrolment exceeds authorized capacity by {snapshot['regular_excess']}."
    return finding


def parse_date(value: object) -> date | None:
    if value is None or value == "":
        return None
    if isinstance(value, date):
        return value
    try:
        return date.fromisoformat(str(value).strip()[:10])
    except ValueError:
        return None
