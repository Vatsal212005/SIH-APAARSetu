from __future__ import annotations

from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)


class UserView(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    email: str
    name: str
    role: str
    institution_id: str | None
    student_id: str | None
    region: str | None


class InstitutionCreate(BaseModel):
    permanent_id: str = Field(min_length=4, max_length=40)
    name: str = Field(min_length=3, max_length=220)
    institution_type: str
    address: str
    city: str
    state: str
    region: str
    contact_email: EmailStr


class StudentCreate(BaseModel):
    institution_id: str
    programme_id: str
    academic_year: str = Field(pattern=r"^20\d{2}-\d{2}$")
    apaar_id: str | None = None
    full_name: str = Field(min_length=2, max_length=180)
    date_of_birth: date | None = None
    institution_student_id: str
    admission_date: date
    seat_type: str = "regular"
    nri_category: bool = False
    oci_status: bool = False
    foreign_national: bool = False


class FindingReview(BaseModel):
    action: str = Field(
        pattern=r"^(confirm_discrepancy|request_clarification|mark_expected|reject_finding|resolve)$"
    )
    justification: str = Field(min_length=8, max_length=1000)


class ConsentCreate(BaseModel):
    credential_id: str
    verifier_name: str = Field(min_length=2, max_length=180)
    purpose: str = Field(min_length=3, max_length=240)
    fields: list[str] = Field(min_length=1)
    expires_in_hours: int = Field(default=24, ge=1, le=720)


class CorrectionCreate(BaseModel):
    enrolment_id: str
    field_name: str
    requested_value: str
    reason: str = Field(min_length=8, max_length=1000)


class CredentialIssue(BaseModel):
    enrolment_id: str
    expires_in_days: int = Field(default=365, ge=1, le=3650)


class IntakeCreate(BaseModel):
    institution_id: str
    programme_id: str
    academic_year: str
    regular_capacity: int = Field(ge=0, le=10000)
    supernumerary_capacity: int = Field(default=0, ge=0, le=5000)
    nri_capacity: int = Field(default=0, ge=0, le=5000)
    policy_id: str
    effective_from: date


class ImportPreviewRow(BaseModel):
    row_number: int
    data: dict
    result: str
    errors: list[str]


class HealthView(BaseModel):
    status: str
    database: str
    demo_mode: bool
    timestamp: datetime
