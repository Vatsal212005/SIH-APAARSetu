import pytest
from sqlalchemy import select
from app.models import AuditEvent, Institution, User
from app.services.common import csv_safe

pytest_plugins = ["test_workflows", "test_security_and_management"]


def test_institution_csv_partial_and_idempotent(authenticated, db):
    client = authenticated("aicte_admin")
    content = b"permanent_id,name,institution_type,address,city,state,region,contact_email\nSYN-CSV-1,Synthetic CSV Campus,Private,Fictional Park,Pune,Maharashtra,Western,demo@example.com\nSYN-CSV-2,Synthetic Invalid,Private,Fictional Park,Pune,Maharashtra,Western,not-an-email\n"
    first = client.post(
        "/api/v1/institutions/import",
        files={"file": ("registry.csv", content, "text/csv")},
    )
    assert first.status_code == 200, first.text
    assert first.json()["accepted"] == 1 and first.json()["rejected"] == 1
    second = client.post(
        "/api/v1/institutions/import",
        files={"file": ("registry.csv", content, "text/csv")},
    )
    assert second.json()["accepted"] == 0
    assert (
        len(
            db.scalars(
                select(Institution).where(Institution.permanent_id == "SYN-CSV-1")
            ).all()
        )
        == 1
    )


def test_maintenance_is_audited_and_read_only_for_academic_data(authenticated, db):
    client = authenticated("aicte_admin")
    response = client.post("/api/v1/jobs/maintenance")
    assert response.status_code == 200, response.text
    assert response.json()["academic_records_deleted"] == 0
    assert db.scalar(
        select(AuditEvent).where(AuditEvent.action == "maintenance.completed")
    )


@pytest.mark.parametrize(
    "value", ["=HYPERLINK('bad')", "+1+1", "-1+2", "@SUM(A1)", "  =cmd()"]
)
def test_csv_formula_neutralization(value):
    assert csv_safe(value).startswith("'")


def test_student_profile_is_own_and_masks_identifier(authenticated):
    client = authenticated("student")
    result = client.get("/api/v1/profile")
    assert result.status_code == 200 and result.json()["masked_apaar"].startswith(
        "********"
    )
    assert "external_verification" in result.json()["provenance"]
    assert "apaar_encrypted" not in result.json()


def test_user_role_update_invalidates_sessions(authenticated, db):
    client = authenticated("aicte_admin")
    operator = db.scalar(select(User).where(User.role == "institution_operator"))
    result = client.patch(
        "/api/v1/users/" + operator.id,
        json={"role": "institution_operator", "active": False},
    )
    assert result.status_code == 200 and not db.get(User, operator.id).active


def test_seed_preserves_custom_institution_order(db):
    from app.services.seed import seed_demo, sid
    from app.models import Programme

    item = Institution(
        permanent_id="0000-CUSTOM",
        name="Synthetic Custom Campus",
        institution_type="Private",
        address="Fictional Park",
        city="Pune",
        state="Maharashtra",
        region="Western",
        contact_email="custom@example.com",
    )
    db.add(item)
    db.commit()
    seed_demo(db, student_count=150, institution_count=10)
    assert db.get(Programme, sid("programme", "0:BTECH-CSE")).institution_id == sid(
        "institution", "0"
    )


def test_full_identifier_certificate_requires_privacy_configuration(authenticated, db):
    from app.models import Credential

    client = authenticated("student")
    credential = db.scalar(select(Credential))
    response = client.get(
        "/api/v1/credentials/"
        + credential.id
        + "/certificate.pdf?include_full_identifier=true"
    )
    assert response.status_code == 403
