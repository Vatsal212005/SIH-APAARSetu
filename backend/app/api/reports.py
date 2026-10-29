from __future__ import annotations

import csv
import io
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from datetime import date
from ..services.reporting import CATALOG, analysis
from ..services.common import csv_safe
from fastapi.responses import Response, StreamingResponse
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle
from reportlab.lib import colors
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import ApprovedIntake, Enrolment, Institution, Programme, User
from ..security import current_user


router = APIRouter(prefix="/reports", tags=["reports"])


@router.get("/catalog")
def catalog(user: User = Depends(current_user)):
    return {"items": [{"id": key, "title": value} for key, value in CATALOG.items()]}


@router.get("/analysis")
def activity_report(
    kind: str,
    academic_year: str = "2025-26",
    institution_id: str | None = None,
    state: str | None = None,
    region: str | None = None,
    start: date | None = None,
    end: date | None = None,
    format: str = "json",
    db: Session = Depends(get_db),
    user: User = Depends(current_user),
):
    if kind not in CATALOG:
        raise HTTPException(422, "Unknown report")
    rows = analysis(
        db, user, kind, academic_year, institution_id, state, region, start, end
    )
    if format == "csv":
        stream = io.StringIO()
        writer = csv.DictWriter(
            stream, fieldnames=list(rows[0]) if rows else ["group", "count"]
        )
        writer.writeheader()
        writer.writerows(
            [{key: csv_safe(value) for key, value in row.items()} for row in rows]
        )
        return Response(
            stream.getvalue(),
            media_type="text/csv",
            headers={"Content-Disposition": f"attachment; filename={kind}.csv"},
        )
    if format == "pdf":
        stream = io.BytesIO()
        styles = getSampleStyleSheet()
        doc = SimpleDocTemplate(stream, pagesize=A4)
        content = [
            Paragraph(CATALOG[kind], styles["Title"]),
            Paragraph(
                f"Synthetic demonstration. Academic year {academic_year}.",
                styles["BodyText"],
            ),
            Spacer(1, 12),
        ]
        for row in rows:
            content.extend(
                [
                    Paragraph(
                        "; ".join(f"{key}: {value}" for key, value in row.items())
                        .replace("&", "&amp;")
                        .replace("<", "&lt;"),
                        styles["BodyText"],
                    ),
                    Spacer(1, 8),
                ]
            )
        doc.build(content)
        return Response(
            stream.getvalue(),
            media_type="application/pdf",
            headers={"Content-Disposition": f"attachment; filename={kind}.pdf"},
        )
    return {
        "title": CATALOG[kind],
        "academic_year": academic_year,
        "items": rows,
        "synthetic": True,
    }


def report_rows(db: Session, user: User, academic_year: str) -> list[dict]:
    from ..services.validation import capacity_snapshot

    query = (
        select(ApprovedIntake, Programme, Institution)
        .join(Programme, ApprovedIntake.programme_id == Programme.id)
        .join(Institution, ApprovedIntake.institution_id == Institution.id)
        .where(ApprovedIntake.academic_year == academic_year)
    )
    if user.role.startswith("institution_"):
        query = query.where(Institution.id == user.institution_id)
    elif user.role == "regional_officer":
        query = query.where(Institution.region == user.region)
    rows = []
    for intake, programme, institution in db.execute(query).all():
        snapshot = capacity_snapshot(db, institution.id, programme.id, academic_year)
        records = db.scalars(
            select(Enrolment).where(
                Enrolment.programme_id == programme.id,
                Enrolment.academic_year == academic_year,
                Enrolment.status.in_(snapshot["counted_statuses"]),
            )
        ).all()
        rows.append(
            {
                "institution": institution.name,
                "state": institution.state,
                "region": institution.region,
                "programme": f"{programme.name} - {programme.specialization}",
                "regular_capacity": snapshot["regular_capacity"],
                "supernumerary_capacity": snapshot["supernumerary_capacity"],
                "regular_enrolment": snapshot["regular_enrolment"],
                "supernumerary_enrolment": snapshot["supernumerary_enrolment"],
                "nri": sum(e.nri_category for e in records),
                "oci": sum(e.oci_status for e in records),
                "foreign_national": sum(e.foreign_national for e in records),
                "regular_excess": snapshot["regular_excess"],
            }
        )
    return rows


@router.get("/summary")
def summary(
    academic_year: str = "2025-26",
    db: Session = Depends(get_db),
    user: User = Depends(current_user),
) -> dict:
    rows = report_rows(db, user, academic_year)
    return {
        "academic_year": academic_year,
        "synthetic": True,
        "items": rows,
        "totals": {
            key: sum(item[key] for item in rows)
            for key in (
                "regular_capacity",
                "supernumerary_capacity",
                "regular_enrolment",
                "supernumerary_enrolment",
                "nri",
                "oci",
                "foreign_national",
                "regular_excess",
            )
        },
    }


@router.get("/enrolment.csv")
def csv_export(
    academic_year: str = "2025-26",
    db: Session = Depends(get_db),
    user: User = Depends(current_user),
):
    rows = report_rows(db, user, academic_year)
    output = io.StringIO()
    fields = (
        list(rows[0].keys())
        if rows
        else ["institution", "programme", "regular_capacity", "regular_enrolment"]
    )
    writer = csv.DictWriter(output, fieldnames=fields)
    writer.writeheader()
    writer.writerows(
        [{key: csv_safe(value) for key, value in row.items()} for row in rows]
    )
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={
            "Content-Disposition": f"attachment; filename=apaarsetu-enrolment-{academic_year}.csv"
        },
    )


@router.get("/enrolment.pdf")
def pdf_export(
    academic_year: str = "2025-26",
    db: Session = Depends(get_db),
    user: User = Depends(current_user),
):
    rows = report_rows(db, user, academic_year)
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4)
    styles = getSampleStyleSheet()
    data = [["Institution", "Programme", "Capacity", "Enrolled", "Excess"]]
    data.extend(
        [
            [
                r["institution"][-35:],
                r["programme"][:30],
                r["regular_capacity"],
                r["regular_enrolment"],
                r["regular_excess"],
            ]
            for r in rows
        ]
    )
    table = Table(data, repeatRows=1, colWidths=[150, 170, 55, 55, 45])
    table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#0f2744")),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                ("GRID", (0, 0), (-1, -1), 0.25, colors.grey),
                ("FONTSIZE", (0, 0), (-1, -1), 7),
            ]
        )
    )
    doc.build(
        [
            Paragraph(
                "APAARSetu — Synthetic Enrolment Compliance Report", styles["Title"]
            ),
            Paragraph(
                f"Academic year {academic_year}. Generated {datetime.now(timezone.utc).isoformat()}. Demonstration data only.",
                styles["BodyText"],
            ),
            Spacer(1, 10),
            table,
        ]
    )
    return Response(
        buffer.getvalue(),
        media_type="application/pdf",
        headers={
            "Content-Disposition": f"attachment; filename=apaarsetu-enrolment-{academic_year}.pdf"
        },
    )
