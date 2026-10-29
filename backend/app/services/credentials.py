from __future__ import annotations

import base64
import io
import json
import secrets
from datetime import datetime, timedelta, timezone

import qrcode
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric.ed25519 import (
    Ed25519PrivateKey,
    Ed25519PublicKey,
)
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import (
    Image,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..config import RUNTIME
from ..models import (
    ConsentGrant,
    Credential,
    DisclosureToken,
    Enrolment,
    Institution,
    Programme,
    Student,
    VerificationEvent,
)
from ..security import opaque_hash


KEY_DIR = RUNTIME / "keys"
PRIVATE_KEY_PATH = KEY_DIR / "demo_ed25519_private.pem"
PUBLIC_KEY_PATH = KEY_DIR / "demo_ed25519_public.pem"
KEY_ID = "apaarsetu-demo-ed25519-2026-01"


def _canonical(payload: dict) -> bytes:
    return json.dumps(
        payload, sort_keys=True, separators=(",", ":"), ensure_ascii=False
    ).encode()


def ensure_signing_key() -> tuple[Ed25519PrivateKey, Ed25519PublicKey]:
    KEY_DIR.mkdir(parents=True, exist_ok=True)
    if PRIVATE_KEY_PATH.exists():
        private = serialization.load_pem_private_key(
            PRIVATE_KEY_PATH.read_bytes(), password=None
        )
        if not isinstance(private, Ed25519PrivateKey):
            raise RuntimeError("Configured signing key is not Ed25519")
    else:
        private = Ed25519PrivateKey.generate()
        PRIVATE_KEY_PATH.write_bytes(
            private.private_bytes(
                serialization.Encoding.PEM,
                serialization.PrivateFormat.PKCS8,
                serialization.NoEncryption(),
            )
        )
        PUBLIC_KEY_PATH.write_bytes(
            private.public_key().public_bytes(
                serialization.Encoding.PEM,
                serialization.PublicFormat.SubjectPublicKeyInfo,
            )
        )
    return private, private.public_key()


def issue_credential(
    db: Session, enrolment: Enrolment, expires_days: int = 365
) -> Credential:
    student = db.get(Student, enrolment.student_id)
    institution = db.get(Institution, enrolment.institution_id)
    programme = db.get(Programme, enrolment.programme_id)
    if not student or not institution or not programme:
        raise ValueError("Credential source record is incomplete")
    issued = datetime.now(timezone.utc)
    code = f"AS-{issued:%Y%m}-{secrets.token_hex(5).upper()}"
    payload = {
        "credential_id": code,
        "credential_type": "APAARSetu Demonstration Enrolment Attestation",
        "issuer": {
            "id": institution.id,
            "name": institution.name,
            "trust": "synthetic demonstration institution",
        },
        "subject": {
            "student_id": student.id,
            "name": student.full_name,
            "apaar_masked": student.masked_apaar,
        },
        "academic_record": {
            "institution": institution.name,
            "programme": programme.name,
            "specialization": programme.specialization,
            "academic_year": enrolment.academic_year,
            "enrolment_status": enrolment.status,
            "institution_student_id": enrolment.institution_student_id,
        },
        "verification_provenance": student.provenance,
        "issued_at": issued.isoformat(),
        "expires_at": (issued + timedelta(days=expires_days)).isoformat(),
        "official_apaar_verification": False,
        "notice": "Synthetic demonstration credential. Not government-issued or DigiLocker-issued.",
    }
    private, _ = ensure_signing_key()
    signature = base64.urlsafe_b64encode(private.sign(_canonical(payload))).decode()
    credential = Credential(
        credential_code=code,
        student_id=student.id,
        enrolment_id=enrolment.id,
        issuer_institution_id=institution.id,
        payload=payload,
        signature=signature,
        key_id=KEY_ID,
        issued_at=issued,
        expires_at=issued + timedelta(days=expires_days),
    )
    db.add(credential)
    db.flush()
    return credential


def verify_signature(credential: Credential) -> bool:
    try:
        _, public = ensure_signing_key()
        public.verify(
            base64.urlsafe_b64decode(credential.signature),
            _canonical(credential.payload),
        )
        return True
    except Exception:
        return False


def public_key_pem() -> str:
    _, public = ensure_signing_key()
    return public.public_bytes(
        serialization.Encoding.PEM,
        serialization.PublicFormat.SubjectPublicKeyInfo,
    ).decode()


def create_disclosure(db: Session, consent: ConsentGrant) -> str:
    raw = secrets.token_urlsafe(32)
    db.add(DisclosureToken(consent_id=consent.id, token_hash=opaque_hash(raw)))
    return raw


def verify_disclosure(db: Session, raw_token: str) -> dict:
    token = db.scalar(
        select(DisclosureToken).where(
            DisclosureToken.token_hash == opaque_hash(raw_token)
        )
    )
    if not token:
        return {
            "valid": False,
            "outcome": "invalid_token",
            "message": "Disclosure reference is invalid.",
        }
    consent = db.get(ConsentGrant, token.consent_id)
    credential = db.get(Credential, consent.credential_id) if consent else None
    now = datetime.now(timezone.utc)
    if not consent or not credential:
        return {
            "valid": False,
            "outcome": "record_missing",
            "message": "Disclosure record is unavailable.",
        }
    consent_expiry = (
        consent.expires_at
        if consent.expires_at.tzinfo
        else consent.expires_at.replace(tzinfo=timezone.utc)
    )
    credential_expiry = credential.expires_at
    if credential_expiry and not credential_expiry.tzinfo:
        credential_expiry = credential_expiry.replace(tzinfo=timezone.utc)
    checks = {
        "signature_valid": verify_signature(credential),
        "trusted_demo_issuer": credential.key_id == KEY_ID,
        "consent_active": consent.revoked_at is None and consent_expiry > now,
        "credential_current": credential.revoked_at is None
        and (credential_expiry is None or credential_expiry > now),
        "official_apaar_verified": False,
    }
    valid = all(
        checks[key]
        for key in (
            "signature_valid",
            "trusted_demo_issuer",
            "consent_active",
            "credential_current",
        )
    )
    outcome = "verified" if valid else "denied"
    allowed = {}
    if valid:
        flat = {
            "student_name": credential.payload["subject"]["name"],
            "institution": credential.payload["academic_record"]["institution"],
            "programme": credential.payload["academic_record"]["programme"],
            "specialization": credential.payload["academic_record"]["specialization"],
            "academic_year": credential.payload["academic_record"]["academic_year"],
            "enrolment_status": credential.payload["academic_record"][
                "enrolment_status"
            ],
            "institution_student_id": credential.payload["academic_record"][
                "institution_student_id"
            ],
            "apaar_masked": credential.payload["subject"]["apaar_masked"],
        }
        allowed = {key: flat[key] for key in consent.fields if key in flat}
    db.add(
        VerificationEvent(
            credential_id=credential.id,
            consent_id=consent.id,
            verifier_name=consent.verifier_name,
            outcome=outcome,
            details=checks,
        )
    )
    db.commit()
    return {
        "valid": valid,
        "outcome": outcome,
        "checks": checks,
        "credential_id": credential.credential_code if valid else None,
        "issuer": credential.payload["issuer"] if valid else None,
        "disclosed_fields": allowed,
        "purpose": consent.purpose if valid else None,
        "expires_at": consent.expires_at,
        "notice": "Official APAAR verification unavailable — demonstration mode.",
    }


def credential_pdf(
    credential: Credential, verification_url: str, full_identifier: str | None = None
) -> bytes:
    buffer = io.BytesIO()
    qr_buffer = io.BytesIO()
    qrcode.make(verification_url).save(qr_buffer, format="PNG")
    qr_buffer.seek(0)
    doc = SimpleDocTemplate(
        buffer, pagesize=A4, rightMargin=22 * mm, leftMargin=22 * mm, topMargin=18 * mm
    )
    styles = getSampleStyleSheet()
    record = credential.payload["academic_record"]
    subject = credential.payload["subject"]
    story = [
        Paragraph("APAARSetu", styles["Title"]),
        Paragraph("Demonstration Academic Enrolment Credential", styles["Heading2"]),
        Paragraph(
            "SYNTHETIC DEMONSTRATION — NOT A GOVERNMENT-ISSUED CERTIFICATE",
            styles["Heading3"],
        ),
        Spacer(1, 8 * mm),
        Table(
            [
                ["Student", subject["name"]],
                ["APAAR-linked identifier", full_identifier or subject["apaar_masked"]],
                ["Institution student ID", record["institution_student_id"]],
                ["Institution", record["institution"]],
                ["Programme", f"{record['programme']} — {record['specialization']}"],
                ["Academic year", record["academic_year"]],
                ["Enrolment status", record["enrolment_status"].title()],
                ["Credential ID", credential.credential_code],
                ["Signature key", credential.key_id],
            ],
            colWidths=[52 * mm, 105 * mm],
        ),
        Spacer(1, 10 * mm),
        Image(qr_buffer, width=38 * mm, height=38 * mm),
        Paragraph(
            "The QR contains only an opaque, consent-scoped verification reference.",
            styles["BodyText"],
        ),
        Spacer(1, 8 * mm),
        Paragraph(credential.payload["notice"], styles["BodyText"]),
    ]
    for item in story:
        if isinstance(item, Table):
            item.setStyle(
                TableStyle(
                    [
                        ("BACKGROUND", (0, 0), (0, -1), colors.HexColor("#e2e8f0")),
                        ("TEXTCOLOR", (0, 0), (-1, -1), colors.HexColor("#0f172a")),
                        ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#94a3b8")),
                        ("PADDING", (0, 0), (-1, -1), 7),
                    ]
                )
            )
    doc.build(story)
    return buffer.getvalue()
