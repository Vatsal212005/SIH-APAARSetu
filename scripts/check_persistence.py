import argparse
import json
import sqlite3
from pathlib import Path

root = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser()
parser.add_argument("--record", action="store_true")
args = parser.parse_args()
with sqlite3.connect(root / "runtime" / "apaarsetu.db") as db:
    counts = {
        table: db.execute(f"SELECT count(*) FROM {table}").fetchone()[0]
        for table in [
            "students",
            "enrolments",
            "academic_credentials",
            "consent_grants",
            "student_record_versions",
            "import_batches",
        ]
    }
destination = root / "docs" / "persistence-check.json"
if args.record:
    destination.write_text(
        json.dumps({"before_restart": counts}, indent=2), encoding="utf8"
    )
    print("Recorded persistent record counts before restart.")
else:
    result = json.loads(destination.read_text(encoding="utf8"))
    result["after_restart"] = counts
    result["preserved"] = result["before_restart"] == counts
    destination.write_text(json.dumps(result, indent=2), encoding="utf8")
    assert result["preserved"], "Persistent counts changed across restart"
    print("All recorded database counts persisted across restart.")
