from __future__ import annotations

import hashlib
import io
import json
import zipfile
from datetime import date

import pandas as pd
from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from ..models import (
    ApprovedIntake,
    Enrolment,
    Finding,
    ImportBatch,
    ImportRow,
    Programme,
    Student,
    User,
)
from ..security import encrypt_identifier, opaque_hash
from .common import audit, notify
from .validation import parse_date, refresh_intake_finding, validate_student_row


SUPPORTED_COLUMNS = {
    "apaar_id",
    "full_name",
    "date_of_birth",
    "institution_student_id",
    "admission_date",
    "seat_type",
    "nri_category",
    "oci_status",
    "foreign_national",
}


def _truthy(value: object) -> bool:
    return str(value).strip().lower() in {"1", "true", "yes", "y"}


def process_import(
    db: Session,
    content: bytes,
    filename: str,
    institution_id: str,
    programme_id: str,
    academic_year: str,
    user: User,
    mapping: dict | None = None,
    preview: bool = False,
) -> dict:
    programme = db.get(Programme, programme_id)
    if not programme or programme.institution_id != institution_id:
        raise HTTPException(
            status_code=422, detail="Programme does not belong to selected institution"
        )
    if not db.scalar(
        select(ApprovedIntake).where(
            ApprovedIntake.programme_id == programme_id,
            ApprovedIntake.academic_year == academic_year,
        )
    ):
        raise HTTPException(
            status_code=422,
            detail="No centrally approved intake for selected programme/year",
        )
    digest = hashlib.sha256(
        content
        + f"{institution_id}:{programme_id}:{academic_year}:".encode()
        + json.dumps(mapping or {}, sort_keys=True).encode()
    ).hexdigest()
    existing = db.scalar(select(ImportBatch).where(ImportBatch.content_hash == digest))
    if existing and not preview:
        return {
            "idempotent": True,
            "batch_id": existing.id,
            "status": existing.status,
            "counts": _counts(existing),
            "rows": [],
        }
    suffix = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
    try:
        if suffix == "csv":
            frame = pd.read_csv(io.BytesIO(content), dtype=str).fillna("")
        elif suffix == "xlsx":
            archive = zipfile.ZipFile(io.BytesIO(content))
            if sum(i.file_size for i in archive.infolist()) > 50 * 1024 * 1024:
                raise HTTPException(413, "Expanded workbook exceeds 50 MB")
            frame = pd.read_excel(
                io.BytesIO(content), dtype=str, engine="openpyxl"
            ).fillna("")
        else:
            raise HTTPException(
                status_code=415, detail="Only CSV and XLSX files are supported"
            )
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(
            status_code=422, detail=f"Unable to parse upload: {exc}"
        ) from exc
    if len(frame) > 10000:
        raise HTTPException(
            status_code=413, detail="Demonstration import limit is 10,000 rows"
        )
    columns = list(frame.columns)
    if mapping:
        frame = frame.rename(columns=mapping)
    missing = {
        "apaar_id",
        "full_name",
        "institution_student_id",
        "admission_date",
    } - set(frame.columns)
    if preview and missing:
        return {
            "columns": columns,
            "missing_columns": sorted(missing),
            "rows": [],
            "counts": {},
            "preview": True,
        }
    if missing:
        raise HTTPException(
            status_code=422,
            detail=f"Missing required columns: {', '.join(sorted(missing))}",
        )
    if preview:
        seen = set()
        rows = []
        counts = {"accepted": 0, "rejected": 0, "flagged": 0, "duplicates": 0}
        for index, series in frame.iterrows():
            data = series.to_dict()
            result = validate_student_row(db, data, institution_id, academic_year)
            apaar = str(data.get("apaar_id", "")).strip()
            if apaar in seen:
                result.errors.append(
                    "Duplicate APAAR-like identifier within this batch"
                )
                counts["duplicates"] += 1
            seen.add(apaar)
            if not parse_date(data.get("admission_date")):
                result.errors.append("Admission date is invalid; use YYYY-MM-DD")
            status = (
                "rejected"
                if result.errors
                else ("flagged" if result.flags else "accepted")
            )
            counts["rejected" if status == "rejected" else "accepted"] += 1
            if status == "flagged":
                counts["flagged"] += 1
            data["apaar_id"] = "********" + apaar[-4:] if apaar else "Not provided"
            if len(rows) < 200:
                rows.append(
                    {
                        "row_number": index + 2,
                        "data": data,
                        "result": status,
                        "errors": result.errors + result.flags,
                    }
                )
        return {
            "columns": columns,
            "missing_columns": [],
            "rows": rows,
            "counts": counts,
            "preview": True,
            "total_rows": len(frame),
        }
    batch = ImportBatch(
        institution_id=institution_id,
        programme_id=programme_id,
        academic_year=academic_year,
        filename=filename[:220],
        content_hash=digest,
        created_by=user.id,
    )
    db.add(batch)
    db.flush()
    seen_apaar: set[str] = set()
    output_rows: list[dict] = []
    for index, series in frame.iterrows():
        raw = {
            key: str(value)
            for key, value in series.to_dict().items()
            if key in SUPPORTED_COLUMNS
        }
        outcome = validate_student_row(db, raw, institution_id, academic_year)
        # Include programme context for configurable concurrent-enrolment treatment.
        if programme_id:
            outcome = validate_student_row(
                db, {**raw, "programme_id": programme_id}, institution_id, academic_year
            )
        apaar = raw.get("apaar_id", "").strip()
        if apaar in seen_apaar and apaar:
            outcome.result = "rejected"
            outcome.errors.append("Duplicate APAAR-like identifier within this batch")
            batch.duplicate_count += 1
        seen_apaar.add(apaar)
        admission_date = parse_date(raw.get("admission_date"))
        dob = parse_date(raw.get("date_of_birth"))
        if not admission_date:
            outcome.result = "rejected"
            outcome.errors.append("Admission date is invalid; use YYYY-MM-DD")
        if raw.get("date_of_birth") and not dob:
            outcome.result = "rejected"
            outcome.errors.append("Invalid date of birth")
        enrolment_id = None
        if outcome.result != "rejected":
            student = (
                db.scalar(
                    select(Student).where(Student.apaar_lookup == opaque_hash(apaar))
                )
                if apaar
                else None
            )
            if not student:
                student = Student(
                    apaar_encrypted=encrypt_identifier(apaar) if apaar else None,
                    apaar_lookup=opaque_hash(apaar) if apaar else None,
                    apaar_last4=apaar[-4:] if apaar else None,
                    full_name=raw["full_name"].strip(),
                    date_of_birth=dob,
                    verification_status="discrepancy_flagged"
                    if outcome.flags
                    else "format_validated",
                    provenance={
                        "format_validation": bool(apaar),
                        "institution_attested": True,
                        "external_verification": "unavailable_demo_mode",
                    },
                )
                db.add(student)
                db.flush()
            enrolment = Enrolment(
                student_id=student.id,
                institution_id=institution_id,
                programme_id=programme_id,
                academic_year=academic_year,
                institution_student_id=raw["institution_student_id"].strip(),
                admission_date=admission_date or date.today(),
                status="flagged" if outcome.flags else "accepted",
                seat_type=(raw.get("seat_type") or "regular").lower(),
                nri_category=_truthy(raw.get("nri_category")),
                oci_status=_truthy(raw.get("oci_status")),
                foreign_national=_truthy(raw.get("foreign_national")),
                attested=True,
            )
            try:
                with db.begin_nested():
                    db.add(enrolment)
                    db.flush()
                enrolment_id = enrolment.id
                if outcome.flags:
                    db.add(
                        Finding(
                            institution_id=institution_id,
                            programme_id=programme_id,
                            academic_year=academic_year,
                            finding_type="cross_institution_conflict"
                            if any("cross-institution" in f for f in outcome.flags)
                            else "identity_inconsistency",
                            source="deterministic",
                            severity="high",
                            title="Submitted identity/enrolment requires review",
                            explanation="; ".join(outcome.flags),
                            evidence={
                                "student_id": student.id,
                                "enrolment_id": enrolment.id,
                                "submitted_name": raw["full_name"],
                                "existing_name": student.full_name,
                                "rules": outcome.flags,
                            },
                        )
                    )
                batch.accepted_count += 1
                if outcome.flags:
                    batch.flagged_count += 1
            except IntegrityError:
                outcome.result = "rejected"
                outcome.errors.append(
                    "Duplicate institution student ID for this academic year"
                )
                batch.rejected_count += 1
        else:
            batch.rejected_count += 1
        row = ImportRow(
            batch_id=batch.id,
            row_number=index + 2,
            raw_data={
                key: ("********" + value[-4:] if key == "apaar_id" else value)
                for key, value in raw.items()
            },
            result=outcome.result,
            errors=outcome.errors + outcome.flags,
            enrolment_id=enrolment_id,
        )
        db.add(row)
        if len(output_rows) < 200:
            output_rows.append(
                {
                    "row_number": index + 2,
                    "data": row.raw_data,
                    "result": row.result,
                    "errors": row.errors,
                }
            )
    refresh_intake_finding(db, institution_id, programme_id, academic_year)
    audit(
        db,
        "import.processed",
        "import_batch",
        batch.id,
        user,
        institution_id,
        _counts(batch),
    )
    notify(
        db,
        "Student import processed",
        f"{batch.accepted_count} accepted, {batch.rejected_count} rejected and {batch.flagged_count} flagged.",
        "warning" if batch.rejected_count else "success",
        institution_id=institution_id,
        deep_link="/imports",
        dedupe_key=f"import:{digest}",
    )
    db.commit()
    return {
        "idempotent": False,
        "batch_id": batch.id,
        "status": batch.status,
        "counts": _counts(batch),
        "rows": output_rows,
    }


def _counts(batch: ImportBatch) -> dict:
    return {
        "accepted": batch.accepted_count,
        "rejected": batch.rejected_count,
        "flagged": batch.flagged_count,
        "duplicates": batch.duplicate_count,
    }
