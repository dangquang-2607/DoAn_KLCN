"""Tập hợp các router thuộc module tài chính.

Vai trò: gom tài khoản, giao dịch, ngân sách, dashboard và analytics.
Đầu vào: các router tài chính hiện hành.
Đầu ra: một router để bootstrap đăng ký.
Ràng buộc: không thêm prefix mới hoặc thay đổi URL công khai.
"""

from fastapi import APIRouter

from app.chuc_nang.nguoi_dung.tai_chinh.ngan_sach import api as budgets
from app.chuc_nang.nguoi_dung.tai_chinh.bao_cao_tai_chinh import (
    dashboard,
    phan_tich,
)
from app.chuc_nang.nguoi_dung.tai_chinh.giao_dich import api as transactions
from app.chuc_nang.nguoi_dung.tai_chinh.thong_bao import api as notifications


router = APIRouter()
from app.dung_chung.config import settings
from app.chuc_nang.nguoi_dung.tai_chinh.vi_tai_khoan.wallet_api import router as wallet_router
from app.chuc_nang.nguoi_dung.tai_chinh.giao_dich.bookkeeping import router as bookkeeping_router
if settings.independent_wallets_enabled:
    router.include_router(wallet_router)
    router.include_router(bookkeeping_router)
else:
    from app.chuc_nang.nguoi_dung.tai_chinh.vi_tai_khoan import api as accounts
    from app.chuc_nang.nguoi_dung.tai_chinh.vi_tai_khoan.legacy_bank_sync.bank import router as bank_router
    router.include_router(accounts.router)
    router.include_router(bank_router)
    router.include_router(transactions.router)
    router.include_router(dashboard.router)
router.include_router(notifications.router)
router.include_router(budgets.router)
router.include_router(phan_tich.router)
