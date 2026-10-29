from __future__ import annotations

import base64
import hashlib
import hmac
import secrets
from datetime import datetime, timedelta, timezone

from cryptography.fernet import Fernet
from fastapi import Cookie, Depends, Header, HTTPException, Request, Response, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from .config import settings
from .database import get_db
from .models import Role, SessionToken, User


def hash_password(password: str) -> str:
    salt = secrets.token_bytes(16)
    derived = hashlib.scrypt(password.encode(), salt=salt, n=2**14, r=8, p=1, dklen=32)
    return f"scrypt${base64.urlsafe_b64encode(salt).decode()}${base64.urlsafe_b64encode(derived).decode()}"


def verify_password(password: str, encoded: str) -> bool:
    try:
        scheme, salt_b64, hash_b64 = encoded.split("$", 2)
        if scheme != "scrypt":
            return False
        salt = base64.urlsafe_b64decode(salt_b64)
        expected = base64.urlsafe_b64decode(hash_b64)
        actual = hashlib.scrypt(
            password.encode(), salt=salt, n=2**14, r=8, p=1, dklen=32
        )
        return hmac.compare_digest(actual, expected)
    except (ValueError, TypeError):
        return False


def opaque_hash(value: str) -> str:
    return hmac.new(
        settings.secret_key.encode(), value.encode(), hashlib.sha256
    ).hexdigest()


def _fernet() -> Fernet:
    key = base64.urlsafe_b64encode(
        hashlib.sha256(settings.secret_key.encode()).digest()
    )
    return Fernet(key)


def encrypt_identifier(value: str) -> str:
    return _fernet().encrypt(value.encode()).decode()


def decrypt_identifier(value: str) -> str:
    return _fernet().decrypt(value.encode()).decode()


def create_session(db: Session, user: User, response: Response) -> str:
    raw = secrets.token_urlsafe(32)
    csrf = secrets.token_urlsafe(24)
    expires = datetime.now(timezone.utc) + timedelta(hours=settings.session_hours)
    db.add(
        SessionToken(
            token_hash=opaque_hash(raw),
            csrf_token=csrf,
            user_id=user.id,
            expires_at=expires,
        )
    )
    db.commit()
    response.set_cookie(
        "apaarsetu_session",
        raw,
        httponly=True,
        secure=settings.env == "production",
        samesite="strict",
        max_age=settings.session_hours * 3600,
        path="/",
    )
    return csrf


def _aware(value: datetime) -> datetime:
    return value if value.tzinfo else value.replace(tzinfo=timezone.utc)


def current_user(
    request: Request,
    db: Session = Depends(get_db),
    apaarsetu_session: str | None = Cookie(default=None),
    x_csrf_token: str | None = Header(default=None),
) -> User:
    if not apaarsetu_session:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required"
        )
    session = db.scalar(
        select(SessionToken).where(
            SessionToken.token_hash == opaque_hash(apaarsetu_session)
        )
    )
    if not session or _aware(session.expires_at) <= datetime.now(timezone.utc):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Session expired"
        )
    if request.method not in {"GET", "HEAD", "OPTIONS"} and request.url.path not in {
        "/api/v1/auth/logout"
    }:
        if not x_csrf_token or not hmac.compare_digest(
            x_csrf_token, session.csrf_token
        ):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN, detail="CSRF validation failed"
            )
    if not session.user.active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Account disabled"
        )
    user = session.user
    if user.email.endswith("@apaarsetu.demo") and not settings.demo_mode:
        raise HTTPException(
            status_code=403, detail="Demonstration accounts are disabled"
        )
    path = request.url.path.removeprefix("/api/v1")
    if user.role == Role.verifier.value and not (
        path.startswith("/auth/") or path == "/dashboard"
    ):
        raise HTTPException(403, "Use a student-authorized disclosure reference")
    if user.role in {Role.student.value, Role.verifier.value}:
        allowed = (
            "/auth/",
            "/credentials",
            "/consents",
            "/verification-events",
            "/dashboard",
            "/corrections",
            "/enrolments",
            "/notifications",
            "/profile",
            "/privacy-config",
        )
        if not any(path.startswith(prefix) for prefix in allowed):
            raise HTTPException(
                status_code=403,
                detail="Role cannot access institutional or regulatory records",
            )
    return session.user


def require_roles(*roles: Role):
    allowed = {role.value for role in roles}

    def dependency(user: User = Depends(current_user)) -> User:
        if user.role not in allowed:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Insufficient role permission",
            )
        return user

    return dependency


def enforce_institution_scope(
    user: User, institution_id: str, db: Session | None = None
) -> None:
    central = {Role.system_admin.value, Role.aicte_admin.value, Role.auditor.value}
    if user.role == Role.regional_officer.value and db:
        from .models import Institution

        institution = db.get(Institution, institution_id)
        if institution and institution.region == user.region:
            return
    if user.role not in central and user.institution_id != institution_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Institution scope violation"
        )
