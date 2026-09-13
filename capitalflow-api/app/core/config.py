from pathlib import Path
from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "CapitalFlow API"
    app_env: str = "development"
    debug: bool = True

    database_url: str

    job_encryption_key: str
    worker_queue_limit: int = 500
    jwt_secret_key: str
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 15
    refresh_token_expire_days: int = 7

    frontend_url: str = "http://localhost:3010"
    admin_url: str = "http://localhost:5173"

    google_ai_api_key: str = ""
    google_ai_model: str = "gemini-3.5-flash-lite"

    upload_dir: str = str(Path(__file__).resolve().parent.parent.parent / "uploads")

    # ── SMTP Email Settings ──────────────────────────────────────────────────
    smtp_host: str = "smtp.gmail.com"
    smtp_port: int = 587
    smtp_user: str = ""
    smtp_password: str = ""
    smtp_tls: bool = True
    smtp_ssl: bool = False
    emails_from_email: str = "support@capitalflow.vn"
    emails_from_name: str = "CapitalFlow Finance"

    model_config = SettingsConfigDict(
        env_file=".env",
        case_sensitive=False,
        extra="ignore",
    )


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
