"""Additive, scoped read models for the government-style workspace."""

from collections import Counter
from datetime import date, datetime, time, timezone
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import desc, func, or_, select
from sqlalchemy.orm import Session
from ..database import get_db
from ..models import (
    AcademicYear,
    ApprovedIntake,
    AuditEvent,
    CorrectionRequest,
    Credential,
    Enrolment,
    Finding,
    ImportBatch,
    Institution,
    Programme,
    RecordVersion,
    Role,
    Student,
    User,
    VerificationEvent,
)
from ..security import current_user, require_roles
from ..services.common import audit
from ..services.validation import capacity_snapshots
from .operations import _enrolment_view, _institution_scope

router = APIRouter(prefix="/workspace", tags=["workspace read models"])
staff = require_roles(
    Role.aicte_admin,
    Role.system_admin,
    Role.regional_officer,
    Role.auditor,
    Role.institution_admin,
    Role.institution_operator,
)


def scoped_institutions(db, user):
    return list(
        db.scalars(
            select(Institution)
            .where(*_institution_scope(user))
            .order_by(Institution.name)
        )
    )


def finding_for(db, user, finding_id):
    finding = db.get(Finding, finding_id)
    if not finding or finding.institution_id not in {
        i.id for i in scoped_institutions(db, user)
    }:
        raise HTTPException(404, "Finding not found in your authorized scope")
    return finding


def audit_view(db, event):
    actor = db.get(User, event.actor_user_id) if event.actor_user_id else None
    return {
        "id": event.id,
        "action": event.action,
        "entity_type": event.entity_type,
        "entity_id": event.entity_id,
        "metadata": event.metadata_json,
        "created_at": event.created_at,
        "actor": actor.name if actor else "System service",
        "role": actor.role if actor else "system",
        "outcome": "Recorded",
    }


@router.get("/overview")
def overview(
    academic_year: str | None = None,
    state: str | None = None,
    region: str | None = None,
    institution_type: str | None = None,
    programme_id: str | None = None,
    db: Session = Depends(get_db),
    user: User = Depends(staff),
):
    authorized = scoped_institutions(db, user)
    visible = [
        i
        for i in authorized
        if (not state or i.state == state)
        and (not region or i.region == region)
        and (not institution_type or i.institution_type == institution_type)
    ]
    ids = [i.id for i in visible]
    es = [Enrolment.institution_id.in_(ids)]
    fs = [Finding.institution_id.in_(ids)]
    if academic_year:
        es.append(Enrolment.academic_year == academic_year)
        fs.append(Finding.academic_year == academic_year)
    if programme_id:
        es.append(Enrolment.programme_id == programme_id)
        fs.append(Finding.programme_id == programme_id)
    records = list(db.scalars(select(Enrolment).where(*es)))
    findings = list(
        db.scalars(select(Finding).where(*fs).order_by(desc(Finding.updated_at)))
    )
    by_id = {i.id: i for i in visible}
    policies = select(ApprovedIntake).where(ApprovedIntake.institution_id.in_(ids))
    if academic_year:
        policies = policies.where(ApprovedIntake.academic_year == academic_year)
    if programme_id:
        policies = policies.where(ApprovedIntake.programme_id == programme_id)
    intake_rows = list(db.scalars(policies))
    snapshots = capacity_snapshots(db, intake_rows)
    programme_names = dict(
        db.execute(
            select(Programme.id, Programme.specialization).where(
                Programme.id.in_({i.programme_id for i in intake_rows})
            )
        ).all()
    )
    capacity = []
    for intake in intake_rows:
        snapshot = snapshots[intake.id]
        capacity.append(
            {
                "institution": by_id[intake.institution_id].name,
                "institution_id": intake.institution_id,
                "programme": programme_names[intake.programme_id],
                "academic_year": intake.academic_year,
                **snapshot,
            }
        )
    latest = (
        select(ImportBatch)
        .where(ImportBatch.institution_id.in_(ids))
        .order_by(desc(ImportBatch.created_at))
    )
    if academic_year:
        latest = latest.where(ImportBatch.academic_year == academic_year)
    if programme_id:
        latest = latest.where(ImportBatch.programme_id == programme_id)
    imports = list(db.scalars(latest.limit(5)))
    state_counts = Counter(by_id[e.institution_id].state for e in records)
    year_counts = Counter(e.academic_year for e in records)
    status_counts = Counter(e.status for e in records)
    student_ids = {e.student_id for e in records}
    provenance = Counter(
        db.scalars(
            select(Student.verification_status).where(Student.id.in_(student_ids))
        )
    )
    unresolved = [
        f
        for f in findings
        if f.review_state
        not in {"resolve", "resolved", "reject_finding", "mark_expected"}
    ]
    work_queue = [
        {
            "id": f.id,
            "institution": by_id[f.institution_id].name,
            "type": f.finding_type,
            "academic_year": f.academic_year,
            "severity": f.severity,
            "review_state": f.review_state,
            "assigned_to": db.get(User, f.assigned_to).name
            if f.assigned_to and db.get(User, f.assigned_to)
            else "Unassigned",
            "updated_at": f.updated_at,
            "title": f.title,
        }
        for f in findings
    ]
    programmes = list(
        db.scalars(
            select(Programme).where(
                Programme.institution_id.in_([i.id for i in authorized])
            )
        )
    )
    events = list(
        db.scalars(
            select(AuditEvent)
            .where(AuditEvent.institution_id.in_(ids))
            .order_by(desc(AuditEvent.created_at))
            .limit(5)
        )
    )
    return {
        "metrics": {
            "institutions": len(visible),
            "student_records": len(student_ids),
            "submitted_records": len(records),
            "pending_review": sum(e.status == "flagged" for e in records),
            "unresolved_findings": len(unresolved),
            "cross_conflicts": sum(
                f.finding_type == "cross_institution_conflict" for f in unresolved
            ),
            "regular_capacity": sum(c["regular_capacity"] for c in capacity),
            "regular_enrolment": sum(c["regular_enrolment"] for c in capacity),
            "regular_excess": sum(c["regular_excess"] for c in capacity),
            "open_corrections": db.scalar(
                select(func.count(CorrectionRequest.id)).where(
                    CorrectionRequest.enrolment_id.in_([e.id for e in records]),
                    CorrectionRequest.status == "open",
                )
            )
            or 0,
            "nri": sum(e.nri_category for e in records),
            "oci": sum(e.oci_status for e in records),
            "foreign_national": sum(e.foreign_national for e in records),
        },
        "institutions": [{"id": i.id, "name": i.name} for i in visible],
        "capacity": sorted(capacity, key=lambda c: c["regular_excess"], reverse=True),
        "state_distribution": [
            {"state": k, "count": v} for k, v in sorted(state_counts.items())
        ],
        "enrolment_trend": [
            {"year": k, "count": v} for k, v in sorted(year_counts.items())
        ],
        "status_distribution": [
            {"status": k, "count": v} for k, v in status_counts.items()
        ],
        "verification_distribution": [
            {"status": k, "count": v} for k, v in provenance.items()
        ],
        "work_queue": work_queue,
        "recent_activity": [audit_view(db, e) for e in events],
        "recent_submissions": [
            {
                "id": b.id,
                "filename": b.filename,
                "accepted": b.accepted_count,
                "rejected": b.rejected_count,
                "created_at": b.created_at,
            }
            for b in imports
        ],
        "options": {
            "states": sorted({i.state for i in authorized}),
            "regions": sorted({i.region for i in authorized}),
            "institution_types": sorted({i.institution_type for i in authorized}),
            "years": sorted(
                set(db.scalars(select(AcademicYear.name)))
                | set(db.scalars(select(ApprovedIntake.academic_year)))
            ),
            "programmes": [
                {
                    "id": p.id,
                    "name": p.specialization,
                    "institution": next(
                        i.name for i in authorized if i.id == p.institution_id
                    ),
                }
                for p in programmes
            ],
        },
        "generated_at": datetime.now(timezone.utc),
        "applied_filters": {
            "academic_year": academic_year,
            "state": state,
            "region": region,
            "institution_type": institution_type,
            "programme_id": programme_id,
        },
    }


@router.get("/institutions")
def registry(
    q: str = "",
    state: str = "",
    region: str = "",
    institution_type: str = "",
    approval_status: str = "",
    academic_year: str = "2025-26",
    page: int = Query(1, ge=1),
    db: Session = Depends(get_db),
    user: User = Depends(staff),
):
    rows = [
        i
        for i in scoped_institutions(db, user)
        if (not q or q.lower() in (i.name + " " + i.permanent_id).lower())
        and (not state or i.state == state)
        and (not region or i.region == region)
        and (not institution_type or i.institution_type == institution_type)
        and (not approval_status or i.approval_status == approval_status)
    ]
    items = []
    for i in rows[(page - 1) * 50 : page * 50]:
        enrolments = (
            db.scalar(
                select(func.count(Enrolment.id)).where(
                    Enrolment.institution_id == i.id,
                    Enrolment.academic_year == academic_year,
                )
            )
            or 0
        )
        findings = (
            db.scalar(
                select(func.count(Finding.id)).where(
                    Finding.institution_id == i.id,
                    Finding.academic_year == academic_year,
                    Finding.review_state.not_in(
                        ["resolve", "resolved", "mark_expected", "reject_finding"]
                    ),
                )
            )
            or 0
        )
        items.append(
            {
                "id": i.id,
                "permanent_id": i.permanent_id,
                "name": i.name,
                "institution_type": i.institution_type,
                "state": i.state,
                "region": i.region,
                "approval_status": i.approval_status,
                "enrolments": enrolments,
                "findings": findings,
            }
        )
    return {"items": items, "total": len(rows), "page": page}


def enrolment_scope(db, user):
    if user.role == "student":
        return [Enrolment.student_id == user.student_id]
    return [Enrolment.institution_id.in_([i.id for i in scoped_institutions(db, user)])]


@router.get("/students")
def student_register(
    q: str = "",
    academic_year: str = "",
    status: str = "",
    page: int = Query(1, ge=1),
    db: Session = Depends(get_db),
    user: User = Depends(staff),
):
    filters = enrolment_scope(db, user)
    if academic_year:
        filters.append(Enrolment.academic_year == academic_year)
    if status:
        filters.append(Enrolment.status == status)
    query = select(Student).where(
        Student.id.in_(select(Enrolment.student_id).where(*filters))
    )
    if q:
        query = query.where(Student.full_name.ilike(f"%{q}%"))
    total = db.scalar(select(func.count()).select_from(query.subquery())) or 0
    students = list(
        db.scalars(query.order_by(Student.full_name).offset((page - 1) * 50).limit(50))
    )
    items = []
    for s in students:
        e = db.scalar(
            select(Enrolment)
            .where(*filters, Enrolment.student_id == s.id)
            .order_by(desc(Enrolment.academic_year), desc(Enrolment.created_at))
        )
        record = _enrolment_view(db, e)
        corrections = (
            db.scalar(
                select(func.count(CorrectionRequest.id)).where(
                    CorrectionRequest.enrolment_id == e.id,
                    CorrectionRequest.status == "open",
                )
            )
            or 0
        )
        items.append(
            {
                **record,
                "id": s.id,
                "full_name": s.full_name,
                "verification_status": s.verification_status,
                "corrections": corrections,
            }
        )
    return {"items": items, "total": total, "page": page}


@router.get("/students/{student_id}")
def student_case(
    student_id: str, db: Session = Depends(get_db), user: User = Depends(current_user)
):
    if user.role == "verifier" or (
        user.role == "student" and user.student_id != student_id
    ):
        raise HTTPException(403, "Student record access denied")
    student = db.get(Student, student_id)
    records = list(
        db.scalars(
            select(Enrolment).where(
                *enrolment_scope(db, user), Enrolment.student_id == student_id
            )
        )
    )
    if not student or not records:
        raise HTTPException(404, "Student not found in your scope")
    ids = [e.id for e in records]
    versions = list(
        db.scalars(
            select(RecordVersion)
            .where(RecordVersion.enrolment_id.in_(ids))
            .order_by(desc(RecordVersion.created_at))
        )
    )
    corrections = list(
        db.scalars(
            select(CorrectionRequest).where(CorrectionRequest.enrolment_id.in_(ids))
        )
    )
    credentials = list(
        db.scalars(select(Credential).where(Credential.enrolment_id.in_(ids)))
    )
    return {
        "identity": {
            "id": student.id,
            "name": student.full_name,
            "masked_apaar": student.masked_apaar,
            "verification_status": student.verification_status,
            "synthetic": student.synthetic,
        },
        "enrolments": [_enrolment_view(db, e) for e in records],
        "credentials": [
            {
                "id": c.id,
                "code": c.credential_code,
                "expires_at": c.expires_at,
                "revoked": bool(c.revoked_at),
            }
            for c in credentials
        ],
        "corrections": [
            {"field": c.field_name, "status": c.status, "reason": c.reason}
            for c in corrections
        ],
        "history": [
            {
                "id": v.id,
                "reason": v.reason,
                "before": v.before,
                "after": v.after,
                "created_at": v.created_at,
            }
            for v in versions
        ],
    }


@router.get("/findings/{finding_id}")
def finding_case(
    finding_id: str,
    page: int = Query(1, ge=1),
    db: Session = Depends(get_db),
    user: User = Depends(staff),
):
    finding = finding_for(db, user, finding_id)
    sid = finding.evidence.get("student_id")
    records = (
        list(
            db.scalars(
                select(Enrolment).where(
                    *enrolment_scope(db, user), Enrolment.student_id == sid
                )
            )
        )
        if sid
        else []
    )
    cohort_total = 0
    if not sid and finding.programme_id:
        criteria = [
            *enrolment_scope(db, user),
            Enrolment.programme_id == finding.programme_id,
            Enrolment.academic_year == finding.academic_year,
        ]
        cohort_total = db.scalar(select(func.count(Enrolment.id)).where(*criteria)) or 0
        records = list(
            db.scalars(
                select(Enrolment)
                .where(*criteria)
                .order_by(Enrolment.institution_student_id)
                .offset((page - 1) * 50)
                .limit(50)
            )
        )
    history = list(
        db.scalars(
            select(AuditEvent)
            .where(AuditEvent.entity_id == finding_id)
            .order_by(desc(AuditEvent.created_at))
        )
    )
    return {
        "assigned_to": db.get(User, finding.assigned_to).name
        if finding.assigned_to and db.get(User, finding.assigned_to)
        else "Unassigned",
        "updated_at": finding.updated_at,
        "cohort_total": cohort_total,
        "page": page,
        "records": [
            {**_enrolment_view(db, e), "admission_date": e.admission_date}
            for e in records
        ],
        "history": [audit_view(db, e) for e in history],
    }


@router.post("/findings/{finding_id}/assign")
def assign_review(
    finding_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(
        require_roles(Role.aicte_admin, Role.system_admin, Role.regional_officer)
    ),
):
    finding = finding_for(db, user, finding_id)
    finding.assigned_to = user.id
    finding.updated_at = datetime.now(timezone.utc)
    audit(
        db,
        "finding.assigned",
        "anomaly_finding",
        finding.id,
        user,
        finding.institution_id,
        {"assigned_to": user.id},
    )
    db.commit()
    return {"id": finding.id, "assigned_to": user.name}


@router.get("/audit")
def audit_register(
    q: str = "",
    start: date | None = None,
    end: date | None = None,
    institution_id: str | None = None,
    page: int = Query(1, ge=1),
    db: Session = Depends(get_db),
    user: User = Depends(
        require_roles(
            Role.aicte_admin, Role.system_admin, Role.auditor, Role.institution_admin
        )
    ),
):
    filters = []
    if user.role == "institution_admin":
        filters.append(AuditEvent.institution_id == user.institution_id)
    if institution_id:
        filters.append(AuditEvent.institution_id == institution_id)
    if q:
        filters.append(
            or_(
                AuditEvent.action.ilike(f"%{q}%"),
                AuditEvent.entity_type.ilike(f"%{q}%"),
                AuditEvent.entity_id.ilike(f"%{q}%"),
            )
        )
    if start:
        filters.append(AuditEvent.created_at >= datetime.combine(start, time.min))
    if end:
        filters.append(AuditEvent.created_at <= datetime.combine(end, time.max))
    total = db.scalar(select(func.count(AuditEvent.id)).where(*filters)) or 0
    rows = list(
        db.scalars(
            select(AuditEvent)
            .where(*filters)
            .order_by(desc(AuditEvent.created_at))
            .offset((page - 1) * 50)
            .limit(50)
        )
    )
    return {"items": [audit_view(db, e) for e in rows], "total": total, "page": page}


@router.get("/enrolments")
def enrolment_register(
    q: str = "",
    academic_year: str = "",
    status: str = "",
    student_id: str = "",
    page: int = Query(1, ge=1),
    db: Session = Depends(get_db),
    user: User = Depends(staff),
):
    filters = enrolment_scope(db, user)
    if academic_year:
        filters.append(Enrolment.academic_year == academic_year)
    if status:
        filters.append(Enrolment.status == status)
    if student_id:
        filters.append(Enrolment.student_id == student_id)
    if q:
        filters.append(
            or_(
                Enrolment.institution_student_id.ilike(f"%{q}%"),
                Enrolment.student_id.in_(
                    select(Student.id).where(Student.full_name.ilike(f"%{q}%"))
                ),
            )
        )
    total = db.scalar(select(func.count(Enrolment.id)).where(*filters)) or 0
    records = list(
        db.scalars(
            select(Enrolment)
            .where(*filters)
            .order_by(desc(Enrolment.created_at))
            .offset((page - 1) * 50)
            .limit(50)
        )
    )
    return {
        "items": [_enrolment_view(db, e) for e in records],
        "total": total,
        "page": page,
    }


@router.get("/institutions/{institution_id}/activity")
def institution_activity(
    institution_id: str,
    kind: str = "enrolments",
    page: int = Query(1, ge=1),
    db: Session = Depends(get_db),
    user: User = Depends(staff),
):
    if institution_id not in {i.id for i in scoped_institutions(db, user)}:
        raise HTTPException(404, "Institution not found in your authorized scope")
    if kind == "enrolments":
        query = (
            select(Enrolment)
            .where(Enrolment.institution_id == institution_id)
            .order_by(desc(Enrolment.created_at))
        )

        def render(e):
            return _enrolment_view(db, e)
    elif kind == "submissions":
        query = (
            select(ImportBatch)
            .where(ImportBatch.institution_id == institution_id)
            .order_by(desc(ImportBatch.created_at))
        )

        def render(b):
            return {
                "reference": b.id,
                "filename": b.filename,
                "academic_year": b.academic_year,
                "accepted": b.accepted_count,
                "rejected": b.rejected_count,
                "status": b.status,
                "created_at": b.created_at,
            }
    elif kind == "compliance":
        query = (
            select(Finding)
            .where(Finding.institution_id == institution_id)
            .order_by(desc(Finding.updated_at))
        )

        def render(f):
            return {
                "reference": f.id,
                "title": f.title,
                "type": f.finding_type,
                "severity": f.severity,
                "status": f.review_state,
                "academic_year": f.academic_year,
            }
    elif kind == "verification":
        query = (
            select(VerificationEvent)
            .join(Credential, Credential.id == VerificationEvent.credential_id)
            .where(
                Credential.enrolment_id.in_(
                    select(Enrolment.id).where(
                        Enrolment.institution_id == institution_id
                    )
                )
            )
            .order_by(desc(VerificationEvent.created_at))
        )

        def render(e):
            return {
                "reference": e.id,
                "recipient": e.verifier_name,
                "outcome": e.outcome,
                "created_at": e.created_at,
            }
    elif kind == "audit":
        if user.role not in {
            "aicte_admin",
            "system_admin",
            "auditor",
            "institution_admin",
        }:
            raise HTTPException(
                403, "Audit access requires an authorized administrative role"
            )
        query = (
            select(AuditEvent)
            .where(AuditEvent.institution_id == institution_id)
            .order_by(desc(AuditEvent.created_at))
        )

        def render(e):
            return audit_view(db, e)
    else:
        raise HTTPException(422, "Unknown case-file section")
    total = db.scalar(select(func.count()).select_from(query.subquery())) or 0
    rows = list(db.scalars(query.offset((page - 1) * 50).limit(50)))
    return {"items": [render(e) for e in rows], "total": total, "page": page}
