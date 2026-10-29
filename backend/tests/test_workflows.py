import io
from datetime import datetime, timedelta, timezone
import pandas as pd
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool
from app.database import Base, get_db
from app.main import app
from app.models import ConsentGrant, Credential, Student, User
from app.services.credentials import (
    create_disclosure,
    verify_disclosure,
    verify_signature,
)
from app.services.imports import process_import
from app.services.seed import seed_demo, sid
from app.services.validation import capacity_snapshot, valid_apaar_format


@pytest.fixture()
def db():
    engine = create_engine(
        "sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool
    )
    Base.metadata.create_all(engine)
    with Session(engine, expire_on_commit=False) as session:
        seed_demo(session, student_count=150, institution_count=10)
        yield session
    engine.dispose()


def test_seed_idempotency_and_intake(db):
    first = len(db.scalars(select(Student)).all())
    seed_demo(db, student_count=150, institution_count=10)
    assert len(db.scalars(select(Student)).all()) == first
    snapshot = capacity_snapshot(
        db, sid("institution", "0"), sid("programme", "0:BTECH-CSE"), "2025-26"
    )
    assert snapshot["regular_enrolment"] == 135
    assert snapshot["regular_excess"] == 15


@pytest.mark.parametrize(
    "value,expected",
    [
        ("123456789012", True),
        ("12345", False),
        ("", False),
        (None, False),
        ("12345678901x", False),
    ],
)
def test_identifier_structure(value, expected):
    assert valid_apaar_format(value) is expected


def test_signature_tampering_and_consent_revocation(db):
    credential = db.scalar(select(Credential))
    assert verify_signature(credential)
    original = credential.payload
    credential.payload = {**original, "notice": "tampered"}
    assert not verify_signature(credential)
    credential.payload = original
    consent = ConsentGrant(
        student_id=credential.student_id,
        credential_id=credential.id,
        verifier_name="Test Employer",
        fields=["programme"],
        purpose="Test eligibility",
        expires_at=datetime.now(timezone.utc) + timedelta(hours=1),
    )
    db.add(consent)
    db.flush()
    token = create_disclosure(db, consent)
    db.commit()
    result = verify_disclosure(db, token)
    assert result["valid"]
    assert set(result["disclosed_fields"]) == {"programme"}
    consent.revoked_at = datetime.now(timezone.utc)
    db.commit()
    result = verify_disclosure(db, token)
    assert not result["valid"] and result["disclosed_fields"] == {}


@pytest.mark.parametrize("extension", ["csv", "xlsx"])
def test_partial_import_and_idempotency(db, extension):
    frame = pd.DataFrame(
        [
            {
                "apaar_id": "799999999991",
                "full_name": "Fictional Import One",
                "institution_student_id": "TEST-1",
                "admission_date": "2025-08-01",
            },
            {
                "apaar_id": "invalid",
                "full_name": "Fictional Invalid",
                "institution_student_id": "TEST-2",
                "admission_date": "2025-08-01",
            },
        ]
    )
    if extension == "csv":
        content = frame.to_csv(index=False).encode()
    else:
        output = io.BytesIO()
        frame.to_excel(output, index=False)
        content = output.getvalue()
    user = db.scalar(select(User).where(User.role == "institution_operator"))
    kwargs = dict(
        db=db,
        content=content,
        filename=f"test.{extension}",
        institution_id=sid("institution", "0"),
        programme_id=sid("programme", "0:BTECH-CSE"),
        academic_year="2025-26",
        user=user,
    )
    result = process_import(**kwargs)
    assert result["counts"]["accepted"] == 1 and result["counts"]["rejected"] == 1
    assert process_import(**kwargs)["idempotent"]


def test_http_auth_csrf_and_scope(db, monkeypatch):
    from app.config import settings

    monkeypatch.setattr(settings, "demo_mode", True)
    app.dependency_overrides[get_db] = lambda: db
    try:
        client = TestClient(app)
        assert client.get("/api/v1/institutions").status_code == 401
        response = client.post(
            "/api/v1/auth/login",
            json={
                "email": "institution.operator@apaarsetu.demo",
                "password": "Demo@26263",
            },
        )
        assert response.status_code == 200, response.text
        assert "HttpOnly" in response.headers["set-cookie"]
        assert (
            client.get("/api/v1/institutions/" + sid("institution", "1")).status_code
            == 403
        )
        assert client.post("/api/v1/anomaly/run").status_code == 403
    finally:
        app.dependency_overrides.clear()
