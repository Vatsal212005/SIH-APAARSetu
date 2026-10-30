from collections import Counter
from datetime import datetime, timezone
from sqlalchemy import select
from ..models import (
    ApprovedIntake,
    ConsentGrant,
    CorrectionRequest,
    Credential,
    Enrolment,
    Finding,
    ImportBatch,
    ImportRow,
    Institution,
    Programme,
    VerificationEvent,
)
from .validation import capacity_snapshots

CATALOG = {
    "institution-enrolment": "Institution-wise enrolment",
    "programme-intake": "Programme intake versus admissions",
    "year-trends": "Academic-year trends",
    "region-enrolment": "Region enrolment",
    "state-enrolment": "State enrolment",
    "supernumerary": "Supernumerary utilization",
    "nri-admissions": "NRI admission category",
    "oci-fn-status": "OCI and Foreign National status",
    "identity-errors": "Invalid and missing identifier rows",
    "duplicate-submissions": "Duplicate submission rows",
    "cross-conflicts": "Cross-institution conflict findings",
    "intake-discrepancies": "Intake excess findings",
    "pending-reviews": "Pending regulatory reviews",
    "submission-compliance": "Institution submission compliance",
    "correction-history": "Correction request history",
    "credential-activity": "Credential issuance and verification",
    "consent-activity": "Consent and revocation activity",
    "operational-period": "Operational submissions by month",
}


def analysis(
    db,
    user,
    kind,
    year,
    institution_id=None,
    state=None,
    region=None,
    start=None,
    end=None,
):
    institutions = db.scalars(select(Institution)).all()
    if user.role.startswith("institution_"):
        institutions = [i for i in institutions if i.id == user.institution_id]
    if user.role == "regional_officer":
        institutions = [i for i in institutions if i.region == user.region]
    institutions = [
        i
        for i in institutions
        if (not institution_id or i.id == institution_id)
        and (not state or i.state == state)
        and (not region or i.region == region)
    ]
    ids = {i.id for i in institutions}
    names = {i.id: i.name for i in institutions}
    regions = {i.id: i.region for i in institutions}
    states = {i.id: i.state for i in institutions}

    def in_period(item):
        created = getattr(item, "created_at", None) or getattr(item, "issued_at", None)
        return not created or (
            (not start or created.date() >= start)
            and (not end or created.date() <= end)
        )

    enrolments = [
        e
        for e in db.scalars(
            select(Enrolment).where(Enrolment.institution_id.in_(ids))
        ).all()
        if (kind == "year-trends" or e.academic_year == year) and in_period(e)
    ]
    if (
        kind == "programme-intake"
        or kind == "supernumerary"
        or kind == "intake-discrepancies"
    ):
        rows = []
        intake_rows = db.scalars(
            select(ApprovedIntake).where(
                ApprovedIntake.institution_id.in_(ids),
                ApprovedIntake.academic_year == year,
            )
        ).all()
        snapshots = capacity_snapshots(db, intake_rows)
        programme_names = dict(
            db.execute(
                select(Programme.id, Programme.specialization).where(
                    Programme.id.in_({i.programme_id for i in intake_rows})
                )
            ).all()
        )
        for intake in intake_rows:
            snapshot = snapshots[intake.id]
            if kind == "intake-discrepancies" and not snapshot["regular_excess"]:
                continue
            rows.append(
                {
                    "institution": names[intake.institution_id],
                    "programme": programme_names[intake.programme_id],
                    "capacity": snapshot[
                        "supernumerary_capacity"
                        if kind == "supernumerary"
                        else "regular_capacity"
                    ],
                    "counted": snapshot[
                        "supernumerary_enrolment"
                        if kind == "supernumerary"
                        else "regular_enrolment"
                    ],
                    "excess": snapshot[
                        "supernumerary_excess"
                        if kind == "supernumerary"
                        else "regular_excess"
                    ],
                }
            )
        return rows
    counts = Counter()
    if kind in {
        "institution-enrolment",
        "region-enrolment",
        "state-enrolment",
        "year-trends",
        "nri-admissions",
        "oci-fn-status",
    }:
        for e in enrolments:
            key = {
                "institution-enrolment": names[e.institution_id],
                "region-enrolment": regions[e.institution_id],
                "state-enrolment": states[e.institution_id],
                "year-trends": e.academic_year,
            }.get(kind, names[e.institution_id])
            if kind == "nri-admissions":
                if e.nri_category:
                    counts[key] += 1
            elif kind == "oci-fn-status":
                if e.oci_status:
                    counts["OCI status"] += 1
                if e.foreign_national:
                    counts["Foreign National status"] += 1
            else:
                counts[key] += 1
    elif kind in {"identity-errors", "duplicate-submissions"}:
        batch_ids = select(ImportBatch.id).where(
            ImportBatch.institution_id.in_(ids), ImportBatch.academic_year == year
        )
        for row in db.scalars(
            select(ImportRow).where(ImportRow.batch_id.in_(batch_ids))
        ).all():
            for error in row.errors:
                if (kind == "identity-errors" and "identifier" in error.lower()) or (
                    kind == "duplicate-submissions" and "duplicate" in error.lower()
                ):
                    counts[error] += 1
    elif kind in {"cross-conflicts", "pending-reviews"}:
        for finding in db.scalars(
            select(Finding).where(
                Finding.institution_id.in_(ids), Finding.academic_year == year
            )
        ).all():
            if (
                kind == "cross-conflicts"
                and finding.finding_type == "cross_institution_conflict"
            ):
                counts[finding.review_state] += 1
            elif kind == "pending-reviews" and finding.review_state in {
                "open",
                "request_clarification",
                "confirm_discrepancy",
            }:
                counts[finding.finding_type] += 1
    elif kind in {"submission-compliance", "operational-period"}:
        for batch in db.scalars(
            select(ImportBatch).where(
                ImportBatch.institution_id.in_(ids), ImportBatch.academic_year == year
            )
        ).all():
            if in_period(batch):
                counts[
                    names[batch.institution_id]
                    if kind == "submission-compliance"
                    else batch.created_at.strftime("%Y-%m")
                ] += 1
        if kind == "submission-compliance":
            for name in names.values():
                counts.setdefault(name, 0)
    elif kind == "correction-history":
        enrolment_ids = {e.id for e in enrolments}
        for c in db.scalars(
            select(CorrectionRequest).where(
                CorrectionRequest.enrolment_id.in_(enrolment_ids)
            )
        ).all():
            if in_period(c):
                counts[c.status] += 1
    elif kind in {"credential-activity", "consent-activity"}:
        credentials = [
            c
            for c in db.scalars(
                select(Credential).where(Credential.issuer_institution_id.in_(ids))
            ).all()
            if c.payload["academic_record"]["academic_year"] == year
        ]
        credential_ids = {c.id for c in credentials}
        if kind == "credential-activity":
            for c in credentials:
                if in_period(c):
                    counts[
                        "Revoked credentials" if c.revoked_at else "Issued credentials"
                    ] += 1
            for event in db.scalars(
                select(VerificationEvent).where(
                    VerificationEvent.credential_id.in_(credential_ids)
                )
            ).all():
                if in_period(event):
                    counts["Verification " + event.outcome] += 1
        else:
            now = datetime.now(timezone.utc)
            for c in db.scalars(
                select(ConsentGrant).where(
                    ConsentGrant.credential_id.in_(credential_ids)
                )
            ).all():
                expiry = (
                    c.expires_at
                    if c.expires_at.tzinfo
                    else c.expires_at.replace(tzinfo=timezone.utc)
                )
                if in_period(c):
                    counts[
                        "revoked"
                        if c.revoked_at
                        else "expired"
                        if expiry <= now
                        else "active"
                    ] += 1
    return [{"group": key, "count": value} for key, value in sorted(counts.items())]
