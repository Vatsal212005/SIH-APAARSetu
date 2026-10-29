import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "backend"))
from app.database import SessionLocal  # noqa: E402
from alembic.config import Config  # noqa: E402
from alembic import command  # noqa: E402
from app.services.seed import seed_demo  # noqa: E402

parser = argparse.ArgumentParser()
parser.add_argument("--demo", action="store_true")
args = parser.parse_args()
config = Config(str(Path(__file__).resolve().parents[1] / "backend" / "alembic.ini"))
config.set_main_option(
    "script_location", str(Path(__file__).resolve().parents[1] / "backend" / "alembic")
)
command.upgrade(config, "head")
if args.demo:
    with SessionLocal() as session:
        result = seed_demo(session)
        result.pop("demo_password", None)
        print(result)
