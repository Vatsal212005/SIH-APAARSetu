from __future__ import annotations
from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, Depends, HTTPException
from fastapi.encoders import jsonable_encoder
from pydantic import BaseModel
from sqlalchemy import desc, select
from sqlalchemy.orm import Session
from ..config import settings
from ..database import get_db
from ..models import (
    ConsentGrant,
    Credential,
    DemoSession,
    Enrolment,
    Finding,
    Institution,
    Role,
    Student,
    User,
)
from ..security import require_roles
from ..services.anomaly import run_isolation_forest, feature_rows
from ..services.common import audit
from ..services.credentials import (
    create_disclosure,
    issue_credential,
    verify_disclosure,
    verify_signature,
)
from ..services.imports import process_import
from ..services.seed import sid
from ..services.validation import capacity_snapshot, refresh_intake_finding

router = APIRouter(prefix="/demo", tags=["demo-center"])
SCENARIOS = [
    {
        "id": "intake-exceeded",
        "letter": "A",
        "title": "Approved Intake Exceeded",
        "summary": "Inspect the actual 135 regular admissions against 120 approved seats.",
    },
    {
        "id": "cross-institution",
        "letter": "B",
        "title": "Cross-Institution Duplicate",
        "summary": "Compare overlapping records and record a human review decision.",
    },
    {
        "id": "consent-verification",
        "letter": "C",
        "title": "Student-Controlled Verification",
        "summary": "Run synthetic student consent, signature verification and revocation.",
    },
    {
        "id": "bulk-validation",
        "letter": "D",
        "title": "Bulk Upload Validation",
        "summary": "Submit an actual mixed CSV through the transactional import service.",
    },
    {
        "id": "intelligent-anomaly",
        "letter": "E",
        "title": "Intelligent Enrolment Anomaly",
        "summary": "Fit Isolation Forest using actual institution feature aggregates.",
    },
]


def demo_guard():
    if not settings.demo_mode:
        raise HTTPException(404, "Demo Center disabled")


class Step(BaseModel):
    action: str = "run"
    token: str | None = None


@router.get("/scenarios")
def scenarios(
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(Role.aicte_admin, Role.system_admin)),
):
    demo_guard()
    rows = db.scalars(
        select(DemoSession)
        .where(DemoSession.user_id == user.id)
        .order_by(desc(DemoSession.created_at))
    ).all()
    return {
        "items": SCENARIOS,
        "sessions": [
            {
                "id": s.id,
                "scenario": s.scenario,
                "state": s.state,
                "created_at": s.created_at,
            }
            for s in rows
        ],
        "synthetic": True,
    }


@router.post("/scenarios/{scenario_id}/run")
def run_scenario(
    scenario_id: str,
    payload: Step = Step(),
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(Role.aicte_admin, Role.system_admin)),
):
    demo_guard()
    if scenario_id not in {s["id"] for s in SCENARIOS}:
        raise HTTPException(404, "Scenario not found")
    session = db.scalar(
        select(DemoSession).where(
            DemoSession.user_id == user.id, DemoSession.scenario == scenario_id
        )
    )
    if not session:
        session = DemoSession(user_id=user.id, scenario=scenario_id, state={})
        db.add(session)
        db.flush()
    result = dict(session.state)
    if scenario_id == "intake-exceeded":
        inst = sid("institution", "0")
        programme = sid("programme", "0:BTECH-CSE")
        finding = refresh_intake_finding(db, inst, programme, "2025-26")
        db.flush()
        records = db.scalars(
            select(Enrolment).where(
                Enrolment.institution_id == inst,
                Enrolment.programme_id == programme,
                Enrolment.academic_year == "2025-26",
            )
        ).all()
        result = {
            "scenario": scenario_id,
            "capacity": capacity_snapshot(db, inst, programme, "2025-26"),
            "record_count": len(records),
            "input_records": [
                {
                    "id": e.id,
                    "student_id": e.institution_student_id,
                    "status": e.status,
                    "seat_type": e.seat_type,
                }
                for e in records[:10]
            ],
            "finding_id": finding.id if finding else None,
            "review_state": finding.review_state if finding else None,
            "step": 2,
        }
        if payload.action == "review" and finding:
            finding.review_state = "request_clarification"
            finding.assigned_to = user.id
            finding.resolution = (
                "Synthetic institution must clarify the 15 excess regular admissions."
            )
            result["review_state"] = finding.review_state
            result["step"] = 3
    elif scenario_id == "cross-institution":
        student = db.get(Student, sid("student", "0"))
        records = db.scalars(
            select(Enrolment).where(
                Enrolment.student_id == student.id, Enrolment.academic_year == "2025-26"
            )
        ).all()
        finding = db.get(Finding, sid("finding", "cross-conflict"))
        result = {
            "scenario": scenario_id,
            "student": student.full_name,
            "apaar_masked": student.masked_apaar,
            "records": [
                {
                    "id": e.id,
                    "institution": db.get(Institution, e.institution_id).name,
                    "academic_year": e.academic_year,
                    "admission_date": e.admission_date.isoformat(),
                    "status": e.status,
                    "programme_id": e.programme_id,
                }
                for e in records
            ],
            "explanation": finding.explanation,
            "finding_id": finding.id,
            "review_state": finding.review_state,
            "step": 2,
        }
        if payload.action == "review":
            finding.review_state = "request_clarification"
            finding.resolution = "Check transfer documentation or permitted concurrent enrolment before classifying the overlap."
            finding.assigned_to = user.id
            result["review_state"] = finding.review_state
            result["step"] = 3
    elif scenario_id == "consent-verification":
        if payload.action in {"verify", "revoke"}:
            if not result.get("consent_id"):
                raise HTTPException(422, "Run consent scenario first")
            consent = db.get(ConsentGrant, result["consent_id"])
            if payload.action == "revoke":
                consent.revoked_at = datetime.now(timezone.utc)
                db.commit()
                result["step"] = 4
                result["consent_revoked"] = True
            if not payload.token:
                raise HTTPException(
                    422,
                    "Disclosure reference required; run scenario to create a fresh reference",
                )
            outcome = verify_disclosure(db, payload.token)
            result["verification"] = outcome
            result["step"] = 4 if payload.action == "revoke" else 3
        else:
            if result.get("consent_id"):
                old = db.get(ConsentGrant, result["consent_id"])
                if old:
                    old.revoked_at = datetime.now(timezone.utc)
            enrolment = db.get(Enrolment, sid("enrolment", "1"))
            credential = db.scalar(
                select(Credential).where(Credential.enrolment_id == enrolment.id)
            )
            if not credential:
                credential = issue_credential(db, enrolment)
            consent = ConsentGrant(
                student_id=enrolment.student_id,
                credential_id=credential.id,
                verifier_name="Scripted Synthetic Employer",
                purpose="Explicit synthetic demo student consent for SIH walkthrough",
                fields=["student_name", "programme", "academic_year"],
                expires_at=datetime.now(timezone.utc) + timedelta(hours=1),
            )
            db.add(consent)
            db.flush()
            raw = create_disclosure(db, consent)
            result = {
                "scenario": scenario_id,
                "credential_id": credential.id,
                "credential_code": credential.credential_code,
                "signature_valid": verify_signature(credential),
                "consent_id": consent.id,
                "fields": consent.fields,
                "consent_actor": "Scripted synthetic student in Demo Center; ordinary sharing remains student-only",
                "step": 2,
            }
            session.state = jsonable_encoder(result)
            db.commit()
            audit(
                db,
                "demo.consent.created",
                "demo_session",
                session.id,
                user,
                metadata={"consent_id": consent.id, "credential_id": credential.id},
            )
            db.commit()
            return {**result, "token": raw, "verification_path": f"/verify/{raw}"}
    elif scenario_id == "bulk-validation":
        if not result.get("batch_id"):
            suffix = int(session.id.replace("-", "")[:8], 16) % 100000000
            identifier = f"79{suffix:08d}01"
            csv = (
                "apaar_id,full_name,institution_student_id,admission_date\n"
                + f"{identifier},Synthetic Scenario Accepted,DEMO-{session.id[:8]},2025-08-01\n"
                + f"12345,Synthetic Invalid Format,ERR-{session.id[:8]},2025-08-01\n"
                + f"{identifier},Synthetic Duplicate,DUP-{session.id[:8]},2025-08-01\n"
                + ",Synthetic Missing Identifier,MISSING,2025-08-01\n"
            ).encode()
            result = process_import(
                db,
                csv,
                "demo-mixed.csv",
                sid("institution", "0"),
                sid("programme", "0:MBA"),
                "2025-26",
                user,
            )
            result = {
                "scenario": scenario_id,
                **result,
                "step": 3,
                "input_csv": csv.decode().replace(
                    identifier, "********" + identifier[-4:]
                ),
            }
    elif scenario_id == "intelligent-anomaly":
        result = {
            "scenario": scenario_id,
            **run_isolation_forest(db, "2025-26"),
            "feature_examples": feature_rows(db, "2025-26")[:4],
            "step": 2,
        }
        if payload.action == "review":
            finding = db.scalar(
                select(Finding)
                .where(Finding.source == "isolation_forest")
                .order_by(Finding.created_at)
            )
            if finding:
                finding.review_state = "mark_expected"
                finding.resolution = "Synthetic peer outlier reviewed; institutional clarification recorded."
                finding.assigned_to = user.id
                result["reviewed_finding"] = finding.id
                result["step"] = 3
    session.state = jsonable_encoder(result)
    audit(
        db,
        f"demo.scenario.{scenario_id}.{payload.action}",
        "demo_session",
        session.id,
        user,
        metadata={"scenario": scenario_id, "step": result.get("step")},
    )
    db.commit()
    return result
