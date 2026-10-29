import pytest
from sqlalchemy import select
from app.models import ApprovedIntake, CapacityPolicy
from app.services.reporting import CATALOG
from app.services.validation import validate_student_row
from app.services.seed import sid

pytest_plugins = ["test_workflows", "test_security_and_management"]


@pytest.mark.parametrize("kind", list(CATALOG))
def test_report_catalog_is_authorized_and_exportable(authenticated, kind):
    client = authenticated("institution_admin")
    response = client.get("/api/v1/reports/analysis", params={"kind": kind})
    assert response.status_code == 200, response.text
    assert isinstance(response.json()["items"], list)
    csv = client.get("/api/v1/reports/analysis", params={"kind": kind, "format": "csv"})
    assert csv.status_code == 200 and "text/csv" in csv.headers["content-type"]


def test_explicit_concurrent_policy_allows_overlap(db):
    programme = sid("programme", "2:BTECH-CSE")
    intake = db.scalar(
        select(ApprovedIntake).where(
            ApprovedIntake.programme_id == programme,
            ApprovedIntake.academic_year == "2025-26",
        )
    )
    policy = db.get(CapacityPolicy, intake.policy_id)
    data = {
        "apaar_id": "700000000000",
        "full_name": "Aarav Synthetic Student 0001",
        "institution_student_id": "CONCURRENT-1",
        "programme_id": programme,
    }
    assert any(
        "cross-institution" in flag
        for flag in validate_student_row(
            db, data, sid("institution", "2"), "2025-26"
        ).flags
    )
    policy.rules = {**policy.rules, "allow_concurrent_enrolment": True}
    db.flush()
    assert not any(
        "cross-institution" in flag
        for flag in validate_student_row(
            db, data, sid("institution", "2"), "2025-26"
        ).flags
    )
