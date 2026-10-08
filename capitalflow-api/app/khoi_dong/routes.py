"""Tập hợp router runtime theo đúng prefix API hiện hành.

Vai trò: tạo router /api/v1 và ghép các phân hệ nghiệp vụ.
Đầu vào: router hiện hành của auth, tài chính, hóa đơn và admin.
Đầu ra: router API v1 cùng router health không version hóa.
Ràng buộc: thứ tự và URL phải giữ nguyên để bảo toàn OpenAPI contract.
"""

from fastapi import APIRouter, FastAPI

from app.khoi_dong.trang_thai import router as health_router
from app.chuc_nang.quan_tri.routes import router as admin_router
from app.chuc_nang.nguoi_dung.dang_nhap.routes import router as auth_router
from app.chuc_nang.nguoi_dung.danh_muc.routes import router as category_router
from app.chuc_nang.nguoi_dung.hoa_don_ai.routes import router as invoice_router
from app.chuc_nang.nguoi_dung.tai_chinh.routes import router as finance_router


def register_routers(app: FastAPI) -> None:
    """Đăng ký toàn bộ router theo cùng thứ tự của baseline."""

    v1 = APIRouter(prefix="/api/v1")
    v1.include_router(auth_router)
    v1.include_router(finance_router)
    v1.include_router(category_router)
    v1.include_router(invoice_router)
    v1.include_router(admin_router)
    app.include_router(v1)
    app.include_router(health_router)
