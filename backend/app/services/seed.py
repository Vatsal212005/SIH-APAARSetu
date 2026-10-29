from __future__ import annotations

import random
import uuid
from datetime import date, datetime, timedelta, timezone

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..models import (
    ApprovedIntake,
    AuditEvent,
    CapacityPolicy,
    Credential,
    Enrolment,
    Finding,
    Institution,
    Notification,
    Programme,
    Role,
    Student,
    User,
)
from ..security import encrypt_identifier, hash_password, opaque_hash
from .credentials import issue_credential
from .validation import refresh_intake_finding


SEED_NAMESPACE = uuid.UUID("9f2f32b6-f742-4d96-8ef4-29d53e870263")
DEMO_PASSWORD = "Demo@26263"


def sid(kind: str, value: str) -> str:
    return str(uuid.uuid5(SEED_NAMESPACE, f"{kind}:{value}"))


STATES = [
    ("Karnataka", "Southern", "Bengaluru"),
    ("Maharashtra", "Western", "Pune"),
    ("Tamil Nadu", "Southern", "Coimbatore"),
    ("Telangana", "Southern", "Hyderabad"),
    ("Gujarat", "Western", "Ahmedabad"),
    ("Rajasthan", "Northern", "Jaipur"),
    ("Uttar Pradesh", "Northern", "Lucknow"),
    ("West Bengal", "Eastern", "Kolkata"),
    ("Odisha", "Eastern", "Bhubaneswar"),
    ("Madhya Pradesh", "Central", "Bhopal"),
]
PROGRAMMES = [
    ("BTECH-CSE", "B.Tech", "Computer Science and Engineering"),
    ("BTECH-ECE", "B.Tech", "Electronics and Communication Engineering"),
    ("MBA", "MBA", "Technology Management"),
]
FIRST_NAMES = [
    "Aarav",
    "Diya",
    "Ishaan",
    "Meera",
    "Kabir",
    "Ananya",
    "Vihaan",
    "Sara",
    "Arjun",
    "Nisha",
]


def seed_demo(
    db: Session, student_count: int = 5000, institution_count: int = 100
) -> dict:
    random.seed(26263)
    policy = db.scalar(
        select(CapacityPolicy).where(CapacityPolicy.version == "DEMO-CAPACITY-2026.1")
    )
    if not policy:
        policy = CapacityPolicy(
            id=sid("policy", "2026.1"),
            name="Synthetic AICTE Capacity Demonstration Policy",
            version="DEMO-CAPACITY-2026.1",
            effective_from=date(2024, 7, 1),
            rules={
                "regular_counts": ["regular"],
                "supernumerary_counts_separately": True,
                "nri_is_admission_category": True,
                "oci_is_identity_status": True,
                "foreign_national_is_identity_status": True,
                "withdrawn_excluded": True,
            },
        )
        db.add(policy)
        db.flush()

    institutions = [
        db.get(Institution, sid("institution", str(index)))
        for index in range(institution_count)
    ]
    if any(institution is None for institution in institutions):
        institutions = []
        for index in range(institution_count):
            existing = db.get(Institution, sid("institution", str(index)))
            if existing:
                institutions.append(existing)
                continue
            state, region, city = STATES[index % len(STATES)]
            institution = Institution(
                id=sid("institution", str(index)),
                permanent_id=f"SYN-AICTE-{index + 1:04d}",
                name=f"Synthetic {city} Institute of Technology {index + 1:03d}",
                institution_type="Private-Self Financing"
                if index % 3
                else "Government",
                address=f"Demonstration Campus {index + 1}, Fictional Knowledge Park",
                city=city,
                state=state,
                region=region,
                contact_email=f"demo{index + 1:03d}@example.invalid",
            )
            db.add(institution)
            institutions.append(institution)
        db.flush()

    programmes: list[Programme] = []
    for i, institution in enumerate(institutions[:institution_count]):
        for code, name, specialization in PROGRAMMES:
            programme_id = sid("programme", f"{i}:{code}")
            programme = db.get(Programme, programme_id)
            if not programme:
                programme = Programme(
                    id=programme_id,
                    institution_id=institution.id,
                    code=code,
                    name=name,
                    specialization=specialization,
                    level="PG" if code == "MBA" else "UG",
                )
                db.add(programme)
            programmes.append(programme)
    db.flush()

    for i, institution in enumerate(institutions[:institution_count]):
        for p_index, _spec in enumerate(PROGRAMMES):
            programme = programmes[i * 3 + p_index]
            for year in ("2024-25", "2025-26", "2026-27"):
                intake_id = sid("intake", f"{programme.id}:{year}")
                if db.get(ApprovedIntake, intake_id):
                    continue
                regular = (
                    120
                    if i == 0 and p_index == 0 and year == "2025-26"
                    else 60 + ((i + p_index) % 4) * 20
                )
                db.add(
                    ApprovedIntake(
                        id=intake_id,
                        institution_id=institution.id,
                        programme_id=programme.id,
                        academic_year=year,
                        regular_capacity=regular,
                        supernumerary_capacity=max(6, regular // 10),
                        nri_capacity=max(3, regular // 20),
                        policy_id=policy.id,
                        approval_status="authorized_demo",
                        effective_from=date(int(year[:4]), 7, 1),
                    )
                )

    current_students = db.scalar(select(func.count(Student.id))) or 0
    if current_students < student_count:
        for index in range(student_count):
            student_id = sid("student", str(index))
            if db.get(Student, student_id):
                continue
            apaar = f"{700000000000 + index:012d}"
            student = Student(
                id=student_id,
                apaar_encrypted=encrypt_identifier(apaar),
                apaar_lookup=opaque_hash(apaar),
                apaar_last4=apaar[-4:],
                full_name=f"{FIRST_NAMES[index % len(FIRST_NAMES)]} Synthetic Student {index + 1:04d}",
                date_of_birth=date(
                    2003 + (index % 5), (index % 12) + 1, (index % 27) + 1
                ),
                verification_status="internal_consistency_checked"
                if index % 17
                else "external_verification_pending",
                provenance={
                    "format_validation": "passed",
                    "institution_attestation": "synthetic_demo",
                    "internal_consistency": "checked",
                    "external_verification": "unavailable_demo_mode",
                },
            )
            db.add(student)
            if index < 135:
                inst_index, prog_index = 0, 0
            else:
                inst_index = 1 + ((index - 135) % (institution_count - 1))
                prog_index = (index // institution_count) % 3
            programme = programmes[inst_index * 3 + prog_index]
            seat_type = (
                "supernumerary" if index % 23 == 0 and index >= 135 else "regular"
            )
            status = (
                "withdrawn"
                if index % 97 == 0 and index >= 135
                else ("flagged" if index % 89 == 0 and index != 0 else "enrolled")
            )
            db.add(
                Enrolment(
                    id=sid("enrolment", str(index)),
                    student_id=student_id,
                    institution_id=institutions[inst_index].id,
                    programme_id=programme.id,
                    academic_year="2025-26",
                    institution_student_id=f"SYN-{inst_index + 1:03d}-{index + 1:05d}",
                    admission_date=date(2025, 7, 1) + timedelta(days=index % 90),
                    status=status,
                    seat_type=seat_type,
                    nri_category=index % 41 == 0,
                    oci_status=index % 113 == 0,
                    foreign_national=index % 157 == 0,
                    attested=True,
                )
            )
        db.flush()
        # A same-year cross-institution record that requires review; never auto-labelled as fraud.
        db.add(
            Enrolment(
                id=sid("enrolment", "cross-conflict"),
                student_id=sid("student", "0"),
                institution_id=institutions[1].id,
                programme_id=programmes[3].id,
                academic_year="2025-26",
                institution_student_id="SYN-CROSS-0001",
                admission_date=date(2025, 7, 15),
                status="flagged",
                seat_type="regular",
                attested=True,
            )
        )
        db.add(
            Finding(
                id=sid("finding", "cross-conflict"),
                institution_id=institutions[1].id,
                programme_id=programmes[3].id,
                academic_year="2025-26",
                finding_type="cross_institution_conflict",
                source="deterministic",
                severity="high",
                title="Potential concurrent cross-institution enrolment",
                explanation="The same synthetic APAAR-like identifier appears in active records at two institutions in the same academic year. A transfer or permitted concurrent enrolment remains possible and requires human adjudication.",
                evidence={
                    "student_id": sid("student", "0"),
                    "institution_a": institutions[0].name,
                    "institution_b": institutions[1].name,
                    "overlap": "2025-26",
                    "automatic_fraud_determination": False,
                },
            )
        )
        refresh_intake_finding(db, institutions[0].id, programmes[0].id, "2025-26")

    # Historical enrolments reuse student identity and remain outside the current-year snapshot.
    for index in range(min(student_count, 1000)):
        history_id = sid("history", str(index))
        source = db.get(Enrolment, sid("enrolment", str(index)))
        if source and not db.get(Enrolment, history_id):
            db.add(
                Enrolment(
                    id=history_id,
                    student_id=source.student_id,
                    institution_id=source.institution_id,
                    programme_id=source.programme_id,
                    academic_year="2024-25",
                    institution_student_id=f"HIST-{index:05d}",
                    admission_date=date(2024, 7, 1),
                    status="transferred" if index % 50 == 0 else "completed",
                    seat_type=source.seat_type,
                    nri_category=source.nri_category,
                    oci_status=source.oci_status,
                    foreign_national=source.foreign_national,
                    attested=True,
                )
            )
    db.flush()

    accounts = [
        (
            "central.admin@apaarsetu.demo",
            "Central AICTE Administrator",
            Role.aicte_admin.value,
            None,
            None,
            None,
        ),
        (
            "regional.officer@apaarsetu.demo",
            "Southern Regional Officer",
            Role.regional_officer.value,
            None,
            None,
            "Southern",
        ),
        (
            "institution.admin@apaarsetu.demo",
            "Institution Administrator",
            Role.institution_admin.value,
            institutions[0].id,
            None,
            None,
        ),
        (
            "institution.operator@apaarsetu.demo",
            "Institution Data Operator",
            Role.institution_operator.value,
            institutions[0].id,
            None,
            None,
        ),
        (
            "student@apaarsetu.demo",
            "Synthetic Student User",
            Role.student.value,
            None,
            sid("student", "0"),
            None,
        ),
        (
            "verifier@apaarsetu.demo",
            "Authorized Demo Verifier",
            Role.verifier.value,
            None,
            None,
            None,
        ),
        (
            "auditor@apaarsetu.demo",
            "Read-Only Auditor",
            Role.auditor.value,
            None,
            None,
            None,
        ),
    ]
    for email, name, role, institution_id, student_id, region in accounts:
        if not db.scalar(select(User).where(User.email == email)):
            db.add(
                User(
                    id=sid("user", email),
                    email=email,
                    name=name,
                    password_hash=hash_password(DEMO_PASSWORD),
                    role=role,
                    institution_id=institution_id,
                    student_id=student_id,
                    region=region,
                )
            )
    db.flush()

    if not db.scalar(
        select(AuditEvent).where(
            AuditEvent.action == "demo.seed.credential_eligibility.v2"
        )
    ):
        source = db.get(Enrolment, sid("enrolment", "0"))
        if source and source.status == "flagged":
            source.status = "enrolled"
            for old in db.scalars(
                select(Credential).where(Credential.enrolment_id == source.id)
            ).all():
                old.revoked_at = datetime.now(timezone.utc)
                old.revocation_reason = "Synthetic seed eligibility correction; superseded by reissued credential"
            issue_credential(db, source, 730)
        db.add(
            AuditEvent(
                action="demo.seed.credential_eligibility.v2",
                entity_type="enrolment",
                entity_id=source.id if source else None,
                metadata_json={
                    "reason": "Original institution attestation precedes the separate cross-institution conflict; prior signed payloads preserved"
                },
            )
        )
    credential = db.scalar(
        select(Credential).where(Credential.student_id == sid("student", "0"))
    )
    if not credential:
        enrolment = db.get(Enrolment, sid("enrolment", "0"))
        if enrolment:
            issue_credential(db, enrolment, 730)
    if not db.scalar(
        select(Notification).where(Notification.dedupe_key == "seed:welcome")
    ):
        db.add(
            Notification(
                title="Synthetic demonstration environment ready",
                body="All displayed identities, institutions and APAAR-like identifiers are fictional test data.",
                severity="info",
                deep_link="/demo",
                dedupe_key="seed:welcome",
            )
        )
    if not db.scalar(
        select(AuditEvent).where(AuditEvent.action == "demo.seed.completed")
    ):
        db.add(
            AuditEvent(
                action="demo.seed.completed",
                entity_type="synthetic_dataset",
                entity_id="seed-26263",
                metadata_json={
                    "seed": 26263,
                    "students": student_count,
                    "institutions": institution_count,
                    "synthetic": True,
                },
            )
        )
    db.commit()
    return {
        "institutions": db.scalar(select(func.count(Institution.id))),
        "programmes": db.scalar(select(func.count(Programme.id))),
        "students": db.scalar(select(func.count(Student.id))),
        "enrolments": db.scalar(select(func.count(Enrolment.id))),
        "demo_password": DEMO_PASSWORD,
        "seed": 26263,
    }
