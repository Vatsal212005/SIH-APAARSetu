from __future__ import annotations

from datetime import date, datetime, timezone
from typing import Literal
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from pydantic import BaseModel, Field
from sqlalchemy import desc, select
from sqlalchemy.orm import Session
from ..database import get_db
from ..models import (
    AcademicYear,
    ApprovedIntake,
    CapacityPolicy,
    CorrectionRequest,
    Enrolment,
    Institution,
    Notification,
    Programme,
    RecordVersion,
    Role,
    Student,
    User,
)
from ..schemas import InstitutionCreate, IntakeCreate
from ..security import (
    current_user,
    enforce_institution_scope,
    hash_password,
    require_roles,
)
from ..services.common import audit
from ..services.validation import refresh_intake_finding

router = APIRouter(tags=["management"])
EDIT = (Role.aicte_admin, Role.system_admin, Role.institution_admin)
CENTRAL = (Role.aicte_admin, Role.system_admin)


@router.post("/institutions/import")
async def institution_csv(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(*CENTRAL)),
):
    import csv
    import io

    content = await file.read()
    if not file.filename or not file.filename.lower().endswith(".csv"):
        raise HTTPException(415, "Institution registry accepts CSV files")
    if len(content) > 2 * 1024 * 1024:
        raise HTTPException(413, "Institution CSV exceeds 2 MB")
    try:
        records = list(csv.DictReader(io.StringIO(content.decode("utf-8-sig"))))
    except (UnicodeDecodeError, csv.Error):
        raise HTTPException(422, "Malformed UTF-8 CSV")
    if len(records) > 1000:
        raise HTTPException(413, "Maximum 1000 institutions per import")
    result = []
    for index, row in enumerate(records, 2):
        try:
            payload = InstitutionCreate.model_validate(row)
            if db.scalar(
                select(Institution).where(
                    Institution.permanent_id == payload.permanent_id
                )
            ):
                result.append(
                    {
                        "row": index,
                        "status": "duplicate",
                        "message": "Permanent ID already registered",
                    }
                )
                continue
            item = Institution(**payload.model_dump(), synthetic=True)
            db.add(item)
            db.flush()
            audit(db, "institution.created", "institution", item.id, user, item.id)
            result.append({"row": index, "status": "accepted", "id": item.id})
        except ValueError:
            result.append(
                {
                    "row": index,
                    "status": "rejected",
                    "message": "Required institution fields or contact email are invalid",
                }
            )
    audit(
        db,
        "institution.csv_import",
        "institution_batch",
        None,
        user,
        metadata={
            "accepted": sum(r["status"] == "accepted" for r in result),
            "rows": len(records),
        },
    )
    db.commit()
    return {
        "rows": result,
        "accepted": sum(r["status"] == "accepted" for r in result),
        "rejected": sum(r["status"] != "accepted" for r in result),
    }


@router.get("/profile")
def own_profile(
    db: Session = Depends(get_db), user: User = Depends(require_roles(Role.student))
):
    student = db.get(Student, user.student_id)
    if not student:
        raise HTTPException(404, "Student profile not found")
    return {
        "id": student.id,
        "name": student.full_name,
        "masked_apaar": student.masked_apaar,
        "verification_status": student.verification_status,
        "provenance": student.provenance,
        "synthetic": student.synthetic,
    }


@router.get("/privacy-config")
def privacy_configuration(user: User = Depends(current_user)):
    from ..config import settings

    return {"certificate_full_identifier": settings.certificate_full_identifier}


def scoped(db, user, institution_id):
    enforce_institution_scope(user, institution_id, db)


def view(item):
    return {
        c.name: getattr(item, c.name)
        for c in item.__table__.columns
        if c.name not in {"password_hash", "apaar_encrypted", "apaar_lookup"}
    }


class ProgrammeInput(BaseModel):
    institution_id: str
    code: str = Field(min_length=2, max_length=40)
    name: str = Field(min_length=2, max_length=180)
    specialization: str = Field(min_length=2, max_length=180)
    level: Literal["UG", "PG", "Diploma"] = "UG"


class Transition(BaseModel):
    status: Literal[
        "draft",
        "submitted",
        "validation_pending",
        "flagged",
        "accepted",
        "enrolled",
        "transferred",
        "withdrawn",
        "completed",
        "rejected",
    ]
    reason: str = Field(min_length=8, max_length=1000)
    attested: bool | None = None
    institution_student_id: str | None = Field(
        default=None, min_length=2, max_length=80
    )
    seat_type: Literal["regular", "supernumerary"] | None = None


class CorrectionReview(BaseModel):
    decision: Literal["approved", "rejected"]
    reason: str = Field(min_length=8)


class PolicyInput(BaseModel):
    name: str = Field(min_length=3, max_length=160)
    version: str = Field(min_length=3, max_length=30)
    count_statuses: list[Literal["accepted", "enrolled", "flagged", "completed"]] = [
        "accepted",
        "enrolled",
        "flagged",
        "completed",
    ]
    nri_exempt_from_regular: bool = False
    allow_concurrent_enrolment: bool = False


class UserInput(BaseModel):
    email: str = Field(pattern=r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
    name: str = Field(min_length=2, max_length=160)
    role: Role
    password: str = Field(min_length=12, max_length=128)
    institution_id: str | None = None
    student_id: str | None = None
    region: str | None = None


class UserUpdate(BaseModel):
    role: Role
    active: bool


@router.patch("/users/{user_id}")
def update_user(
    user_id: str,
    payload: UserUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(*CENTRAL)),
):
    item = db.get(User, user_id)
    if not item:
        raise HTTPException(404, "User not found")
    if item.id == user.id and (
        not payload.active or payload.role.value not in {"aicte_admin", "system_admin"}
    ):
        raise HTTPException(422, "Cannot remove your own central access")
    if payload.role.value.startswith("institution_") and not item.institution_id:
        raise HTTPException(422, "Institution membership required")
    if payload.role == Role.student and not item.student_id:
        raise HTTPException(422, "Student association required")
    before = {"role": item.role, "active": item.active}
    item.role = payload.role.value
    item.active = payload.active
    from ..models import SessionToken
    from sqlalchemy import delete

    db.execute(delete(SessionToken).where(SessionToken.user_id == item.id))
    audit(
        db,
        "user.authorization.updated",
        "user",
        item.id,
        user,
        metadata={"before": before, "after": payload.model_dump()},
    )
    db.commit()
    return view(item)


@router.patch("/institutions/{institution_id}")
def edit_institution(
    institution_id: str,
    payload: InstitutionCreate,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(*EDIT)),
):
    scoped(db, user, institution_id)
    item = db.get(Institution, institution_id)
    if not item:
        raise HTTPException(404, "Institution not found")
    collision = db.scalar(
        select(Institution).where(
            Institution.permanent_id == payload.permanent_id,
            Institution.id != institution_id,
        )
    )
    if collision:
        raise HTTPException(409, "Permanent ID is already registered")
    before = view(item)
    for key, value in payload.model_dump().items():
        setattr(item, key, str(value))
    audit(
        db,
        "institution.updated",
        "institution",
        item.id,
        user,
        item.id,
        {"before": before, "after": view(item)},
    )
    db.commit()
    return view(item)


@router.post("/programmes")
def add_programme(
    payload: ProgrammeInput,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(*EDIT)),
):
    scoped(db, user, payload.institution_id)
    if not db.get(Institution, payload.institution_id):
        raise HTTPException(404, "Institution not found")
    if db.scalar(
        select(Programme).where(
            Programme.institution_id == payload.institution_id,
            Programme.code == payload.code,
        )
    ):
        raise HTTPException(409, "Programme code already exists at institution")
    item = Programme(**payload.model_dump())
    db.add(item)
    db.flush()
    audit(db, "programme.created", "programme", item.id, user, item.institution_id)
    db.commit()
    return view(item)


@router.patch("/programmes/{programme_id}")
def edit_programme(
    programme_id: str,
    payload: ProgrammeInput,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(*EDIT)),
):
    item = db.get(Programme, programme_id)
    if not item:
        raise HTTPException(404, "Programme not found")
    scoped(db, user, item.institution_id)
    if item.institution_id != payload.institution_id:
        raise HTTPException(422, "Cannot move programme to another institution")
    for key, value in payload.model_dump().items():
        setattr(item, key, value)
    audit(db, "programme.updated", "programme", item.id, user, item.institution_id)
    db.commit()
    return view(item)


@router.get("/academic-years")
def years(db: Session = Depends(get_db), user: User = Depends(current_user)):
    values = set(db.scalars(select(ApprovedIntake.academic_year)).all()) | set(
        db.scalars(select(AcademicYear.name)).all()
    )
    return {"items": sorted(values, reverse=True)}


class YearInput(BaseModel):
    name: str = Field(pattern=r"^20[0-9]{2}-[0-9]{2}$")


@router.post("/academic-years")
def add_year(
    payload: YearInput,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(*CENTRAL)),
):
    if int(payload.name[-2:]) != (int(payload.name[:4]) + 1) % 100:
        raise HTTPException(422, "Academic year must span consecutive years")
    item = db.get(AcademicYear, payload.name)
    if not item:
        db.add(AcademicYear(name=payload.name))
    audit(db, "academic_year.created", "academic_year", payload.name, user)
    db.commit()
    return {"name": payload.name}


@router.get("/policies")
def policies(db: Session = Depends(get_db), user: User = Depends(current_user)):
    return {"items": [view(p) for p in db.scalars(select(CapacityPolicy)).all()]}


@router.post("/policies")
def add_policy(
    payload: PolicyInput,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(*CENTRAL)),
):
    if db.scalar(
        select(CapacityPolicy).where(CapacityPolicy.version == payload.version)
    ):
        raise HTTPException(409, "Policy version already exists; create a new version")
    item = CapacityPolicy(
        name=payload.name,
        version=payload.version,
        effective_from=date.today(),
        rules={
            "regular_counts": ["regular"],
            "supernumerary_counts": ["supernumerary"],
            "count_statuses": payload.count_statuses,
            "nri_exempt_from_regular": payload.nri_exempt_from_regular,
            "allow_concurrent_enrolment": payload.allow_concurrent_enrolment,
        },
        demonstration=True,
    )
    db.add(item)
    db.flush()
    audit(
        db,
        "policy.created",
        "capacity_policy",
        item.id,
        user,
        metadata=payload.model_dump(),
    )
    db.commit()
    return view(item)


@router.post("/intakes")
def approve_intake(
    payload: IntakeCreate,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(*CENTRAL)),
):
    programme = db.get(Programme, payload.programme_id)
    if not programme or programme.institution_id != payload.institution_id:
        raise HTTPException(422, "Programme/institution mismatch")
    if not db.get(CapacityPolicy, payload.policy_id):
        raise HTTPException(422, "Unknown policy")
    item = db.scalar(
        select(ApprovedIntake).where(
            ApprovedIntake.programme_id == payload.programme_id,
            ApprovedIntake.academic_year == payload.academic_year,
        )
    )
    before = view(item) if item else None
    if item:
        for key, value in payload.model_dump().items():
            setattr(item, key, value)
    else:
        item = ApprovedIntake(**payload.model_dump())
        db.add(item)
    db.flush()
    audit(
        db,
        "intake.authorized",
        "approved_intake",
        item.id,
        user,
        item.institution_id,
        {"before": before, "after": view(item)},
    )
    refresh_intake_finding(
        db, item.institution_id, item.programme_id, item.academic_year
    )
    db.commit()
    return view(item)


@router.patch("/enrolments/{enrolment_id}")
def transition(
    enrolment_id: str,
    payload: Transition,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(*EDIT, Role.institution_operator)),
):
    item = db.get(Enrolment, enrolment_id)
    if not item:
        raise HTTPException(404, "Enrolment not found")
    scoped(db, user, item.institution_id)
    before = view(item)
    transitions = {
        "draft": {"submitted", "rejected"},
        "submitted": {"validation_pending", "accepted", "flagged", "rejected"},
        "validation_pending": {"accepted", "flagged", "rejected"},
        "flagged": {"accepted", "rejected", "transferred", "withdrawn"},
        "accepted": {"enrolled", "withdrawn", "transferred", "flagged"},
        "enrolled": {"completed", "transferred", "withdrawn", "flagged"},
        "rejected": {"submitted"},
        "transferred": set(),
        "withdrawn": set(),
        "completed": set(),
    }
    if payload.status != item.status and payload.status not in transitions.get(
        item.status, set()
    ):
        raise HTTPException(
            422, f"Invalid transition from {item.status} to {payload.status}"
        )
    for key, value in payload.model_dump(exclude={"reason"}, exclude_none=True).items():
        setattr(item, key, value)
    after = view(item)
    # JSON snapshots are serialized explicitly for dates.
    before = {
        k: v.isoformat() if isinstance(v, (date, datetime)) else v
        for k, v in before.items()
    }
    after = {
        k: v.isoformat() if isinstance(v, (date, datetime)) else v
        for k, v in after.items()
    }
    db.add(
        RecordVersion(
            enrolment_id=item.id,
            actor_id=user.id,
            before=before,
            after=after,
            reason=payload.reason,
        )
    )
    audit(
        db,
        "enrolment.transitioned",
        "enrolment",
        item.id,
        user,
        item.institution_id,
        {"from": before["status"], "to": item.status, "reason": payload.reason},
    )
    db.flush()
    refresh_intake_finding(
        db, item.institution_id, item.programme_id, item.academic_year
    )
    db.commit()
    return after


@router.get("/enrolments/{enrolment_id}/history")
def history(
    enrolment_id: str, db: Session = Depends(get_db), user: User = Depends(current_user)
):
    item = db.get(Enrolment, enrolment_id)
    if not item:
        raise HTTPException(404, "Enrolment not found")
    if user.role == "student":
        if item.student_id != user.student_id:
            raise HTTPException(403, "Student scope violation")
    else:
        scoped(db, user, item.institution_id)
    return {
        "items": [
            view(v)
            for v in db.scalars(
                select(RecordVersion)
                .where(RecordVersion.enrolment_id == item.id)
                .order_by(desc(RecordVersion.created_at))
            ).all()
        ]
    }


@router.get("/corrections")
def corrections(db: Session = Depends(get_db), user: User = Depends(current_user)):
    query = select(CorrectionRequest).join(
        Enrolment, CorrectionRequest.enrolment_id == Enrolment.id
    )
    if user.role == "student":
        query = query.where(CorrectionRequest.student_id == user.student_id)
    elif user.role.startswith("institution_"):
        query = query.where(Enrolment.institution_id == user.institution_id)
    elif user.role == "regional_officer":
        query = query.join(
            Institution, Enrolment.institution_id == Institution.id
        ).where(Institution.region == user.region)
    return {
        "items": [
            view(c)
            for c in db.scalars(
                query.order_by(desc(CorrectionRequest.created_at))
            ).all()
        ]
    }


@router.post("/corrections/{correction_id}/review")
def review_correction(
    correction_id: str,
    payload: CorrectionReview,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(*EDIT)),
):
    item = db.get(CorrectionRequest, correction_id)
    if not item:
        raise HTTPException(404, "Correction not found")
    enrolment = db.get(Enrolment, item.enrolment_id)
    scoped(db, user, enrolment.institution_id)
    if item.status != "open":
        raise HTTPException(409, "Correction already reviewed")
    if payload.decision == "approved":
        if item.field_name not in {"institution_student_id", "full_name"}:
            raise HTTPException(
                422, "Supported correction fields: full_name, institution_student_id"
            )
        target = (
            db.get(Student, item.student_id)
            if item.field_name == "full_name"
            else enrolment
        )
        before = getattr(target, item.field_name)
        setattr(target, item.field_name, item.requested_value)
        db.add(
            RecordVersion(
                enrolment_id=enrolment.id,
                actor_id=user.id,
                before={item.field_name: before},
                after={item.field_name: item.requested_value},
                reason=payload.reason,
            )
        )
    item.status = payload.decision
    audit(
        db,
        "correction.reviewed",
        "correction_request",
        item.id,
        user,
        enrolment.institution_id,
        payload.model_dump(),
    )
    db.commit()
    return view(item)


@router.post("/notifications/{notification_id}/read")
def mark_read(
    notification_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(current_user),
):
    item = db.get(Notification, notification_id)
    if not item:
        raise HTTPException(404, "Notification not found")
    if item.user_id and item.user_id != user.id:
        raise HTTPException(403, "Notification scope violation")
    if item.institution_id:
        scoped(db, user, item.institution_id)
    item.read_at = datetime.now(timezone.utc)
    db.commit()
    return {"read": True}


@router.get("/users")
def users(db: Session = Depends(get_db), user: User = Depends(require_roles(*CENTRAL))):
    return {"items": [view(u) for u in db.scalars(select(User)).all()]}


@router.post("/users")
def add_user(
    payload: UserInput,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(*CENTRAL)),
):
    if db.scalar(select(User).where(User.email == payload.email.lower())):
        raise HTTPException(409, "Email already exists")
    if payload.role.value.startswith("institution_") and not db.get(
        Institution, payload.institution_id
    ):
        raise HTTPException(422, "Institution role requires a valid institution")
    if payload.role == Role.student and not db.get(Student, payload.student_id):
        raise HTTPException(422, "Student role requires a valid student")
    values = payload.model_dump(exclude={"password"})
    values["email"] = values["email"].lower()
    values["role"] = payload.role.value
    item = User(**values, password_hash=hash_password(payload.password))
    db.add(item)
    db.flush()
    audit(db, "user.created", "user", item.id, user, metadata={"role": item.role})
    db.commit()
    return view(item)


@router.get("/integrations")
def integrations(user: User = Depends(require_roles(*CENTRAL, Role.auditor))):
    return {
        "items": [
            {
                "provider": p,
                "status": "unavailable",
                "reason": "No authorized provider credentials or API agreement configured",
            }
            for p in ["Official APAAR", "DigiLocker", "AICTE registry"]
        ],
        "working_adapters": ["CSV", "XLSX", "Versioned REST/OpenAPI"],
    }


@router.post("/jobs/maintenance")
def maintenance_job(
    db: Session = Depends(get_db), user: User = Depends(require_roles(*CENTRAL))
):
    from ..services.jobs import maintenance

    result = maintenance(db)
    audit(
        db,
        "maintenance.completed",
        "background_job",
        "maintenance",
        user,
        metadata=result,
    )
    db.commit()
    return result
