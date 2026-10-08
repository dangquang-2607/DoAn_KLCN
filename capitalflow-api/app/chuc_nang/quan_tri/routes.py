"""Tập hợp router quản trị theo từng năng lực."""

from fastapi import APIRouter

from app.chuc_nang.quan_tri.nhat_ky_quan_tri.api import router as audit_router
from app.chuc_nang.quan_tri.danh_muc_he_thong.api import router as categories_router
from app.chuc_nang.quan_tri.email_cau_hinh.api import router as email_router
from app.chuc_nang.quan_tri.phan_tich_van_hanh.api import router as analytics_router
from app.chuc_nang.quan_tri.giam_sat_hoa_don.api import router as ocr_router
from app.chuc_nang.quan_tri.bang_dieu_khien.api import router as overview_router
from app.chuc_nang.quan_tri.nguoi_dung.vong_doi.api import router as user_lifecycle_router
from app.chuc_nang.quan_tri.nguoi_dung.api import router as users_router


router = APIRouter(prefix="/admin", tags=["Admin"])
router.include_router(overview_router)
router.include_router(users_router)
router.include_router(user_lifecycle_router)
router.include_router(categories_router)
router.include_router(audit_router)
router.include_router(email_router)
router.include_router(ocr_router)
router.include_router(analytics_router)

__all__ = ["router"]
