"""Cung cấp endpoint kiểm tra sức khỏe và mức sẵn sàng.

Vai trò: phục vụ Docker healthcheck và hệ thống giám sát triển khai.
Đầu vào: cấu hình, kết nối SQL Server và thư mục lưu upload.
Đầu ra: trạng thái health/ready không version hóa.
Ràng buộc: readiness trả 503 khi CSDL hoặc storage không sẵn sàng.
"""

from pathlib import Path

from fastapi import APIRouter
from fastapi.responses import JSONResponse
from sqlalchemy import text

from app.shared.config import settings
from app.shared.database.engine import engine


router = APIRouter()


@router.get(
    "/health",
    tags=["System"],
    summary="Kiểm tra trạng thái hệ thống (Health Check)",
    description=(
        "🇻🇳 **Mô tả**: Kiểm tra trạng thái hoạt động và tính sẵn sàng của dịch vụ.\n\n"
        "🇬🇧 **Description**: Check service health status and availability."
    ),
)
def health():
    return {
        "status": "ok",
        "service": settings.app_name,
        "version": "1.0.0",
        "env": settings.app_env,
    }


@router.get("/ready", tags=["System"])
def readiness():
    """Kiểm tra đồng thời SQL Server và thư mục upload trước khi nhận tải."""

    try:
        with engine.connect() as connection:
            connection.execute(text("SELECT 1"))
        if not Path(settings.upload_dir).is_dir():
            raise RuntimeError("Storage unavailable")
    except Exception:
        return JSONResponse(status_code=503, content={"status": "unavailable"})
    return {"status": "ready"}
