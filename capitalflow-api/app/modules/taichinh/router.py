"""Tập hợp các router thuộc module tài chính.

Vai trò: gom tài khoản, giao dịch, ngân sách, dashboard và analytics.
Đầu vào: các router tài chính hiện hành.
Đầu ra: một router để bootstrap đăng ký.
Ràng buộc: không thêm prefix mới hoặc thay đổi URL công khai.
"""

from fastapi import APIRouter

from app.modules.taichinh.accounts import api as accounts
from app.modules.taichinh.budgets import api as budgets
from app.modules.taichinh.reporting import analytics, dashboard
from app.modules.taichinh.transactions import api as transactions


router = APIRouter()
router.include_router(accounts.router)
router.include_router(transactions.router)
router.include_router(budgets.router)
router.include_router(dashboard.router)
router.include_router(analytics.router)
