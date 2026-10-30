from __future__ import annotations

import json
import logging
import time
from collections import defaultdict, deque
from contextlib import asynccontextmanager
from datetime import datetime, timezone

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from .api import auth, credentials, demo, management, operations, reports, workspace
from .config import ROOT, settings
from .database import SessionLocal, init_db
from .services.credentials import ensure_signing_key
from .services.seed import seed_demo


class JsonFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        return json.dumps(
            {
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "level": record.levelname,
                "logger": record.name,
                "message": record.getMessage(),
            }
        )


handler = logging.StreamHandler()
handler.setFormatter(JsonFormatter())
logging.basicConfig(level=logging.INFO, handlers=[handler], force=True)
logger = logging.getLogger("apaarsetu")


@asynccontextmanager
async def lifespan(_app: FastAPI):
    if settings.auto_initialize:
        init_db()
    ensure_signing_key()
    if settings.demo_mode and settings.auto_initialize:
        with SessionLocal() as db:
            summary = seed_demo(db)
            logger.info(
                "Synthetic dataset ready: %s",
                {
                    key: value
                    for key, value in summary.items()
                    if key != "demo_password"
                },
            )
    yield


app = FastAPI(
    title="APAARSetu API",
    version="1.0.0",
    description="Synthetic demonstration platform for APAAR-linked enrolment compliance and consent-based academic verification. No official APAAR verification is claimed.",
    lifespan=lifespan,
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.frontend_origin],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

requests_by_client = defaultdict(deque)


@app.middleware("http")
async def security_headers_and_limits(request, call_next):
    key = (
        request.client.host if request.client else "local",
        request.url.path.startswith("/api/v1/verification/"),
    )
    if key[1]:
        window = requests_by_client[key]
        cutoff = time.monotonic() - 60
        while window and window[0] < cutoff:
            window.popleft()
        if len(window) >= 120:
            return JSONResponse(
                status_code=429, content={"detail": "Verification rate limit exceeded"}
            )
        window.append(time.monotonic())
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["Referrer-Policy"] = "no-referrer"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Cache-Control"] = "no-store"
    return response


for api_router in (
    auth.router,
    operations.router,
    credentials.router,
    reports.router,
    demo.router,
    management.router,
    workspace.router,
):
    app.include_router(api_router, prefix="/api/v1")


@app.get("/health")
def health() -> dict:
    from sqlalchemy import text

    with SessionLocal() as db:
        db.execute(text("SELECT 1"))
    return {
        "status": "healthy",
        "database": "connected",
        "project_root": str(ROOT),
        "demo_mode": settings.demo_mode,
        "timestamp": datetime.now(timezone.utc),
    }


@app.exception_handler(Exception)
async def unhandled_exception(_request, exc: Exception):
    logger.exception("Unhandled request error")
    return JSONResponse(
        status_code=500,
        content={
            "detail": "An internal error occurred. See structured server logs for the correlation context."
        },
    )
