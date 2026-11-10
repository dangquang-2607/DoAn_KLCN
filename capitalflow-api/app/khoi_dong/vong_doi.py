"""Quản lý vòng đời tài nguyên dùng chung của ứng dụng.

Vai trò: bật/tắt telemetry đúng theo vòng đời FastAPI.
Đầu vào: đối tượng FastAPI và settings runtime.
Đầu ra: context manager lifespan cho application factory.
Ràng buộc: luôn dừng telemetry trong khối finally khi ứng dụng tắt.
"""

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI

from app.dung_chung.config import settings
from app.dung_chung.quan_sat.do_luong import telemetry


logger = logging.getLogger("capitalflow")


@asynccontextmanager
async def lifespan(_app: FastAPI):
    """Khởi động telemetry trước khi nhận request và giải phóng khi dừng."""

    logger.info("Khởi động %s v1.0 | env=%s", settings.app_name, settings.app_env)
    await telemetry.start()
    try:
        yield
    finally:
        await telemetry.stop()
        logger.info("Đã dừng %s", settings.app_name)
