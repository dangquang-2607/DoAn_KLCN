"""
Admin Routes Package — Gộp tất cả sub-routers thành một admin_router duy nhất.
Prefix /admin được giữ nguyên — không thay đổi bất kỳ URL endpoint nào.

Sub-modules:
  overview.py       — GET /admin/overview
  users.py          — GET/POST/PATCH /admin/users*
  user_deletions.py — DELETE /admin/users/{id}, POST /admin/user-deletions/*
  categories.py     — GET/POST/PATCH/PUT /admin/categories*
  audit.py          — GET /admin/audit-logs
  email.py          — GET/PUT/POST /admin/email/*
  ocr.py            — GET /admin/system/ocr-monitor, POST /admin/system/ocr-jobs/*/retry
                      GET /admin/system/analytics
"""
from fastapi import APIRouter

from .overview import router as overview_router
from .users import router as users_router
from .user_deletions import router as user_deletions_router
from .categories import router as categories_router
from .audit import router as audit_router
from .email import router as email_router, _save_smtp_to_db, _load_smtp_from_db
from .ocr import router as ocr_router
from ._shared import SMTPSettingsUpdate

# Admin router với prefix /admin dùng chung cho tất cả sub-routers
router = APIRouter(prefix="/admin", tags=["Admin"])

router.include_router(overview_router)
router.include_router(users_router)
router.include_router(user_deletions_router)
router.include_router(categories_router)
router.include_router(audit_router)
router.include_router(email_router)
router.include_router(ocr_router)

__all__ = ["router"]
