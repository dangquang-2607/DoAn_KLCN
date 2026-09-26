"""Đăng ký middleware đo lường và bộ xử lý lỗi toàn cục.

Vai trò: chuẩn hóa lỗi HTTP và ghi nhận thời gian xử lý request.
Đầu vào: FastAPI app, request và exception phát sinh trong runtime.
Đầu ra: JSON response an toàn cùng số liệu telemetry.
Ràng buộc: không trả stack trace hoặc thông tin kết nối CSDL cho client.
"""

import logging
import time

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from sqlalchemy.exc import SQLAlchemyError

from app.shared.observability.telemetry import telemetry


logger = logging.getLogger("capitalflow")


def register_runtime_telemetry(app: FastAPI) -> None:
    """Gắn middleware đo latency nhưng bỏ qua chi phí khi telemetry tắt."""

    @app.middleware("http")
    async def runtime_telemetry(request: Request, call_next):
        if not telemetry.enabled:
            return await call_next(request)
        started = time.perf_counter()
        failed = False
        try:
            response = await call_next(request)
            failed = response.status_code >= 500
            return response
        except Exception:
            failed = True
            raise
        finally:
            route = request.scope.get("route")
            route_path = getattr(route, "path", request.url.path)
            telemetry.observe_request(
                (time.perf_counter() - started) * 1000,
                f"{request.method} {route_path}",
                failed=failed,
            )


def register_exception_handlers(app: FastAPI) -> None:
    """Đăng ký response lỗi ổn định mà không làm lộ chi tiết nội bộ."""

    @app.exception_handler(RateLimitExceeded)
    async def rate_limit_handler(request: Request, exc: RateLimitExceeded):
        return _rate_limit_exceeded_handler(request, exc)

    @app.exception_handler(SQLAlchemyError)
    async def sqlalchemy_exception_handler(request: Request, exc: SQLAlchemyError):
        logger.error(
            "Database request failed: %s %s (%s)",
            request.method,
            request.url.path,
            type(exc).__name__,
        )
        return JSONResponse(
            status_code=500,
            content={"detail": "Lỗi cơ sở dữ liệu. Vui lòng thử lại sau."},
        )

    @app.exception_handler(Exception)
    async def general_exception_handler(request: Request, exc: Exception):
        logger.error(
            "Request failed: %s %s (%s)",
            request.method,
            request.url.path,
            type(exc).__name__,
        )
        return JSONResponse(
            status_code=500,
            content={"detail": "Hệ thống gặp sự cố không mong muốn. Vui lòng thử lại sau."},
        )
