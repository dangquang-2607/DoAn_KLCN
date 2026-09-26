"""Tạo và lắp ráp ứng dụng FastAPI hoàn chỉnh.

Vai trò: composition root duy nhất cho cấu hình, middleware, handler và router.
Đầu vào: settings cùng các thành phần hạ tầng đã được khai báo.
Đầu ra: FastAPI app dùng bởi Uvicorn và TestClient.
Ràng buộc: giữ nguyên metadata, CORS, middleware order và OpenAPI contract.
"""

import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from slowapi.middleware import SlowAPIMiddleware

from app.shared.http.middleware.audit import AuditMiddleware
from app.shared.http.middleware.body_limit import BodyLimitMiddleware
from app.bootstrap.handlers import register_exception_handlers, register_runtime_telemetry
from app.bootstrap.lifespan import lifespan
from app.bootstrap.routers import register_routers
from app.shared.config import settings
from app.shared.http.rate_limit import limiter


TAGS_METADATA = [
    {"name": "Auth", "description": "🇻🇳 **Xác thực**: Đăng ký, đăng nhập, làm mới token và quản lý phiên làm việc.\n\n🇬🇧 **Authentication**: User registration, login, token refresh, and session management."},
    {"name": "Accounts", "description": "🇻🇳 **Tài khoản**: Quản lý tài khoản tài chính cá nhân (tiền mặt, ngân hàng, ví điện tử).\n\n🇬🇧 **Accounts**: Personal financial accounts management (cash, bank, e-wallets)."},
    {"name": "Categories", "description": "🇻🇳 **Danh mục**: Quản lý danh mục thu/chi (hệ thống và người dùng tùy chỉnh).\n\n🇬🇧 **Categories**: Expense and income category management (system and custom)."},
    {"name": "Transactions", "description": "🇻🇳 **Giao dịch**: Ghi nhận thu/chi, phân loại và tự động cập nhật số dư tài khoản.\n\n🇬🇧 **Transactions**: Income/expense tracking with automatic balance adjustments."},
    {"name": "Budgets", "description": "🇻🇳 **Ngân sách**: Thiết lập hạn mức chi tiêu và theo dõi tiến độ thực tế theo danh mục.\n\n🇬🇧 **Budgets**: Spending limit planning and real-time progress monitoring."},
    {"name": "Dashboard", "description": "🇻🇳 **Tổng quan**: Thống kê tài sản ròng, dòng tiền tháng và giao dịch gần đây.\n\n🇬🇧 **Dashboard**: Overview of net worth, monthly cashflow, and recent transactions."},
    {"name": "Analytics", "description": "🇻🇳 **Phân tích**: Báo cáo cơ cấu chi tiêu theo danh mục và biểu đồ xu hướng tài chính.\n\n🇬🇧 **Analytics**: Category spending breakdown and financial trend analysis."},
    {"name": "Invoices", "description": "🇻🇳 **Hóa đơn & OCR**: Tải lên hóa đơn và trích xuất dữ liệu tự động bằng Google Gemini AI.\n\n🇬🇧 **Invoices & OCR**: Invoice upload and automated data extraction via Gemini AI."},
    {"name": "Admin", "description": "🇻🇳 **Quản trị**: Quản lý người dùng, nhật ký kiểm toán, danh mục hệ thống và giám sát vận hành.\n\n🇬🇧 **Admin**: User management, audit logs, system categories, and system monitoring."},
    {"name": "System", "description": "🇻🇳 **Hệ thống**: Kiểm tra trạng thái sức khỏe và tính sẵn sàng của dịch vụ.\n\n🇬🇧 **System**: Service health checks and availability monitoring."},
]


def create_app() -> FastAPI:
    """Lắp ráp ứng dụng theo đúng thứ tự middleware và router baseline."""

    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s | %(levelname)s | %(name)s | %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
    )
    app = FastAPI(
        title="CapitalFlow API",
        version="1.0.0",
        description=(
            "🇻🇳 **API quản lý tài chính cá nhân CapitalFlow** — Hỗ trợ theo dõi thu chi, ngân sách, "
            "báo cáo phân tích dòng tiền và trích xuất hóa đơn tự động bằng AI (Google Gemini OCR).\n\n"
            "🇬🇧 **CapitalFlow Personal Finance API** — Comprehensive finance tracking, budgeting, "
            "cashflow analytics, and automated invoice OCR extraction powered by Google Gemini AI."
        ),
        openapi_tags=TAGS_METADATA,
        docs_url="/docs",
        redoc_url="/redoc",
        debug=settings.debug,
        lifespan=lifespan,
    )
    app.state.limiter = limiter

    # Thứ tự đăng ký được giữ nguyên vì Starlette dựng middleware stack theo thứ tự ngược.
    register_runtime_telemetry(app)
    register_exception_handlers(app)
    app.add_middleware(SlowAPIMiddleware)
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
    app.add_middleware(AuditMiddleware)
    app.add_middleware(BodyLimitMiddleware)
    register_routers(app)
    return app
