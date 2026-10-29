from __future__ import annotations

from sqlalchemy.orm import Session
from sqlalchemy import select
from fastapi.encoders import jsonable_encoder

from ..models import AuditEvent, Notification, User


def audit(
    db: Session,
    action: str,
    entity_type: str,
    entity_id: str | None,
    user: User | None = None,
    institution_id: str | None = None,
    metadata: dict | None = None,
) -> AuditEvent:
    event = AuditEvent(
        actor_user_id=user.id if user else None,
        institution_id=institution_id or (user.institution_id if user else None),
        action=action,
        entity_type=entity_type,
        entity_id=entity_id,
        metadata_json=jsonable_encoder(metadata or {}),
    )
    db.add(event)
    return event


def notify(
    db: Session,
    title: str,
    body: str,
    severity: str = "info",
    user_id: str | None = None,
    institution_id: str | None = None,
    deep_link: str | None = None,
    dedupe_key: str | None = None,
) -> Notification:
    item = Notification(
        title=title,
        body=body,
        severity=severity,
        user_id=user_id,
        institution_id=institution_id,
        deep_link=deep_link,
        dedupe_key=dedupe_key,
    )
    db.add(item)
    return item


def notify_student(db: Session, student_id: str, title: str, body: str):
    for user in db.scalars(select(User).where(User.student_id == student_id)).all():
        notify(db, title, body, user_id=user.id, deep_link="/credentials")


def csv_safe(value):
    if isinstance(value, str) and value.lstrip().startswith(
        ("=", "+", "-", "@", "\t", "\r")
    ):
        return "'" + value
    return value
