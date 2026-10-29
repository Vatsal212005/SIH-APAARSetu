from datetime import datetime, timedelta, timezone
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select
from app.config import settings
from app.database import get_db
from app.main import app
from app.models import (
    ApprovedIntake,
    CapacityPolicy,
    ConsentGrant,
    Credential,
    Enrolment,
    RecordVersion,
    SessionToken,
    User,
)
from app.services.credentials import create_disclosure, verify_disclosure
from app.services.validation import capacity_snapshot, validate_student_row
from app.services.seed import sid

pytest_plugins = ["test_workflows"]


@pytest.fixture
def authenticated(db, monkeypatch):
    monkeypatch.setattr(settings, "demo_mode", True)
    app.dependency_overrides[get_db] = lambda: db

    def create(role):
        client = TestClient(app)
        account = db.scalar(select(User).where(User.role == role))
        response = client.post(
            "/api/v1/auth/login",
            json={"email": account.email, "password": "Demo@26263"},
        )
        assert response.status_code == 200, response.text
        client.headers["X-CSRF-Token"] = response.json()["csrf_token"]
        return client

    yield create
    app.dependency_overrides.clear()


@pytest.mark.parametrize(
    "role,path",
    [
        ("student", "/institutions"),
        ("student", "/students"),
        ("student", "/imports"),
        ("student", "/reports/summary"),
        ("student", "/findings"),
        ("verifier", "/enrolments"),
        ("verifier", "/credentials"),
        ("verifier", "/verification-events"),
        ("verifier", "/notifications"),
        ("institution_operator", "/users"),
        ("institution_operator", "/audit"),
        ("institution_admin", "/users"),
    ],
)
def test_negative_read_matrix(authenticated, role, path):
    assert authenticated(role).get("/api/v1" + path).status_code == 403


@pytest.mark.parametrize(
    "role",
    ["student", "institution_operator", "institution_admin", "verifier", "auditor"],
)
def test_no_unauthorized_capacity_mutation(authenticated, role):
    client = authenticated(role)
    response = client.post(
        "/api/v1/intakes",
        json={
            "institution_id": sid("institution", "0"),
            "programme_id": sid("programme", "0:BTECH-CSE"),
            "academic_year": "2025-26",
            "regular_capacity": 999,
            "policy_id": sid("policy", "2026.1"),
            "effective_from": "2025-07-01",
        },
    )
    assert response.status_code == 403


@pytest.mark.parametrize(
    "role", ["institution_operator", "student", "verifier", "auditor"]
)
def test_unauthorized_credential_issue(authenticated, role):
    assert (
        authenticated(role)
        .post("/api/v1/credentials/issue", json={"enrolment_id": sid("enrolment", "1")})
        .status_code
        == 403
    )


def test_session_expiry_and_csrf(authenticated, db):
    client = authenticated("aicte_admin")
    session = db.scalar(select(SessionToken))
    assert (
        client.post(
            "/api/v1/anomaly/run", headers={"X-CSRF-Token": "forged"}
        ).status_code
        == 403
    )
    session.expires_at = datetime.now(timezone.utc) - timedelta(minutes=1)
    db.commit()
    assert client.get("/api/v1/dashboard").status_code == 401


def test_student_other_credential_and_enrolment(authenticated, db):
    client = authenticated("student")
    assert (
        client.get(
            "/api/v1/enrolments/" + sid("enrolment", "1") + "/history"
        ).status_code
        == 403
    )
    rows = client.get("/api/v1/enrolments?student_id=" + sid("student", "1")).json()[
        "items"
    ]
    assert rows == []
    assert (
        client.post(
            "/api/v1/corrections",
            json={
                "enrolment_id": sid("enrolment", "1"),
                "field_name": "full_name",
                "requested_value": "Changed Name",
                "reason": "Unauthorized modification",
            },
        ).status_code
        == 404
    )


@pytest.mark.parametrize(
    "state", ["expired_consent", "revoked_credential", "expired_credential"]
)
def test_denied_disclosure_conditions(db, state):
    credential = db.scalar(select(Credential))
    consent = ConsentGrant(
        student_id=credential.student_id,
        credential_id=credential.id,
        verifier_name="Synthetic Recipient",
        fields=["student_name"],
        purpose="Test eligibility",
        expires_at=datetime.now(timezone.utc) + timedelta(hours=2),
    )
    db.add(consent)
    db.flush()
    token = create_disclosure(db, consent)
    if state == "expired_consent":
        consent.expires_at = datetime.now(timezone.utc) - timedelta(seconds=1)
    elif state == "revoked_credential":
        credential.revoked_at = datetime.now(timezone.utc)
    else:
        credential.expires_at = datetime.now(timezone.utc) - timedelta(seconds=1)
    db.commit()
    result = verify_disclosure(db, token)
    assert (
        not result["valid"]
        and result["disclosed_fields"] == {}
        and result["issuer"] is None
    )


def test_policy_category_and_withdrawal_counts(db):
    programme = sid("programme", "0:BTECH-CSE")
    institution = sid("institution", "0")
    intake = db.scalar(
        select(ApprovedIntake).where(
            ApprovedIntake.programme_id == programme,
            ApprovedIntake.academic_year == "2025-26",
        )
    )
    policy = db.get(CapacityPolicy, intake.policy_id)
    original = capacity_snapshot(db, institution, programme, "2025-26")
    policy.rules = {**policy.rules, "nri_exempt_from_regular": True}
    db.flush()
    changed = capacity_snapshot(db, institution, programme, "2025-26")
    assert changed["regular_enrolment"] < original["regular_enrolment"]
    item = db.get(Enrolment, sid("enrolment", "1"))
    item.status = "withdrawn"
    db.flush()
    assert (
        capacity_snapshot(db, institution, programme, "2025-26")["regular_enrolment"]
        == changed["regular_enrolment"] - 1
    )


def test_transfer_and_year_boundaries(db):
    data = {
        "apaar_id": "700000000000",
        "full_name": "Aarav Synthetic Student 0001",
        "institution_student_id": "TRANSFER-NEW",
    }
    # Existing cross record is at institution 1; testing a third institution.
    third = sid("institution", "2")
    result = validate_student_row(db, data, third, "2025-26")
    assert any("cross-institution" in f for f in result.flags)
    for e in db.scalars(
        select(Enrolment).where(Enrolment.student_id == sid("student", "0"))
    ).all():
        e.status = "transferred"
    db.flush()
    assert not validate_student_row(db, data, third, "2025-26").flags
    assert not validate_student_row(db, data, third, "2026-27").flags


def test_management_and_history(authenticated, db):
    client = authenticated("institution_admin")
    institution = sid("institution", "0")
    response = client.post(
        "/api/v1/programmes",
        json={
            "institution_id": institution,
            "code": "NEW-DEMO",
            "name": "B.Tech",
            "specialization": "Synthetic Robotics",
        },
    )
    assert response.status_code == 200, response.text
    assert (
        client.post(
            "/api/v1/programmes",
            json={
                "institution_id": sid("institution", "1"),
                "code": "FORBIDDEN",
                "name": "B.Tech",
                "specialization": "Wrong Institution",
            },
        ).status_code
        == 403
    )
    e = db.get(Enrolment, sid("enrolment", "1"))
    response = client.patch(
        "/api/v1/enrolments/" + e.id,
        json={
            "status": "transferred",
            "reason": "Documented transfer to another institution",
        },
    )
    assert response.status_code == 200, response.text
    assert (
        len(
            db.scalars(
                select(RecordVersion).where(RecordVersion.enrolment_id == e.id)
            ).all()
        )
        == 1
    )
    assert (
        client.get("/api/v1/enrolments/" + e.id + "/history").json()["items"][0][
            "after"
        ]["status"]
        == "transferred"
    )


def test_reports_pdf_csv_and_audit(authenticated):
    client = authenticated("aicte_admin")
    report = client.get("/api/v1/reports/summary")
    assert report.status_code == 200 and report.json()["totals"]["regular_capacity"] > 0
    assert client.get("/api/v1/reports/enrolment.pdf").content.startswith(b"%PDF")
    assert b"institution" in client.get("/api/v1/reports/enrolment.csv").content
    assert client.patch("/api/v1/audit/nonexistent", json={}).status_code in {404, 405}


def test_import_preview_no_persistence_and_scope(authenticated, db):
    from app.models import ImportBatch

    client = authenticated("institution_operator")
    body = (
        b"identity,name,local,admitted\n799999999991,Synthetic Preview,P-1,2025-08-01\n"
    )
    fields = {
        "institution_id": sid("institution", "0"),
        "programme_id": sid("programme", "0:BTECH-CSE"),
        "academic_year": "2025-26",
        "preview": "true",
        "mapping": '{"identity":"apaar_id","name":"full_name","local":"institution_student_id","admitted":"admission_date"}',
    }
    response = client.post(
        "/api/v1/imports",
        data=fields,
        files={"file": ("preview.csv", body, "text/csv")},
    )
    assert response.status_code == 200, response.text
    assert (
        response.json()["counts"]["accepted"] == 1
        and db.scalars(select(ImportBatch)).all() == []
    )
    fields["programme_id"] = sid("programme", "1:BTECH-CSE")
    assert (
        client.post(
            "/api/v1/imports",
            data=fields,
            files={"file": ("preview.csv", body, "text/csv")},
        ).status_code
        == 422
    )
