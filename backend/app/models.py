from __future__ import annotations

import enum
import uuid
from datetime import date, datetime, timezone

from sqlalchemy import (
    Boolean,
    Date,
    DateTime,
    Float,
    ForeignKey,
    Index,
    Integer,
    JSON,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .database import Base


def uid() -> str:
    return str(uuid.uuid4())


def now() -> datetime:
    return datetime.now(timezone.utc)


class Role(str, enum.Enum):
    system_admin = "system_admin"
    aicte_admin = "aicte_admin"
    regional_officer = "regional_officer"
    institution_admin = "institution_admin"
    institution_operator = "institution_operator"
    student = "student"
    verifier = "verifier"
    auditor = "auditor"


class User(Base):
    __tablename__ = "users"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    email: Mapped[str] = mapped_column(String(254), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(160))
    password_hash: Mapped[str] = mapped_column(Text)
    role: Mapped[str] = mapped_column(String(40), index=True)
    institution_id: Mapped[str | None] = mapped_column(
        ForeignKey("institutions.id"), nullable=True, index=True
    )
    student_id: Mapped[str | None] = mapped_column(
        ForeignKey("students.id"), nullable=True, index=True
    )
    region: Mapped[str | None] = mapped_column(String(80))
    active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)


class SessionToken(Base):
    __tablename__ = "session_tokens"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    token_hash: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    csrf_token: Mapped[str] = mapped_column(String(64))
    user_id: Mapped[str] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)
    user: Mapped[User] = relationship()


class Institution(Base):
    __tablename__ = "institutions"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    permanent_id: Mapped[str] = mapped_column(String(40), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(220), index=True)
    institution_type: Mapped[str] = mapped_column(String(80))
    address: Mapped[str] = mapped_column(String(300))
    city: Mapped[str] = mapped_column(String(100))
    state: Mapped[str] = mapped_column(String(100), index=True)
    region: Mapped[str] = mapped_column(String(80), index=True)
    approval_status: Mapped[str] = mapped_column(
        String(40), default="approved", index=True
    )
    contact_email: Mapped[str] = mapped_column(String(254))
    synthetic: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)
    programmes: Mapped[list[Programme]] = relationship(
        back_populates="institution", cascade="all, delete-orphan"
    )


class Programme(Base):
    __tablename__ = "programmes"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    institution_id: Mapped[str] = mapped_column(
        ForeignKey("institutions.id", ondelete="CASCADE"), index=True
    )
    code: Mapped[str] = mapped_column(String(40))
    name: Mapped[str] = mapped_column(String(180))
    specialization: Mapped[str] = mapped_column(String(180))
    level: Mapped[str] = mapped_column(String(40), default="UG")
    active: Mapped[bool] = mapped_column(Boolean, default=True)
    institution: Mapped[Institution] = relationship(back_populates="programmes")
    __table_args__ = (
        UniqueConstraint(
            "institution_id", "code", name="uq_programme_institution_code"
        ),
    )


class CapacityPolicy(Base):
    __tablename__ = "capacity_policies"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    name: Mapped[str] = mapped_column(String(160))
    version: Mapped[str] = mapped_column(String(30), unique=True)
    effective_from: Mapped[date] = mapped_column(Date)
    rules: Mapped[dict] = mapped_column(JSON)
    demonstration: Mapped[bool] = mapped_column(Boolean, default=True)
    active: Mapped[bool] = mapped_column(Boolean, default=True)


class ApprovedIntake(Base):
    __tablename__ = "approved_intakes"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    institution_id: Mapped[str] = mapped_column(
        ForeignKey("institutions.id"), index=True
    )
    programme_id: Mapped[str] = mapped_column(ForeignKey("programmes.id"), index=True)
    academic_year: Mapped[str] = mapped_column(String(12), index=True)
    regular_capacity: Mapped[int] = mapped_column(Integer)
    supernumerary_capacity: Mapped[int] = mapped_column(Integer, default=0)
    nri_capacity: Mapped[int] = mapped_column(Integer, default=0)
    policy_id: Mapped[str] = mapped_column(ForeignKey("capacity_policies.id"))
    approval_status: Mapped[str] = mapped_column(String(40), default="authorized_demo")
    effective_from: Mapped[date] = mapped_column(Date)
    effective_to: Mapped[date | None] = mapped_column(Date, nullable=True)
    __table_args__ = (
        UniqueConstraint(
            "programme_id", "academic_year", name="uq_intake_programme_year"
        ),
    )


class Student(Base):
    __tablename__ = "students"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    apaar_encrypted: Mapped[str | None] = mapped_column(Text, nullable=True)
    apaar_lookup: Mapped[str | None] = mapped_column(
        String(64), nullable=True, index=True
    )
    apaar_last4: Mapped[str | None] = mapped_column(String(4), nullable=True)
    full_name: Mapped[str] = mapped_column(String(180), index=True)
    date_of_birth: Mapped[date | None] = mapped_column(Date, nullable=True)
    verification_status: Mapped[str] = mapped_column(
        String(60), default="format_validated", index=True
    )
    provenance: Mapped[dict] = mapped_column(JSON, default=dict)
    synthetic: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)

    @property
    def masked_apaar(self) -> str:
        return f"********{self.apaar_last4}" if self.apaar_last4 else "Not provided"


class Enrolment(Base):
    __tablename__ = "enrolments"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    student_id: Mapped[str] = mapped_column(ForeignKey("students.id"), index=True)
    institution_id: Mapped[str] = mapped_column(
        ForeignKey("institutions.id"), index=True
    )
    programme_id: Mapped[str] = mapped_column(ForeignKey("programmes.id"), index=True)
    academic_year: Mapped[str] = mapped_column(String(12), index=True)
    institution_student_id: Mapped[str] = mapped_column(String(80))
    admission_date: Mapped[date] = mapped_column(Date)
    status: Mapped[str] = mapped_column(String(40), default="submitted", index=True)
    seat_type: Mapped[str] = mapped_column(String(40), default="regular", index=True)
    nri_category: Mapped[bool] = mapped_column(Boolean, default=False)
    oci_status: Mapped[bool] = mapped_column(Boolean, default=False)
    foreign_national: Mapped[bool] = mapped_column(Boolean, default=False)
    attested: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=now, onupdate=now
    )
    student: Mapped[Student] = relationship()
    institution: Mapped[Institution] = relationship()
    programme: Mapped[Programme] = relationship()
    __table_args__ = (
        UniqueConstraint(
            "institution_id",
            "institution_student_id",
            "academic_year",
            name="uq_enrolment_local_id_year",
        ),
    )


class ImportBatch(Base):
    __tablename__ = "import_batches"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    institution_id: Mapped[str] = mapped_column(
        ForeignKey("institutions.id"), index=True
    )
    programme_id: Mapped[str] = mapped_column(ForeignKey("programmes.id"), index=True)
    academic_year: Mapped[str] = mapped_column(String(12), index=True)
    filename: Mapped[str] = mapped_column(String(220))
    content_hash: Mapped[str] = mapped_column(String(64), unique=True)
    status: Mapped[str] = mapped_column(String(40), default="processed")
    accepted_count: Mapped[int] = mapped_column(Integer, default=0)
    rejected_count: Mapped[int] = mapped_column(Integer, default=0)
    flagged_count: Mapped[int] = mapped_column(Integer, default=0)
    duplicate_count: Mapped[int] = mapped_column(Integer, default=0)
    created_by: Mapped[str] = mapped_column(ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)


class ImportRow(Base):
    __tablename__ = "import_rows"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    batch_id: Mapped[str] = mapped_column(
        ForeignKey("import_batches.id", ondelete="CASCADE"), index=True
    )
    row_number: Mapped[int] = mapped_column(Integer)
    raw_data: Mapped[dict] = mapped_column(JSON)
    result: Mapped[str] = mapped_column(String(30), index=True)
    errors: Mapped[list] = mapped_column(JSON, default=list)
    enrolment_id: Mapped[str | None] = mapped_column(
        ForeignKey("enrolments.id"), nullable=True
    )


class Finding(Base):
    __tablename__ = "anomaly_findings"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    institution_id: Mapped[str] = mapped_column(
        ForeignKey("institutions.id"), index=True
    )
    programme_id: Mapped[str | None] = mapped_column(
        ForeignKey("programmes.id"), nullable=True, index=True
    )
    academic_year: Mapped[str] = mapped_column(String(12), index=True)
    finding_type: Mapped[str] = mapped_column(String(80), index=True)
    source: Mapped[str] = mapped_column(String(30))
    severity: Mapped[str] = mapped_column(String(20), index=True)
    title: Mapped[str] = mapped_column(String(220))
    explanation: Mapped[str] = mapped_column(Text)
    evidence: Mapped[dict] = mapped_column(JSON)
    model_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    review_state: Mapped[str] = mapped_column(String(40), default="open", index=True)
    assigned_to: Mapped[str | None] = mapped_column(
        ForeignKey("users.id"), nullable=True
    )
    resolution: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=now, onupdate=now
    )
    __table_args__ = (
        Index("ix_finding_scope", "institution_id", "academic_year", "finding_type"),
    )


class Credential(Base):
    __tablename__ = "academic_credentials"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    credential_code: Mapped[str] = mapped_column(String(80), unique=True, index=True)
    student_id: Mapped[str] = mapped_column(ForeignKey("students.id"), index=True)
    enrolment_id: Mapped[str] = mapped_column(ForeignKey("enrolments.id"), index=True)
    issuer_institution_id: Mapped[str] = mapped_column(
        ForeignKey("institutions.id"), index=True
    )
    payload: Mapped[dict] = mapped_column(JSON)
    signature: Mapped[str] = mapped_column(Text)
    key_id: Mapped[str] = mapped_column(String(80))
    issued_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)
    expires_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    revoked_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    revocation_reason: Mapped[str | None] = mapped_column(Text, nullable=True)


class ConsentGrant(Base):
    __tablename__ = "consent_grants"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    student_id: Mapped[str] = mapped_column(ForeignKey("students.id"), index=True)
    credential_id: Mapped[str] = mapped_column(
        ForeignKey("academic_credentials.id"), index=True
    )
    verifier_name: Mapped[str] = mapped_column(String(180))
    fields: Mapped[list] = mapped_column(JSON)
    purpose: Mapped[str] = mapped_column(String(240))
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    revoked_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)


class DisclosureToken(Base):
    __tablename__ = "disclosure_tokens"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    consent_id: Mapped[str] = mapped_column(
        ForeignKey("consent_grants.id", ondelete="CASCADE"), index=True
    )
    token_hash: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)


class VerificationEvent(Base):
    __tablename__ = "verification_events"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    credential_id: Mapped[str] = mapped_column(
        ForeignKey("academic_credentials.id"), index=True
    )
    consent_id: Mapped[str | None] = mapped_column(
        ForeignKey("consent_grants.id"), nullable=True
    )
    verifier_name: Mapped[str] = mapped_column(String(180))
    outcome: Mapped[str] = mapped_column(String(40), index=True)
    details: Mapped[dict] = mapped_column(JSON)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)


class CorrectionRequest(Base):
    __tablename__ = "correction_requests"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    student_id: Mapped[str] = mapped_column(ForeignKey("students.id"), index=True)
    enrolment_id: Mapped[str] = mapped_column(ForeignKey("enrolments.id"), index=True)
    field_name: Mapped[str] = mapped_column(String(80))
    requested_value: Mapped[str] = mapped_column(Text)
    reason: Mapped[str] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(40), default="open", index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)


class Notification(Base):
    __tablename__ = "notifications"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    user_id: Mapped[str | None] = mapped_column(
        ForeignKey("users.id"), nullable=True, index=True
    )
    institution_id: Mapped[str | None] = mapped_column(
        ForeignKey("institutions.id"), nullable=True, index=True
    )
    severity: Mapped[str] = mapped_column(String(20), default="info")
    title: Mapped[str] = mapped_column(String(220))
    body: Mapped[str] = mapped_column(Text)
    deep_link: Mapped[str | None] = mapped_column(String(260))
    dedupe_key: Mapped[str | None] = mapped_column(String(160), index=True)
    read_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)


class AuditEvent(Base):
    __tablename__ = "audit_events"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    actor_user_id: Mapped[str | None] = mapped_column(
        ForeignKey("users.id"), nullable=True, index=True
    )
    institution_id: Mapped[str | None] = mapped_column(
        ForeignKey("institutions.id"), nullable=True, index=True
    )
    action: Mapped[str] = mapped_column(String(120), index=True)
    entity_type: Mapped[str] = mapped_column(String(80))
    entity_id: Mapped[str | None] = mapped_column(String(80))
    metadata_json: Mapped[dict] = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=now, index=True
    )


class RecordVersion(Base):
    __tablename__ = "student_record_versions"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    enrolment_id: Mapped[str] = mapped_column(ForeignKey("enrolments.id"), index=True)
    actor_id: Mapped[str] = mapped_column(ForeignKey("users.id"))
    before: Mapped[dict] = mapped_column(JSON)
    after: Mapped[dict] = mapped_column(JSON)
    reason: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)


class AcademicYear(Base):
    __tablename__ = "academic_years"
    name: Mapped[str] = mapped_column(String(12), primary_key=True)
    active: Mapped[bool] = mapped_column(Boolean, default=True)


class DemoSession(Base):
    __tablename__ = "demo_sessions"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    scenario: Mapped[str] = mapped_column(String(80))
    state: Mapped[dict] = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)
