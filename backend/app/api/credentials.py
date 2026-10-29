from __future__ import annotations

from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import Response
import io
import qrcode
from sqlalchemy import desc, select
from sqlalchemy.orm import Session

from ..config import settings
from ..database import get_db
from ..models import (
    ConsentGrant,
    Credential,
    Enrolment,
    Institution,
    Student,
    Role,
    User,
    VerificationEvent,
)
from ..schemas import ConsentCreate, CredentialIssue
from ..security import (
    current_user,
    enforce_institution_scope,
    require_roles,
    decrypt_identifier,
)
from ..services.common import audit, notify, notify_student
from ..services.credentials import (
    create_disclosure,
    credential_pdf,
    issue_credential,
    public_key_pem,
    verify_disclosure,
    verify_signature,
)


router = APIRouter(tags=["credentials"])
ALLOWED_FIELDS = {
    "student_name",
    "institution",
    "programme",
    "specialization",
    "academic_year",
    "enrolment_status",
    "institution_student_id",
    "apaar_masked",
}


@router.get("/credentials")
def list_credentials(
    db: Session = Depends(get_db), user: User = Depends(current_user)
) -> dict:
    if user.role == Role.verifier.value:
        raise HTTPException(
            status_code=403, detail="Use a student-authorized disclosure reference"
        )
    query = select(Credential).order_by(desc(Credential.issued_at))
    if user.role == Role.student.value:
        query = query.where(Credential.student_id == user.student_id)
    elif user.role in {Role.institution_admin.value, Role.institution_operator.value}:
        query = query.where(Credential.issuer_institution_id == user.institution_id)
    elif user.role == "regional_officer":
        query = query.where(
            Credential.issuer_institution_id.in_(
                select(Institution.id).where(Institution.region == user.region)
            )
        )
    rows = db.scalars(query.limit(250)).all()
    return {"items": [_credential_view(item) for item in rows]}


@router.post("/credentials/issue")
def issue(
    payload: CredentialIssue,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(Role.institution_admin, Role.aicte_admin)),
):
    enrolment = db.get(Enrolment, payload.enrolment_id)
    if not enrolment:
        raise HTTPException(status_code=404, detail="Enrolment not found")
    enforce_institution_scope(user, enrolment.institution_id)
    if (
        enrolment.status not in {"accepted", "enrolled", "completed"}
        or not enrolment.attested
    ):
        raise HTTPException(
            status_code=422,
            detail="Only accepted, enrolled or completed institution-attested records may be credentialed",
        )
    credential = issue_credential(db, enrolment, payload.expires_in_days)
    notify_student(
        db,
        enrolment.student_id,
        "Academic credential issued",
        f"Credential {credential.credential_code} is available in your wallet.",
    )
    audit(
        db,
        "credential.issued",
        "credential",
        credential.id,
        user,
        enrolment.institution_id,
    )
    notify(
        db,
        "Academic credential issued",
        f"Credential {credential.credential_code} is available.",
        "success",
        institution_id=enrolment.institution_id,
        deep_link="/credentials",
    )
    db.commit()
    return _credential_view(credential)


@router.post("/credentials/{credential_id}/revoke")
def revoke_credential(
    credential_id: str,
    reason: str = Query(min_length=8),
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(Role.institution_admin, Role.aicte_admin)),
):
    credential = db.get(Credential, credential_id)
    if not credential:
        raise HTTPException(status_code=404, detail="Credential not found")
    enforce_institution_scope(user, credential.issuer_institution_id)
    credential.revoked_at = datetime.now(timezone.utc)
    credential.revocation_reason = reason
    notify_student(
        db,
        credential.student_id,
        "Academic credential revoked",
        "An issuer revoked your demonstration credential. Existing disclosure checks now reflect revocation.",
    )
    audit(
        db,
        "credential.revoked",
        "credential",
        credential.id,
        user,
        credential.issuer_institution_id,
        {"reason": reason},
    )
    db.commit()
    return {"id": credential.id, "revoked": True}


@router.post("/consents")
def grant_consent(
    payload: ConsentCreate,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(Role.student)),
):
    credential = db.get(Credential, payload.credential_id)
    if not credential or credential.student_id != user.student_id:
        raise HTTPException(status_code=404, detail="Credential not found")
    state = _credential_view(credential)
    if state["revoked"] or state["expired"] or not state["signature_valid"]:
        raise HTTPException(
            422, "Only a current credential with a valid signature may be shared"
        )
    unsupported = set(payload.fields) - ALLOWED_FIELDS
    if unsupported:
        raise HTTPException(
            status_code=422,
            detail=f"Unsupported disclosure fields: {', '.join(sorted(unsupported))}",
        )
    consent = ConsentGrant(
        student_id=user.student_id,
        credential_id=credential.id,
        verifier_name=payload.verifier_name,
        fields=sorted(set(payload.fields)),
        purpose=payload.purpose,
        expires_at=datetime.now(timezone.utc)
        + timedelta(hours=payload.expires_in_hours),
    )
    db.add(consent)
    db.flush()
    raw = create_disclosure(db, consent)
    notify_student(
        db,
        consent.student_id,
        "Disclosure consent granted",
        f"Selected academic fields were shared with {payload.verifier_name}.",
    )
    audit(
        db,
        "consent.granted",
        "consent",
        consent.id,
        user,
        metadata={
            "fields": consent.fields,
            "expires_at": consent.expires_at.isoformat(),
        },
    )
    db.commit()
    return {
        "id": consent.id,
        "token": raw,
        "verification_path": f"/verify/{raw}",
        "expires_at": consent.expires_at,
        "fields": consent.fields,
        "notice": "The bearer token is shown once. Only its keyed hash is stored.",
    }


@router.get("/consents")
def list_consents(
    db: Session = Depends(get_db), user: User = Depends(require_roles(Role.student))
):
    rows = db.scalars(
        select(ConsentGrant)
        .where(ConsentGrant.student_id == user.student_id)
        .order_by(desc(ConsentGrant.created_at))
    ).all()
    return {
        "items": [
            {
                "id": item.id,
                "credential_id": item.credential_id,
                "verifier_name": item.verifier_name,
                "purpose": item.purpose,
                "fields": item.fields,
                "expires_at": item.expires_at,
                "revoked_at": item.revoked_at,
                "created_at": item.created_at,
            }
            for item in rows
        ]
    }


@router.post("/consents/{consent_id}/revoke")
def revoke_consent(
    consent_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(Role.student)),
):
    consent = db.get(ConsentGrant, consent_id)
    if not consent or consent.student_id != user.student_id:
        raise HTTPException(status_code=404, detail="Consent not found")
    consent.revoked_at = datetime.now(timezone.utc)
    notify_student(
        db,
        consent.student_id,
        "Disclosure access revoked",
        "Future verification requests using this consent will be denied.",
    )
    audit(db, "consent.revoked", "consent", consent.id, user)
    db.commit()
    return {"id": consent.id, "revoked": True}


@router.get("/verification/{token}")
def public_verify(token: str, db: Session = Depends(get_db)) -> dict:
    return verify_disclosure(db, token)


@router.get("/disclosure-qr/{token}")
def qr_image(token: str):
    if len(token) > 100 or not all(c.isalnum() or c in "-_" for c in token):
        raise HTTPException(422, "Invalid reference")
    buffer = io.BytesIO()
    qrcode.make(f"{settings.frontend_origin}/verify/{token}").save(buffer, format="PNG")
    return Response(
        buffer.getvalue(),
        media_type="image/png",
        headers={"Cache-Control": "no-store", "Referrer-Policy": "no-referrer"},
    )


@router.get("/verification-events")
def verification_events(
    db: Session = Depends(get_db), user: User = Depends(current_user)
) -> dict:
    if user.role == Role.verifier.value:
        raise HTTPException(
            status_code=403, detail="Use a student-authorized disclosure reference"
        )
    query = (
        select(VerificationEvent)
        .join(Credential, VerificationEvent.credential_id == Credential.id)
        .order_by(desc(VerificationEvent.created_at))
    )
    if user.role == Role.student.value:
        query = query.where(Credential.student_id == user.student_id)
    elif user.role.startswith("institution_"):
        query = query.where(Credential.issuer_institution_id == user.institution_id)
    rows = db.scalars(query.limit(250)).all()
    return {
        "items": [
            {
                "id": item.id,
                "credential_id": item.credential_id,
                "verifier_name": item.verifier_name,
                "outcome": item.outcome,
                "details": item.details,
                "created_at": item.created_at,
            }
            for item in rows
        ]
    }


@router.get("/credentials/{credential_id}/certificate.pdf")
def download_certificate(
    credential_id: str,
    disclosure_token: str = "",
    include_full_identifier: bool = False,
    db: Session = Depends(get_db),
    user: User = Depends(current_user),
):
    if user.role == Role.verifier.value:
        raise HTTPException(
            status_code=403, detail="Use a student-authorized disclosure reference"
        )
    credential = db.get(Credential, credential_id)
    if not credential:
        raise HTTPException(status_code=404, detail="Credential not found")
    if user.role == Role.student.value and credential.student_id != user.student_id:
        raise HTTPException(status_code=403, detail="Credential scope violation")
    if user.role.startswith("institution_"):
        enforce_institution_scope(user, credential.issuer_institution_id)
    verification_url = (
        f"{settings.frontend_origin}/verify/{disclosure_token}"
        if disclosure_token
        else f"{settings.frontend_origin}/credentials"
    )
    if user.role == "regional_officer":
        enforce_institution_scope(user, credential.issuer_institution_id, db)
    identifier = None
    if include_full_identifier:
        if not settings.certificate_full_identifier:
            raise HTTPException(
                403, "Full identifier printing is disabled by privacy configuration"
            )
        student = db.get(Student, credential.student_id)
        identifier = (
            decrypt_identifier(student.apaar_encrypted)
            if student and student.apaar_encrypted
            else None
        )
    pdf = credential_pdf(credential, verification_url, identifier)
    return Response(
        content=pdf,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f"attachment; filename={credential.credential_code}.pdf"
        },
    )


@router.get("/credentials/public-key")
def signing_public_key() -> dict:
    return {
        "key_id": "apaarsetu-demo-ed25519-2026-01",
        "algorithm": "Ed25519",
        "public_key_pem": public_key_pem(),
        "trust_scope": "APAARSetu synthetic demonstration issuer only",
    }


def _credential_view(item: Credential) -> dict:
    expires = (
        item.expires_at
        if not item.expires_at or item.expires_at.tzinfo
        else item.expires_at.replace(tzinfo=timezone.utc)
    )
    return {
        "id": item.id,
        "credential_code": item.credential_code,
        "student_id": item.student_id,
        "issuer_institution_id": item.issuer_institution_id,
        "payload": item.payload,
        "key_id": item.key_id,
        "signature_valid": verify_signature(item),
        "signature": item.signature,
        "issued_at": item.issued_at,
        "expires_at": item.expires_at,
        "expired": bool(expires and expires <= datetime.now(timezone.utc)),
        "revoked": item.revoked_at is not None,
        "revocation_reason": item.revocation_reason,
        "official_apaar_verified": False,
    }
