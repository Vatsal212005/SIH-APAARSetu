from datetime import datetime, timedelta, timezone
from sqlalchemy import select
from ..models import Finding, Notification, SessionToken
from .common import notify


def maintenance(db):
    now = datetime.now(timezone.utc)
    expired_sessions = len(
        db.scalars(select(SessionToken).where(SessionToken.expires_at < now)).all()
    )
    findings = db.scalars(
        select(Finding).where(
            Finding.review_state == "open", Finding.created_at < now - timedelta(days=7)
        )
    ).all()
    reminders = 0
    for finding in findings:
        key = f"reminder:{finding.id}:{now:%Y-%m-%d}"
        if not db.scalar(select(Notification).where(Notification.dedupe_key == key)):
            notify(
                db,
                "Unresolved review reminder",
                finding.title,
                "warning",
                institution_id=finding.institution_id,
                deep_link="/anomalies",
                dedupe_key=key,
            )
            reminders += 1
    return {
        "expired_sessions_retention_candidates": expired_sessions,
        "unresolved_reviews": len(findings),
        "reminders_created": reminders,
        "academic_records_deleted": 0,
    }
