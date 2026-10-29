from __future__ import annotations

import time
from collections import defaultdict

from fastapi import APIRouter, Cookie, Depends, HTTPException, Request, Response, status
from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from ..config import settings
from ..database import get_db
from ..models import SessionToken, User
from ..schemas import LoginRequest, UserView
from ..security import create_session, current_user, opaque_hash, verify_password
from ..services.common import audit


router = APIRouter(prefix="/auth", tags=["authentication"])
attempts: dict[str, list[float]] = defaultdict(list)


@router.post("/login")
def login(
    payload: LoginRequest,
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
) -> dict:
    key = (
        f"{request.client.host if request.client else 'local'}:{payload.email.lower()}"
    )
    cutoff = time.time() - 600
    attempts[key] = [item for item in attempts[key] if item > cutoff]
    if len(attempts[key]) >= 8:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many login attempts. Try again later.",
        )
    user = db.scalar(select(User).where(User.email == payload.email.lower()))
    if (
        not user
        or (user.email.endswith("@apaarsetu.demo") and not settings.demo_mode)
        or not verify_password(payload.password, user.password_hash)
    ):
        attempts[key].append(time.time())
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password"
        )
    attempts.pop(key, None)
    csrf = create_session(db, user, response)
    audit(db, "auth.login", "user", user.id, user)
    db.commit()
    return {
        "user": UserView.model_validate(user),
        "csrf_token": csrf,
        "demo_mode": settings.demo_mode,
    }


@router.get("/me")
def me(user: User = Depends(current_user)) -> dict:
    return {"user": UserView.model_validate(user), "demo_mode": settings.demo_mode}


@router.post("/logout")
def logout(
    response: Response,
    db: Session = Depends(get_db),
    user: User = Depends(current_user),
    apaarsetu_session: str | None = Cookie(default=None),
) -> dict:
    if apaarsetu_session:
        db.execute(
            delete(SessionToken).where(
                SessionToken.token_hash == opaque_hash(apaarsetu_session)
            )
        )
    audit(db, "auth.logout", "user", user.id, user)
    db.commit()
    response.delete_cookie("apaarsetu_session", path="/")
    return {"ok": True}


@router.get("/demo-accounts")
def demo_accounts() -> dict:
    if not settings.demo_mode:
        raise HTTPException(status_code=404, detail="Not found")
    return {
        "notice": "Development-only synthetic accounts. Disabled when demo mode is false.",
        "password": "Demo@26263",
        "accounts": [
            {
                "role": "AICTE Central Administrator",
                "email": "central.admin@apaarsetu.demo",
            },
            {"role": "Regional Officer", "email": "regional.officer@apaarsetu.demo"},
            {
                "role": "Institution Administrator",
                "email": "institution.admin@apaarsetu.demo",
            },
            {
                "role": "Institution Operator",
                "email": "institution.operator@apaarsetu.demo",
            },
            {"role": "Student", "email": "student@apaarsetu.demo"},
            {"role": "Authorized Verifier", "email": "verifier@apaarsetu.demo"},
            {"role": "Auditor", "email": "auditor@apaarsetu.demo"},
        ],
    }
