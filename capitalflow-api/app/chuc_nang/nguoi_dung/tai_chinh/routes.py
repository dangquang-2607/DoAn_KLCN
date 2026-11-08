"""Tập hợp các router thuộc module tài chính.

Vai trò: gom ví độc lập, sổ thu chi, ngân sách và analytics.
Đầu vào: các router tài chính hiện hành.
Đầu ra: một router để bootstrap đăng ký.
Ràng buộc: không thêm prefix mới hoặc thay đổi URL công khai.
"""

from fastapi import APIRouter

from app.chuc_nang.nguoi_dung.tai_chinh.ngan_sach import api as budgets
from app.chuc_nang.nguoi_dung.tai_chinh.bao_cao_tai_chinh import phan_tich
from app.chuc_nang.nguoi_dung.tai_chinh.thong_bao import api as notifications


from app.chuc_nang.nguoi_dung.tai_chinh.vi_tai_khoan.wallet_api import router as wallet_router
from app.chuc_nang.nguoi_dung.tai_chinh.vi_tai_khoan.bill_qr import router as bill_qr_router
from app.chuc_nang.nguoi_dung.tai_chinh.giao_dich.bookkeeping import router as bookkeeping_router

router = APIRouter()
router.include_router(bill_qr_router)
router.include_router(wallet_router)
router.include_router(bookkeeping_router)
router.include_router(notifications.router)
router.include_router(budgets.router)
router.include_router(phan_tich.router)
