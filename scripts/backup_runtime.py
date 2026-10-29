"""Create a private coherent local backup; never send it to source control."""

from datetime import datetime, timezone
from pathlib import Path
import shutil
import sqlite3

root = Path(__file__).resolve().parents[1]
runtime = root / "runtime"
destination = runtime / "backups" / datetime.now(timezone.utc).strftime("%Y%m%d-%H%M%S")
destination.mkdir(parents=True, exist_ok=False)
with (
    sqlite3.connect(runtime / "apaarsetu.db") as source,
    sqlite3.connect(destination / "apaarsetu.db") as target,
):
    source.backup(target)
shutil.copy2(runtime / "application.secret", destination / "application.secret")
shutil.copytree(runtime / "keys", destination / "keys")
print("Private database and issuer backup created under runtime/backups.")
