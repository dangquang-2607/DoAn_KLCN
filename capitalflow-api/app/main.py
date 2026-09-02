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


# ── App ───────────────────────────────────────────────────────────────────────
app = FastAPI(
    title=settings.app_name,
    version="1.0.0",
    description="API quản lý tài chính cá nhân CapitalFlow — v1",
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
        "http://localhost:3010",
        "http://localhost:4000",
        "http://localhost:5173",
        "http://localhost",
        "http://127.0.0.1",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Audit Middleware (log POST/PATCH/PUT/DELETE tự động) ──────────────────────
app.add_middleware(AuditMiddleware)


# ── Global Exception Handlers ─────────────────────────────────────────────────
@app.exception_handler(SQLAlchemyError)
async def sqlalchemy_exception_handler(request: Request, exc: SQLAlchemyError):
    logger.error(f"DB error on {request.url}: {exc}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={"detail": "Lỗi cơ sở dữ liệu. Vui lòng thử lại sau."},
    )


@app.exception_handler(Exception)
async def general_exception_handler(request: Request, exc: Exception):
    logger.error(f"Unhandled error on {request.url}: {exc}", exc_info=True)
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
@app.get("/health", tags=["System"])
def health():
    return {
        "status": "ok",
        "service": settings.app_name,
        "version": "1.0.0",
        "env": settings.app_env,
    }
