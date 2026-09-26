"""Nạp và kiểm tra cấu hình dùng chung của CapitalFlow API.

Vai trò: cung cấp một đối tượng settings thống nhất cho API, worker và scripts.
Đầu vào: biến môi trường và tệp .env theo cấu hình Pydantic Settings.
Đầu ra: đường dẫn, khóa bảo mật, thông số CSDL và giới hạn vận hành đã định kiểu.
Ràng buộc: không ghi giá trị bí mật vào log hoặc comment.
"""

from pathlib import Path
from functools import lru_cache

from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


API_ROOT = Path(__file__).resolve().parents[2]


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

    # ── Cấu hình email SMTP ──────────────────────────────────────────────────
    smtp_host: str = "smtp.gmail.com"
    smtp_port: int = 587
    smtp_user: str = ""
    smtp_password: str = ""
    smtp_tls: bool = True
    smtp_ssl: bool = False
    emails_from_email: str = "support@capitalflow.vn"
    emails_from_name: str = "CapitalFlow Finance"

    @model_validator(mode="after")
    def resolve_runtime_paths(self) -> "Settings":
        """Neo đường dẫn tương đối vào API root, không phụ thuộc thư mục chạy lệnh."""

        upload_path = Path(self.upload_dir)
        if not upload_path.is_absolute():
            self.upload_dir = str((API_ROOT / upload_path).resolve())
        return self

    model_config = SettingsConfigDict(
        # Dùng đường dẫn tuyệt đối để API, worker và project database đều đọc
        # cùng cấu hình dù lệnh được chạy từ thư mục làm việc khác nhau.
        env_file=API_ROOT / ".env",
        case_sensitive=False,
        extra="ignore",
    )


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
