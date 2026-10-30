import base64

import pytest
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey

from app.config import Settings
from app.services import credentials


@pytest.mark.parametrize("prefix", ["postgres://", "postgresql://"])
def test_postgres_connection_selects_installed_driver(prefix):
    config = Settings(
        database_url=prefix + "user:password@db.example/test", _env_file=None
    )
    assert config.database_url == "postgresql+psycopg://user:password@db.example/test"


def test_environment_signing_key_is_stable_without_filesystem(monkeypatch, tmp_path):
    private = Ed25519PrivateKey.generate()
    pem = private.private_bytes(
        serialization.Encoding.PEM,
        serialization.PrivateFormat.PKCS8,
        serialization.NoEncryption(),
    )
    monkeypatch.setattr(
        credentials.settings, "signing_private_key_b64", base64.b64encode(pem).decode()
    )
    monkeypatch.setattr(credentials, "KEY_DIR", tmp_path / "must-not-be-created")
    first, _ = credentials.ensure_signing_key()
    _, public = credentials.ensure_signing_key()
    public.verify(first.sign(b"cloud credential"), b"cloud credential")
    assert not credentials.KEY_DIR.exists()


def test_bulk_capacity_preserves_policy_statuses_categories_and_years(db):
    from sqlalchemy import select
    from app.models import ApprovedIntake, CapacityPolicy
    from app.services.validation import capacity_snapshot, capacity_snapshots

    policy = db.scalar(select(CapacityPolicy))
    policy.rules = {
        **policy.rules,
        "nri_exempt_from_regular": True,
        "count_statuses": ["enrolled", "completed"],
    }
    db.flush()
    intakes = list(db.scalars(select(ApprovedIntake)))
    bulk = capacity_snapshots(db, intakes)
    for intake in intakes:
        assert bulk[intake.id] == capacity_snapshot(
            db, intake.institution_id, intake.programme_id, intake.academic_year
        )
