"""Read live-service evidence without printing session secrets."""

import json
from pathlib import Path
from datetime import datetime, timezone
import httpx

root = Path(__file__).resolve().parents[1]
with httpx.Client(base_url="http://127.0.0.1:8001", timeout=30) as client:
    health = client.get("/health")
    health.raise_for_status()
    login = client.post(
        "/api/v1/auth/login",
        json={"email": "central.admin@apaarsetu.demo", "password": "Demo@26263"},
    )
    login.raise_for_status()
    client.headers["X-CSRF-Token"] = login.json()["csrf_token"]
    dashboard = client.get("/api/v1/dashboard")
    dashboard.raise_for_status()
    intakes = client.get("/api/v1/intakes").json()["items"]
    scenario = [
        i
        for i in intakes
        if i["regular_capacity"] == 120 and i["regular_enrolment"] == 135
    ]
    assert scenario and scenario[0]["regular_excess"] == 15
    reports = client.get("/api/v1/reports/catalog")
    reports.raise_for_status()
    assert len(reports.json()["items"]) == 18
    web = httpx.get("http://127.0.0.1:3001/login", timeout=30)
    web.raise_for_status()
    result = {
        "checked_at": datetime.now(timezone.utc).isoformat(),
        "project_root": health.json()["project_root"],
        "backend_healthy": health.json()["status"] == "healthy",
        "frontend_status": web.status_code,
        "dashboard_metrics": dashboard.json()["metrics"],
        "intake_scenario": {
            "capacity": 120,
            "counted": 135,
            "excess": scenario[0]["regular_excess"],
        },
        "report_types": 18,
    }
    client.post("/api/v1/auth/logout")
(root / "docs" / "live-acceptance.json").write_text(
    json.dumps(result, indent=2), encoding="utf8"
)
print(json.dumps(result, indent=2))
