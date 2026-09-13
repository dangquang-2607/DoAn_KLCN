"""
CapitalFlow API — main entry point.
Tất cả routes được versioned dưới /api/v1/.
"""
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware
from sqlalchemy.exc import SQLAlchemyError

from app.core.config import settings
from app.core.limiter import limiter
from app.api.middleware.audit_middleware import AuditMiddleware
from app.api.middleware.body_limit import BodyLimitMiddleware
from app.api.routes import (
    auth,
    accounts,
    categories,
    transactions,
    budgets,
    dashboard,
    analytics,
    invoices,
    admin,
)

# ── Logging ───────────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)s | %(name)s | %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger("capitalflow")


# ── Rate Limiter ──────────────────────────────────────────────────────────────
# limiter is imported from app.core.limiter


# ── Lifespan ──────────────────────────────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info(f"🚀 {settings.app_name} v1.0 starting | env={settings.app_env}")
    yield
    logger.info(f"🛑 {settings.app_name} shutting down")


# ── OpenAPI Tags Metadata (Bilingual / Song ngữ) ──────────────────────────────
tags_metadata = [
    {
        "name": "Auth",
        "description": "🇻🇳 **Xác thực**: Đăng ký, đăng nhập, làm mới token và quản lý phiên làm việc.\n\n"
                       "🇬🇧 **Authentication**: User registration, login, token refresh, and session management.",
    },
    {
        "name": "Accounts",
        "description": "🇻🇳 **Tài khoản**: Quản lý tài khoản tài chính cá nhân (tiền mặt, ngân hàng, ví điện tử).\n\n"
                       "🇬🇧 **Accounts**: Personal financial accounts management (cash, bank, e-wallets).",
    },
    {
        "name": "Categories",
        "description": "🇻🇳 **Danh mục**: Quản lý danh mục thu/chi (hệ thống và người dùng tùy chỉnh).\n\n"
                       "🇬🇧 **Categories**: Expense and income category management (system and custom).",
    },
    {
        "name": "Transactions",
        "description": "🇻🇳 **Giao dịch**: Ghi nhận thu/chi, phân loại và tự động cập nhật số dư tài khoản.\n\n"
                       "🇬🇧 **Transactions**: Income/expense tracking with automatic balance adjustments.",
    },
    {
        "name": "Budgets",
        "description": "🇻🇳 **Ngân sách**: Thiết lập hạn mức chi tiêu và theo dõi tiến độ thực tế theo danh mục.\n\n"
                       "🇬🇧 **Budgets**: Spending limit planning and real-time progress monitoring.",
    },
    {
        "name": "Dashboard",
        "description": "🇻🇳 **Tổng quan**: Thống kê tài sản ròng, dòng tiền tháng và giao dịch gần đây.\n\n"
                       "🇬🇧 **Dashboard**: Overview of net worth, monthly cashflow, and recent transactions.",
    },
    {
        "name": "Analytics",
        "description": "🇻🇳 **Phân tích**: Báo cáo cơ cấu chi tiêu theo danh mục và biểu đồ xu hướng tài chính.\n\n"
                       "🇬🇧 **Analytics**: Category spending breakdown and financial trend analysis.",
    },
    {
        "name": "Invoices",
        "description": "🇻🇳 **Hóa đơn & OCR**: Tải lên hóa đơn và trích xuất dữ liệu tự động bằng Google Gemini AI.\n\n"
                       "🇬🇧 **Invoices & OCR**: Invoice upload and automated data extraction via Gemini AI.",
    },
    {
        "name": "Admin",
        "description": "🇻🇳 **Quản trị**: Quản lý người dùng, nhật ký kiểm toán, danh mục hệ thống và giám sát vận hành.\n\n"
                       "🇬🇧 **Admin**: User management, audit logs, system categories, and system monitoring.",
    },
    {
        "name": "System",
        "description": "🇻🇳 **Hệ thống**: Kiểm tra trạng thái sức khỏe và tính sẵn sàng của dịch vụ.\n\n"
                       "🇬🇧 **System**: Service health checks and availability monitoring.",
    },
]

# ── App ───────────────────────────────────────────────────────────────────────
app = FastAPI(
    title="CapitalFlow API",
    version="1.0.0",
    description=(
        "🇻🇳 **API quản lý tài chính cá nhân CapitalFlow** — Hỗ trợ theo dõi thu chi, ngân sách, "
        "báo cáo phân tích dòng tiền và trích xuất hóa đơn tự động bằng AI (Google Gemini OCR).\n\n"
        "🇬🇧 **CapitalFlow Personal Finance API** — Comprehensive finance tracking, budgeting, "
        "cashflow analytics, and automated invoice OCR extraction powered by Google Gemini AI."
    ),
    openapi_tags=tags_metadata,
    docs_url="/docs",
    redoc_url="/redoc",
    debug=settings.debug,
)
app.state.limiter = limiter

@app.exception_handler(RateLimitExceeded)
async def rate_limit_handler(request: Request, exc: RateLimitExceeded):
    return _rate_limit_exceeded_handler(request, exc)
app.add_middleware(SlowAPIMiddleware)

# ── CORS ──────────────────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        settings.frontend_url,
        settings.admin_url,
        "http://localhost:3000",
        "http://localhost:3010",
        "http://localhost:4000",
        "http://localhost:5173",
        "http://localhost:5174",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:5174",
        "http://localhost",
        "http://127.0.0.1",
    ],
    allow_origin_regex=r"^https?://(localhost|127\.0\.0\.1)(:\d+)?$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Audit Middleware (log POST/PATCH/PUT/DELETE tự động) ──────────────────────
app.add_middleware(AuditMiddleware)
app.add_middleware(BodyLimitMiddleware)


# ── Global Exception Handlers ─────────────────────────────────────────────────
@app.exception_handler(SQLAlchemyError)
async def sqlalchemy_exception_handler(request: Request, exc: SQLAlchemyError):
    logger.error("Database request failed: %s %s (%s)", request.method, request.url.path, type(exc).__name__)
    return JSONResponse(
        status_code=500,
        content={"detail": "Lỗi cơ sở dữ liệu. Vui lòng thử lại sau."},
    )


@app.exception_handler(Exception)
async def general_exception_handler(request: Request, exc: Exception):
    logger.error("Request failed: %s %s (%s)", request.method, request.url.path, type(exc).__name__)
    return JSONResponse(
        status_code=500,
        content={"detail": "Hệ thống gặp sự cố không mong muốn. Vui lòng thử lại sau."},
    )


# ── API v1 Routers ────────────────────────────────────────────────────────────
from fastapi import APIRouter

v1 = APIRouter(prefix="/api/v1")
v1.include_router(auth.router)
v1.include_router(accounts.router)
v1.include_router(categories.router)
v1.include_router(transactions.router)
v1.include_router(budgets.router)
v1.include_router(dashboard.router)
v1.include_router(analytics.router)
v1.include_router(invoices.router)
v1.include_router(admin.router)

app.include_router(v1)


# ── Health check (không versioned — dùng cho Docker healthcheck) ──────────────
@app.get(
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


@app.get("/ready", tags=["System"])
def readiness():
    from sqlalchemy import text
    from app.core.database import engine
    from pathlib import Path
    try:
        with engine.connect() as connection:
            connection.execute(text("SELECT 1"))
        root=Path(settings.upload_dir)
        if not root.is_dir():raise RuntimeError("Storage unavailable")
    except Exception:
        return JSONResponse(status_code=503,content={"status":"unavailable"})
    return {"status":"ready"}
