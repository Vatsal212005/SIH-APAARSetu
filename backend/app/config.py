from __future__ import annotations

from functools import lru_cache
from pathlib import Path
import os
import secrets
import tempfile

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


ROOT = Path(__file__).resolve().parents[2]
SERVERLESS = bool(os.environ.get("VERCEL"))
RUNTIME = Path(tempfile.gettempdir()) / "apaarsetu" if SERVERLESS else ROOT / "runtime"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=ROOT / ".env", env_prefix="APAARSETU_", extra="ignore"
    )

    env: str = "development"
    demo_mode: bool = False
    database_url: str = f"sqlite:///{(RUNTIME / 'apaarsetu.db').as_posix()}"
    secret_key: str = ""
    session_hours: int = 8
    frontend_origin: str = "http://localhost:3001"
    certificate_full_identifier: bool = False
    auto_initialize: bool = not SERVERLESS
    signing_private_key_b64: str = ""
    max_upload_bytes: int = 10 * 1024 * 1024

    @field_validator("database_url")
    @classmethod
    def normalize_postgres_driver(cls, value: str) -> str:
        for prefix in ("postgres://", "postgresql://"):
            if value.startswith(prefix):
                return "postgresql+psycopg://" + value[len(prefix) :]
        return value


@lru_cache
def get_settings() -> Settings:
    RUNTIME.mkdir(parents=True, exist_ok=True)
    config = Settings()
    if SERVERLESS:
        if not config.database_url.startswith("postgresql+psycopg://"):
            raise RuntimeError(
                "Serverless hosting requires a persistent PostgreSQL database"
            )
        if len(config.secret_key) < 32 or not config.signing_private_key_b64:
            raise RuntimeError(
                "Configure stable application and signing secrets before deploying"
            )
    if not config.secret_key:
        secret_file = RUNTIME / "application.secret"
        if not secret_file.exists():
            secret_file.write_text(secrets.token_urlsafe(48), encoding="utf-8")
        config.secret_key = secret_file.read_text(encoding="utf-8").strip()
    return config


settings = get_settings()
