from __future__ import annotations

from functools import lru_cache
from pathlib import Path
import secrets

from pydantic_settings import BaseSettings, SettingsConfigDict


ROOT = Path(__file__).resolve().parents[2]
RUNTIME = ROOT / "runtime"


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


@lru_cache
def get_settings() -> Settings:
    RUNTIME.mkdir(parents=True, exist_ok=True)
    config = Settings()
    if not config.secret_key:
        secret_file = RUNTIME / "application.secret"
        if not secret_file.exists():
            secret_file.write_text(secrets.token_urlsafe(48), encoding="utf-8")
        config.secret_key = secret_file.read_text(encoding="utf-8").strip()
    return config


settings = get_settings()
