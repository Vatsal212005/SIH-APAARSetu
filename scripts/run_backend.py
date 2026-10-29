import sys
from pathlib import Path
import uvicorn

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "backend"))
if __name__ == "__main__":
    uvicorn.run("app.main:app", host="127.0.0.1", port=8001, access_log=False)
