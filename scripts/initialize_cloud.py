"""Apply additive migrations and seed a new hosted synthetic demonstration.

Pass an ignored JSON environment file. Secret values are never printed.
"""

import argparse
import json
import os
from pathlib import Path
import sys


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--env-file", type=Path, required=True)
    args = parser.parse_args()
    values = json.loads(args.env_file.read_text(encoding="utf-8"))
    if not values.get("APAARSETU_DATABASE_URL", "").startswith("postgresql://"):
        raise SystemExit("Cloud initialization requires an explicit PostgreSQL URL")
    if "-pooler." in values["APAARSETU_DATABASE_URL"]:
        raise SystemExit("Use a direct PostgreSQL connection for migrations")
    if not values.get("APAARSETU_SECRET_KEY") or not values.get(
        "APAARSETU_SIGNING_PRIVATE_KEY_B64"
    ):
        raise SystemExit("Stable application and signing secrets are required")
    os.environ.update({key: str(value) for key, value in values.items()})
    root = Path(__file__).resolve().parents[1]
    sys.path.insert(0, str(root / "backend"))
    from alembic import command
    from alembic.config import Config
    from app.database import SessionLocal
    from app.services.seed import seed_demo

    config = Config(str(root / "backend" / "alembic.ini"))
    config.set_main_option("script_location", str(root / "backend" / "alembic"))
    command.upgrade(config, "head")
    with SessionLocal() as db:
        summary = seed_demo(db)
        summary.pop("demo_password", None)
    print(json.dumps({"migrations": "head", "synthetic_dataset": summary}))


if __name__ == "__main__":
    main()
