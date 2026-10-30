from __future__ import annotations

import csv
import io
import json
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile
from fastapi.responses import StreamingResponse
from sqlalchemy import desc, func, or_, select
from sqlalchemy.orm import Session

from ..config import settings
from ..database import get_db
from ..models import (
    ApprovedIntake,
    AuditEvent,
    CorrectionRequest,
    ConsentGrant,
    Enrolment,
    Finding,
    ImportBatch,
    ImportRow,
    Institution,
    Notification,
    Programme,
    Role,
    Student,
    User,
)
from ..schemas import CorrectionCreate, FindingReview, InstitutionCreate, StudentCreate
from ..security import (
    current_user,
    encrypt_identifier,
    enforce_institution_scope,
    opaque_hash,
    require_roles,
)
from ..services.anomaly import run_isolation_forest
from ..services.common import audit, notify
from ..services.imports import process_import
from ..services.validation import (
    capacity_snapshots,
    refresh_intake_finding,
    validate_student_row,
)


router = APIRouter(tags=["operations"])
CENTRAL = {Role.system_admin.value, Role.aicte_admin.value, Role.auditor.value}


def _institution_scope(user: User) -> list:
    filters = []
    if user.role in {Role.institution_admin.value, Role.institution_operator.value}:
        filters.append(Institution.id == user.institution_id)
    elif user.role == Role.regional_officer.value:
        filters.append(Institution.region == user.region)
    return filters


@router.get("/dashboard")
def dashboard(
    db: Session = Depends(get_db), user: User = Depends(current_user)
) -> dict:
    if user.role == "verifier":
        return {
            "portal": "verifier",
            "metrics": {},
            "official_verification_notice": "Official APAAR verification unavailable — demonstration mode.",
        }
    if user.role == Role.student.value:
        enrolments = db.scalars(
            select(Enrolment).where(Enrolment.student_id == user.student_id)
        ).all()
        credentials_count = (
            db.scalar(
                select(func.count())
                .select_from(
                    __import__("app.models", fromlist=["Credential"]).Credential
                )
                .where(
                    __import__(
                        "app.models", fromlist=["Credential"]
                    ).Credential.student_id
                    == user.student_id
                )
            )
            or 0
        )
        return {
            "portal": "student",
            "metrics": {
                "enrolments": len(enrolments),
                "credentials": credentials_count,
                "active_consents": db.scalar(
                    select(func.count(ConsentGrant.id)).where(
                        ConsentGrant.student_id == user.student_id,
                        ConsentGrant.revoked_at.is_(None),
                        ConsentGrant.expires_at > datetime.now(timezone.utc),
                    )
                )
                or 0,
                "open_corrections": db.scalar(
                    select(func.count(CorrectionRequest.id)).where(
                        CorrectionRequest.student_id == user.student_id,
                        CorrectionRequest.status == "open",
                    )
                )
                or 0,
            },
            "enrolments": [_enrolment_view(db, item) for item in enrolments],
            "official_verification_notice": "Official APAAR verification unavailable — demonstration mode.",
        }
    institution_filter = []
    if user.role in {Role.institution_admin.value, Role.institution_operator.value}:
        institution_filter = [Enrolment.institution_id == user.institution_id]
    elif user.role == Role.regional_officer.value:
        allowed_ids = select(Institution.id).where(Institution.region == user.region)
        institution_filter = [Enrolment.institution_id.in_(allowed_ids)]
    inst_filters = _institution_scope(user)
    institutions = (
        db.scalar(select(func.count(Institution.id)).where(*inst_filters)) or 0
    )
    students = (
        db.scalar(
            select(func.count(func.distinct(Enrolment.student_id))).where(
                *institution_filter
            )
        )
        or 0
    )
    submitted = (
        db.scalar(select(func.count(Enrolment.id)).where(*institution_filter)) or 0
    )
    flagged = (
        db.scalar(
            select(func.count(Enrolment.id)).where(
                *institution_filter, Enrolment.status == "flagged"
            )
        )
        or 0
    )
    finding_filter = []
    if user.role in {Role.institution_admin.value, Role.institution_operator.value}:
        finding_filter = [Finding.institution_id == user.institution_id]
    elif user.role == Role.regional_officer.value:
        finding_filter = [
            Finding.institution_id.in_(
                select(Institution.id).where(Institution.region == user.region)
            )
        ]
    unresolved = (
        db.scalar(
            select(func.count(Finding.id)).where(
                *finding_filter,
                Finding.review_state.in_(["open", "request_clarification"]),
            )
        )
        or 0
    )
    invalid = (
        db.scalar(
            select(func.count(Student.id)).where(
                Student.verification_status == "rejected_or_correction_required"
            )
        )
        or 0
    )
    categories = db.execute(
        select(
            func.sum(
                func.cast(Enrolment.nri_category, __import__("sqlalchemy").Integer)
            ),
            func.sum(func.cast(Enrolment.oci_status, __import__("sqlalchemy").Integer)),
            func.sum(
                func.cast(Enrolment.foreign_national, __import__("sqlalchemy").Integer)
            ),
        ).where(*institution_filter)
    ).one()
    trends = db.execute(
        select(Enrolment.academic_year, func.count(Enrolment.id))
        .where(*institution_filter)
        .group_by(Enrolment.academic_year)
        .order_by(Enrolment.academic_year)
    ).all()
    region_rows = db.execute(
        select(Institution.region, func.count(Enrolment.id))
        .join(Enrolment, Enrolment.institution_id == Institution.id)
        .where(*institution_filter)
        .group_by(Institution.region)
        .order_by(desc(func.count(Enrolment.id)))
    ).all()
    recent_query = select(ImportBatch).order_by(desc(ImportBatch.created_at))
    if user.role.startswith("institution_"):
        recent_query = recent_query.where(
            ImportBatch.institution_id == user.institution_id
        )
    elif user.role == "regional_officer":
        recent_query = recent_query.where(
            ImportBatch.institution_id.in_(
                select(Institution.id).where(Institution.region == user.region)
            )
        )
    recent = db.scalars(recent_query.limit(6)).all()
    return {
        "portal": "institution" if user.role.startswith("institution_") else "aicte",
        "metrics": {
            "institutions": institutions,
            "student_records": students,
            "submitted_records": submitted,
            "pending_review": flagged,
            "invalid_apaar": invalid,
            "unresolved_findings": unresolved,
            "nri_admissions": categories[0] or 0,
            "oci_students": categories[1] or 0,
            "foreign_national_students": categories[2] or 0,
        },
        "enrolment_trend": [{"year": year, "count": count} for year, count in trends],
        "region_distribution": [
            {"region": region, "count": count} for region, count in region_rows
        ],
        "recent_submissions": [
            {
                "id": item.id,
                "filename": item.filename,
                "accepted": item.accepted_count,
                "rejected": item.rejected_count,
                "created_at": item.created_at,
            }
            for item in recent
        ],
        "official_verification_notice": "Official APAAR verification unavailable — demonstration mode.",
    }


@router.get("/institutions")
def institutions(
    q: str = "",
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=100),
    state: str | None = None,
    db: Session = Depends(get_db),
    user: User = Depends(current_user),
) -> dict:
    filters = _institution_scope(user)
    if q:
        filters.append(
            or_(
                Institution.name.ilike(f"%{q}%"),
                Institution.permanent_id.ilike(f"%{q}%"),
            )
        )
    if state:
        filters.append(Institution.state == state)
    total = db.scalar(select(func.count(Institution.id)).where(*filters)) or 0
    rows = db.scalars(
        select(Institution)
        .where(*filters)
        .order_by(Institution.name)
        .offset((page - 1) * page_size)
        .limit(page_size)
    ).all()
    return {
        "items": [
            {
                "id": item.id,
                "permanent_id": item.permanent_id,
                "name": item.name,
                "institution_type": item.institution_type,
                "city": item.city,
                "state": item.state,
                "region": item.region,
                "approval_status": item.approval_status,
                "synthetic": item.synthetic,
            }
            for item in rows
        ],
        "page": page,
        "page_size": page_size,
        "total": total,
    }


@router.post("/institutions")
def create_institution(
    payload: InstitutionCreate,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(Role.system_admin, Role.aicte_admin)),
) -> dict:
    if db.scalar(
        select(Institution).where(Institution.permanent_id == payload.permanent_id)
    ):
        raise HTTPException(
            status_code=409, detail="Institution permanent ID already exists"
        )
    item = Institution(**payload.model_dump(), synthetic=True)
    db.add(item)
    db.flush()
    audit(db, "institution.created", "institution", item.id, user, item.id)
    db.commit()
    return {"id": item.id, "name": item.name}


@router.get("/institutions/{institution_id}")
def institution_detail(
    institution_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(current_user),
) -> dict:
    enforce_institution_scope(user, institution_id, db)
    item = db.get(Institution, institution_id)
    if not item:
        raise HTTPException(status_code=404, detail="Institution not found")
    programmes = db.scalars(
        select(Programme).where(Programme.institution_id == item.id)
    ).all()
    intakes = db.scalars(
        select(ApprovedIntake).where(ApprovedIntake.institution_id == item.id)
    ).all()
    return {
        "institution": {
            key: getattr(item, key)
            for key in (
                "id",
                "permanent_id",
                "name",
                "institution_type",
                "address",
                "city",
                "state",
                "region",
                "approval_status",
                "contact_email",
            )
        },
        "programmes": [
            {
                "id": p.id,
                "code": p.code,
                "name": p.name,
                "specialization": p.specialization,
            }
            for p in programmes
        ],
        "intakes": [
            {
                "id": i.id,
                "programme_id": i.programme_id,
                "academic_year": i.academic_year,
                "regular_capacity": i.regular_capacity,
                "supernumerary_capacity": i.supernumerary_capacity,
                "approval_status": i.approval_status,
            }
            for i in intakes
        ],
        "findings": db.scalar(
            select(func.count(Finding.id)).where(
                Finding.institution_id == item.id, Finding.review_state != "resolved"
            )
        )
        or 0,
        "enrolments": db.scalar(
            select(func.count(Enrolment.id)).where(Enrolment.institution_id == item.id)
        )
        or 0,
    }


@router.get("/programmes")
def programmes(
    institution_id: str | None = None,
    db: Session = Depends(get_db),
    user: User = Depends(current_user),
) -> dict:
    if institution_id:
        enforce_institution_scope(user, institution_id)
    elif user.role.startswith("institution_"):
        institution_id = user.institution_id
    query = select(Programme, Institution.name).join(
        Institution, Programme.institution_id == Institution.id
    )
    if institution_id:
        query = query.where(Programme.institution_id == institution_id)
    elif user.role == Role.regional_officer.value:
        query = query.where(Institution.region == user.region)
    rows = db.execute(query.order_by(Institution.name, Programme.code).limit(500)).all()
    return {
        "items": [
            {
                "id": p.id,
                "institution_id": p.institution_id,
                "institution": name,
                "code": p.code,
                "name": p.name,
                "specialization": p.specialization,
            }
            for p, name in rows
        ]
    }


@router.get("/intakes")
def intakes(
    institution_id: str | None = None,
    academic_year: str = "2025-26",
    db: Session = Depends(get_db),
    user: User = Depends(current_user),
) -> dict:
    if user.role.startswith("institution_"):
        institution_id = user.institution_id
    if institution_id:
        enforce_institution_scope(user, institution_id)
    query = (
        select(ApprovedIntake, Programme, Institution)
        .join(Programme, ApprovedIntake.programme_id == Programme.id)
        .join(Institution, ApprovedIntake.institution_id == Institution.id)
        .where(ApprovedIntake.academic_year == academic_year)
    )
    if institution_id:
        query = query.where(ApprovedIntake.institution_id == institution_id)
    elif user.role == Role.regional_officer.value:
        query = query.where(Institution.region == user.region)
    rows = db.execute(query.limit(500)).all()
    snapshots = capacity_snapshots(db, [intake for intake, _, _ in rows])
    return {
        "items": [
            {
                "id": intake.id,
                "institution_id": intake.institution_id,
                "institution": institution.name,
                "programme_id": programme.id,
                "programme": f"{programme.name} — {programme.specialization}",
                "academic_year": intake.academic_year,
                **snapshots[intake.id],
                "approval_status": intake.approval_status,
            }
            for intake, programme, institution in rows
        ]
    }


@router.get("/students")
def students(
    q: str = "",
    page: int = 1,
    page_size: int = Query(25, le=100),
    db: Session = Depends(get_db),
    user: User = Depends(current_user),
) -> dict:
    if user.role == Role.student.value:
        student_filters = [Student.id == user.student_id]
    elif user.role.startswith("institution_"):
        student_filters = [
            Student.id.in_(
                select(Enrolment.student_id).where(
                    Enrolment.institution_id == user.institution_id
                )
            )
        ]
    elif user.role == Role.regional_officer.value:
        student_filters = [
            Student.id.in_(
                select(Enrolment.student_id)
                .join(Institution, Enrolment.institution_id == Institution.id)
                .where(Institution.region == user.region)
            )
        ]
    else:
        student_filters = []
    if q:
        student_filters.append(Student.full_name.ilike(f"%{q}%"))
    total = db.scalar(select(func.count(Student.id)).where(*student_filters)) or 0
    rows = db.scalars(
        select(Student)
        .where(*student_filters)
        .order_by(Student.full_name)
        .offset((page - 1) * page_size)
        .limit(page_size)
    ).all()
    return {
        "items": [
            {
                "id": s.id,
                "full_name": s.full_name,
                "masked_apaar": s.masked_apaar,
                "verification_status": s.verification_status,
                "synthetic": s.synthetic,
            }
            for s in rows
        ],
        "total": total,
        "page": page,
    }


@router.post("/students")
def create_student(
    payload: StudentCreate,
    db: Session = Depends(get_db),
    user: User = Depends(
        require_roles(
            Role.institution_admin, Role.institution_operator, Role.aicte_admin
        )
    ),
):
    enforce_institution_scope(user, payload.institution_id)
    result = validate_student_row(
        db,
        payload.model_dump(mode="json"),
        payload.institution_id,
        payload.academic_year,
    )
    if not db.scalar(
        select(ApprovedIntake).where(
            ApprovedIntake.programme_id == payload.programme_id,
            ApprovedIntake.academic_year == payload.academic_year,
        )
    ):
        raise HTTPException(422, "No approved intake for programme/year")
    if db.scalar(
        select(Enrolment).where(
            Enrolment.institution_id == payload.institution_id,
            Enrolment.academic_year == payload.academic_year,
            Enrolment.institution_student_id == payload.institution_student_id,
        )
    ):
        raise HTTPException(409, "Institution student ID already exists for this year")
    if result.errors:
        raise HTTPException(
            status_code=422, detail={"errors": result.errors, "flags": result.flags}
        )
    student = (
        db.scalar(
            select(Student).where(Student.apaar_lookup == opaque_hash(payload.apaar_id))
        )
        if payload.apaar_id
        else None
    )
    if not student:
        student = Student(
            apaar_encrypted=encrypt_identifier(payload.apaar_id)
            if payload.apaar_id
            else None,
            apaar_lookup=opaque_hash(payload.apaar_id) if payload.apaar_id else None,
            apaar_last4=payload.apaar_id[-4:] if payload.apaar_id else None,
            full_name=payload.full_name,
            date_of_birth=payload.date_of_birth,
            verification_status="discrepancy_flagged"
            if result.flags
            else "format_validated",
            provenance={
                "format_validation": "passed",
                "institution_attestation": "attested",
                "external_verification": "unavailable_demo_mode",
            },
        )
        db.add(student)
        db.flush()
    enrolment = Enrolment(
        student_id=student.id,
        institution_id=payload.institution_id,
        programme_id=payload.programme_id,
        academic_year=payload.academic_year,
        institution_student_id=payload.institution_student_id,
        admission_date=payload.admission_date,
        status="flagged" if result.flags else "accepted",
        seat_type=payload.seat_type,
        nri_category=payload.nri_category,
        oci_status=payload.oci_status,
        foreign_national=payload.foreign_national,
        attested=True,
    )
    db.add(enrolment)
    db.flush()
    if result.flags:
        db.add(
            Finding(
                institution_id=payload.institution_id,
                programme_id=payload.programme_id,
                academic_year=payload.academic_year,
                finding_type="cross_institution_conflict",
                source="deterministic",
                severity="high",
                title="Potential concurrent cross-institution enrolment",
                explanation="; ".join(result.flags),
                evidence={
                    "student_id": student.id,
                    "enrolment_id": enrolment.id,
                    "submitted_name": payload.full_name,
                    "existing_name": student.full_name,
                    "rules": result.flags,
                },
            )
        )
    refresh_intake_finding(
        db, payload.institution_id, payload.programme_id, payload.academic_year
    )
    audit(
        db,
        "enrolment.created",
        "enrolment",
        enrolment.id,
        user,
        payload.institution_id,
        {"flags": result.flags},
    )
    db.commit()
    return {
        "student_id": student.id,
        "enrolment_id": enrolment.id,
        "status": enrolment.status,
        "flags": result.flags,
    }


@router.get("/enrolments")
def enrolments(
    student_id: str | None = None,
    institution_id: str | None = None,
    db: Session = Depends(get_db),
    user: User = Depends(current_user),
) -> dict:
    filters = []
    if user.role == Role.student.value:
        filters.append(Enrolment.student_id == user.student_id)
    elif user.role.startswith("institution_"):
        filters.append(Enrolment.institution_id == user.institution_id)
    elif institution_id:
        enforce_institution_scope(user, institution_id)
        filters.append(Enrolment.institution_id == institution_id)
    if user.role == "regional_officer":
        filters.append(
            Enrolment.institution_id.in_(
                select(Institution.id).where(Institution.region == user.region)
            )
        )
    if student_id:
        filters.append(Enrolment.student_id == student_id)
    rows = db.scalars(
        select(Enrolment)
        .where(*filters)
        .order_by(desc(Enrolment.created_at))
        .limit(500)
    ).all()
    return {"items": [_enrolment_view(db, item) for item in rows]}


@router.post("/corrections")
def correction(
    payload: CorrectionCreate,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(Role.student)),
):
    enrolment = db.get(Enrolment, payload.enrolment_id)
    if not enrolment or enrolment.student_id != user.student_id:
        raise HTTPException(status_code=404, detail="Enrolment not found")
    item = CorrectionRequest(student_id=user.student_id, **payload.model_dump())
    db.add(item)
    db.flush()
    notify(
        db,
        "Student correction request",
        f"A correction was requested for {payload.field_name}.",
        "warning",
        institution_id=enrolment.institution_id,
        deep_link="/students",
    )
    audit(
        db,
        "correction.requested",
        "correction_request",
        item.id,
        user,
        enrolment.institution_id,
    )
    db.commit()
    return {"id": item.id, "status": item.status}


@router.post("/imports")
async def import_students(
    file: UploadFile = File(...),
    institution_id: str = Form(...),
    programme_id: str = Form(...),
    academic_year: str = Form(...),
    mapping: str = Form("{}"),
    preview: bool = Form(False),
    db: Session = Depends(get_db),
    user: User = Depends(
        require_roles(
            Role.institution_admin, Role.institution_operator, Role.aicte_admin
        )
    ),
) -> dict:
    enforce_institution_scope(user, institution_id)
    content = await file.read()
    if len(content) > settings.max_upload_bytes:
        raise HTTPException(
            status_code=413,
            detail=f"Upload exceeds the {settings.max_upload_bytes // (1024 * 1024)} MB demonstration limit",
        )
    try:
        column_mapping = json.loads(mapping)
    except ValueError:
        raise HTTPException(422, "Invalid column mapping JSON")
    if not isinstance(column_mapping, dict):
        raise HTTPException(422, "Column mapping must be an object")
    return process_import(
        db,
        content,
        file.filename or "upload.csv",
        institution_id,
        programme_id,
        academic_year,
        user,
        column_mapping,
        preview,
    )


@router.get("/imports")
def import_history(
    db: Session = Depends(get_db), user: User = Depends(current_user)
) -> dict:
    query = select(ImportBatch).order_by(desc(ImportBatch.created_at))
    if user.role.startswith("institution_"):
        query = query.where(ImportBatch.institution_id == user.institution_id)
    elif user.role == "regional_officer":
        query = query.where(
            ImportBatch.institution_id.in_(
                select(Institution.id).where(Institution.region == user.region)
            )
        )
    rows = db.scalars(query.limit(100)).all()
    return {
        "items": [
            {
                "id": item.id,
                "filename": item.filename,
                "academic_year": item.academic_year,
                "status": item.status,
                "accepted": item.accepted_count,
                "rejected": item.rejected_count,
                "flagged": item.flagged_count,
                "created_at": item.created_at,
            }
            for item in rows
        ]
    }


@router.get("/imports/{batch_id}/errors.csv")
def import_errors(
    batch_id: str, db: Session = Depends(get_db), user: User = Depends(current_user)
):
    batch = db.get(ImportBatch, batch_id)
    if not batch:
        raise HTTPException(status_code=404, detail="Import not found")
    enforce_institution_scope(user, batch.institution_id)
    rows = db.scalars(
        select(ImportRow).where(
            ImportRow.batch_id == batch_id, ImportRow.result == "rejected"
        )
    ).all()
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["row_number", "result", "errors"])
    for row in rows:
        writer.writerow([row.row_number, row.result, "; ".join(row.errors)])
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={
            "Content-Disposition": f"attachment; filename=import-{batch_id}-errors.csv"
        },
    )


@router.get("/findings")
def findings(
    review_state: str | None = None,
    db: Session = Depends(get_db),
    user: User = Depends(current_user),
) -> dict:
    filters = []
    if user.role.startswith("institution_"):
        filters.append(Finding.institution_id == user.institution_id)
    elif user.role == Role.regional_officer.value:
        filters.append(
            Finding.institution_id.in_(
                select(Institution.id).where(Institution.region == user.region)
            )
        )
    if review_state:
        filters.append(Finding.review_state == review_state)
    rows = db.execute(
        select(Finding, Institution.name)
        .join(Institution, Finding.institution_id == Institution.id)
        .where(*filters)
        .order_by(desc(Finding.created_at))
        .limit(500)
    ).all()
    return {
        "items": [
            {
                "id": f.id,
                "institution_id": f.institution_id,
                "institution": name,
                "academic_year": f.academic_year,
                "type": f.finding_type,
                "source": f.source,
                "severity": f.severity,
                "title": f.title,
                "explanation": f.explanation,
                "evidence": f.evidence,
                "model_score": f.model_score,
                "review_state": f.review_state,
                "resolution": f.resolution,
                "created_at": f.created_at,
            }
            for f, name in rows
        ]
    }


@router.post("/findings/{finding_id}/review")
def review_finding(
    finding_id: str,
    payload: FindingReview,
    db: Session = Depends(get_db),
    user: User = Depends(
        require_roles(Role.aicte_admin, Role.regional_officer, Role.system_admin)
    ),
):
    finding = db.get(Finding, finding_id)
    if not finding:
        raise HTTPException(status_code=404, detail="Finding not found")
    if user.role == Role.regional_officer.value:
        institution = db.get(Institution, finding.institution_id)
        if not institution or institution.region != user.region:
            raise HTTPException(status_code=403, detail="Regional scope violation")
    finding.review_state = payload.action
    finding.resolution = payload.justification
    finding.assigned_to = user.id
    finding.updated_at = datetime.now(timezone.utc)
    audit(
        db,
        "finding.reviewed",
        "anomaly_finding",
        finding.id,
        user,
        finding.institution_id,
        payload.model_dump(),
    )
    notify(
        db,
        "Compliance finding reviewed",
        f"Decision: {payload.action.replace('_', ' ')}",
        "info",
        institution_id=finding.institution_id,
        deep_link="/anomalies",
    )
    db.commit()
    return {
        "id": finding.id,
        "review_state": finding.review_state,
        "resolution": finding.resolution,
    }


@router.post("/anomaly/run")
def run_anomaly(
    academic_year: str = "2025-26",
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(Role.aicte_admin, Role.system_admin)),
):
    result = run_isolation_forest(db, academic_year)
    audit(
        db, "anomaly.model_run", "anomaly_model", academic_year, user, metadata=result
    )
    db.commit()
    return result


@router.get("/notifications")
def notifications(
    db: Session = Depends(get_db), user: User = Depends(current_user)
) -> dict:
    filters = [or_(Notification.user_id == user.id, Notification.user_id.is_(None))]
    if user.institution_id:
        filters.append(
            or_(
                Notification.institution_id == user.institution_id,
                Notification.institution_id.is_(None),
            )
        )
    elif user.role in {"student", "verifier"}:
        filters.append(Notification.institution_id.is_(None))
    elif user.role == "regional_officer":
        filters.append(
            or_(
                Notification.institution_id.is_(None),
                Notification.institution_id.in_(
                    select(Institution.id).where(Institution.region == user.region)
                ),
            )
        )
    rows = db.scalars(
        select(Notification)
        .where(*filters)
        .order_by(desc(Notification.created_at))
        .limit(100)
    ).all()
    return {
        "items": [
            {
                "id": n.id,
                "severity": n.severity,
                "title": n.title,
                "body": n.body,
                "deep_link": n.deep_link,
                "read": n.read_at is not None,
                "created_at": n.created_at,
            }
            for n in rows
        ]
    }


@router.get("/audit")
def audit_log(
    db: Session = Depends(get_db),
    user: User = Depends(
        require_roles(
            Role.aicte_admin, Role.auditor, Role.system_admin, Role.institution_admin
        )
    ),
) -> dict:
    query = select(AuditEvent).order_by(desc(AuditEvent.created_at))
    if user.role == Role.institution_admin.value:
        query = query.where(AuditEvent.institution_id == user.institution_id)
    rows = db.scalars(query.limit(250)).all()
    return {
        "items": [
            {
                "id": item.id,
                "action": item.action,
                "entity_type": item.entity_type,
                "entity_id": item.entity_id,
                "metadata": item.metadata_json,
                "created_at": item.created_at,
            }
            for item in rows
        ]
    }


def _enrolment_view(db: Session, item: Enrolment) -> dict:
    student = db.get(Student, item.student_id)
    institution = db.get(Institution, item.institution_id)
    programme = db.get(Programme, item.programme_id)
    return {
        "id": item.id,
        "student_id": item.student_id,
        "student": student.full_name if student else "Unknown",
        "masked_apaar": student.masked_apaar if student else "Unavailable",
        "institution_id": item.institution_id,
        "institution": institution.name if institution else "Unknown",
        "programme": f"{programme.name} — {programme.specialization}"
        if programme
        else "Unknown",
        "academic_year": item.academic_year,
        "institution_student_id": item.institution_student_id,
        "status": item.status,
        "seat_type": item.seat_type,
        "nri_category": item.nri_category,
        "oci_status": item.oci_status,
        "foreign_national": item.foreign_national,
        "attested": item.attested,
    }
