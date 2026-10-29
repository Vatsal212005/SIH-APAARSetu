import pytest
from sqlalchemy import select
from app.models import AuditEvent, Enrolment, Finding
from app.services.seed import sid

pytest_plugins = ["test_workflows", "test_security_and_management"]


def test_dashboard_filter_counts_match_persistent_rows(authenticated, db):
    client = authenticated("aicte_admin")
    response = client.get("/api/v1/workspace/overview?academic_year=2025-26")
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["metrics"]["submitted_records"] == len(
        db.scalars(select(Enrolment).where(Enrolment.academic_year == "2025-26")).all()
    )
    selected = client.get(
        "/api/v1/workspace/overview",
        params={
            "academic_year": "2025-26",
            "programme_id": sid("programme", "0:BTECH-CSE"),
        },
    ).json()
    assert selected["metrics"]["regular_capacity"] == 120
    assert selected["metrics"]["regular_enrolment"] == 135
    assert selected["metrics"]["regular_excess"] == 15
    assert (
        client.get("/api/v1/workspace/overview?state=Unknown").json()["metrics"][
            "submitted_records"
        ]
        == 0
    )


@pytest.mark.parametrize(
    "role", ["institution_admin", "institution_operator", "regional_officer"]
)
def test_dashboard_filters_cannot_broaden_scope(authenticated, role):
    client = authenticated(role)
    own = client.get("/api/v1/workspace/overview").json()
    assert own["metrics"]["institutions"] >= 1
    unknown = client.get("/api/v1/workspace/overview?region=Unauthorized").json()
    assert unknown["metrics"]["institutions"] == 0
    assert unknown["work_queue"] == []


@pytest.mark.parametrize("role", ["student", "verifier"])
@pytest.mark.parametrize(
    "path", ["overview", "institutions", "students", "enrolments", "audit"]
)
def test_workspace_staff_projections_reject_private_portals(authenticated, role, path):
    assert authenticated(role).get("/api/v1/workspace/" + path).status_code == 403


def test_student_case_and_finding_comparison_remain_scoped(authenticated, db):
    client = authenticated("institution_admin")
    own = client.get("/api/v1/workspace/students/" + sid("student", "0"))
    assert own.status_code == 200, own.text
    assert own.json()["identity"]["masked_apaar"].startswith("********")
    assert all(
        e["institution_id"] == sid("institution", "0") for e in own.json()["enrolments"]
    )
    denied = client.get(
        "/api/v1/workspace/findings/" + sid("finding", "cross-conflict")
    )
    assert denied.status_code == 404
    central = authenticated("aicte_admin")
    result = central.get(
        "/api/v1/workspace/findings/" + sid("finding", "cross-conflict")
    ).json()
    assert len({e["institution_id"] for e in result["records"]}) == 2


def test_self_assignment_is_real_authorized_and_audited(authenticated, db):
    finding = db.scalar(select(Finding))
    before = finding.review_state
    assert (
        authenticated("institution_operator")
        .post(f"/api/v1/workspace/findings/{finding.id}/assign")
        .status_code
        == 403
    )
    result = authenticated("aicte_admin").post(
        f"/api/v1/workspace/findings/{finding.id}/assign"
    )
    assert result.status_code == 200, result.text
    assert db.get(Finding, finding.id).assigned_to
    assert db.get(Finding, finding.id).review_state == before
    assert db.scalar(
        select(AuditEvent).where(
            AuditEvent.action == "finding.assigned", AuditEvent.entity_id == finding.id
        )
    )


def test_registry_pagination_and_audit_filters(authenticated):
    client = authenticated("aicte_admin")
    result = client.get("/api/v1/workspace/students?page=2").json()
    assert len(result["items"]) <= 50 and result["page"] == 2
    assert (
        client.get("/api/v1/workspace/audit?q=event-that-never-happened").json()[
            "total"
        ]
        == 0
    )
    assert client.get("/api/v1/workspace/audit?start=not-a-date").status_code == 422


@pytest.mark.parametrize(
    "kind", ["enrolments", "submissions", "compliance", "verification", "audit"]
)
def test_institution_case_sections_are_scoped_and_paginated(authenticated, kind):
    client = authenticated("institution_admin")
    result = client.get(
        f"/api/v1/workspace/institutions/{sid('institution', '0')}/activity?kind={kind}"
    )
    assert result.status_code == 200, result.text
    assert len(result.json()["items"]) <= 50
    assert (
        client.get(
            f"/api/v1/workspace/institutions/{sid('institution', '1')}/activity?kind={kind}"
        ).status_code
        == 404
    )


def test_operator_cannot_obtain_case_file_audit(authenticated):
    assert (
        authenticated("institution_operator")
        .get(
            f"/api/v1/workspace/institutions/{sid('institution', '0')}/activity?kind=audit"
        )
        .status_code
        == 403
    )


def test_intake_case_lists_real_paged_cohort_without_mutating_records(
    authenticated, db
):
    finding = db.scalar(
        select(Finding).where(Finding.finding_type == "intake_exceeded")
    )
    client = authenticated("aicte_admin")
    response = client.get(f"/api/v1/workspace/findings/{finding.id}?page=1")
    assert response.status_code == 200, response.text
    body = response.json()
    total = len(
        db.scalars(
            select(Enrolment).where(
                Enrolment.programme_id == finding.programme_id,
                Enrolment.academic_year == finding.academic_year,
            )
        ).all()
    )
    assert body["cohort_total"] == total
    assert len(body["records"]) == min(50, total)
    assert all(e["masked_apaar"].startswith("********") for e in body["records"])
