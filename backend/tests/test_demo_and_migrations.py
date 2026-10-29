import pytest
from sqlalchemy import create_engine, inspect, select
from app.config import settings
from app.models import DemoSession

pytest_plugins = ["test_workflows", "test_security_and_management"]


@pytest.mark.parametrize(
    "scenario",
    ["intake-exceeded", "cross-institution", "bulk-validation", "intelligent-anomaly"],
)
def test_demo_runs_and_repeat_is_persistent(authenticated, db, scenario):
    client = authenticated("aicte_admin")
    response = client.post(
        "/api/v1/demo/scenarios/" + scenario + "/run", json={"action": "run"}
    )
    assert response.status_code == 200, response.text
    first = response.json()
    repeated = client.post(
        "/api/v1/demo/scenarios/" + scenario + "/run", json={"action": "run"}
    )
    assert repeated.status_code == 200, repeated.text
    if scenario == "intake-exceeded":
        assert first["capacity"]["regular_excess"] == 15
    if scenario == "bulk-validation":
        assert first["batch_id"] == repeated.json()["batch_id"]
    assert db.scalar(select(DemoSession).where(DemoSession.scenario == scenario))


def test_demo_consent_verifies_then_denies(authenticated):
    client = authenticated("aicte_admin")
    base = "/api/v1/demo/scenarios/consent-verification/run"
    result = client.post(base, json={"action": "run"})
    assert result.status_code == 200, result.text
    token = result.json()["token"]
    result = client.post(base, json={"action": "verify", "token": token})
    assert result.status_code == 200, result.text
    assert result.json()["verification"]["valid"]
    result = client.post(base, json={"action": "revoke", "token": token})
    assert result.status_code == 200, result.text
    assert not result.json()["verification"]["valid"]


def test_migrations_preserve_existing_data(tmp_path, monkeypatch):
    from alembic import command
    from alembic.config import Config
    from pathlib import Path
    from sqlalchemy import text

    target = tmp_path / "migration.db"
    url = f"sqlite:///{target.as_posix()}"
    monkeypatch.setattr(settings, "database_url", url)
    root = Path(__file__).resolve().parents[1]
    config = Config(str(root / "alembic.ini"))
    config.set_main_option("script_location", str(root / "alembic"))
    command.upgrade(config, "0001")
    engine = create_engine(url)
    with engine.begin() as connection:
        connection.execute(
            text("INSERT INTO academic_years (name,active) VALUES ('2028-29',1)")
        )
    command.upgrade(config, "head")
    command.upgrade(config, "head")
    with engine.connect() as connection:
        assert (
            connection.execute(text("SELECT count(*) FROM academic_years")).scalar()
            == 1
        )
    assert "student_record_versions" in inspect(engine).get_table_names()
    engine.dispose()
