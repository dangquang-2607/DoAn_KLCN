"""Tập hợp router quản trị theo từng năng lực."""

from fastapi import APIRouter

from app.modules.admin.audit.api import router as audit_router
from app.modules.admin.categories.api import router as categories_router
from app.modules.admin.monitoring.email import router as email_router
from app.modules.admin.monitoring.ocr import router as ocr_router
from app.modules.admin.monitoring.overview import router as overview_router
from app.modules.admin.user_lifecycle.api import router as user_lifecycle_router
from app.modules.admin.users.api import router as users_router


router = APIRouter(prefix="/admin", tags=["Admin"])
router.include_router(overview_router)
router.include_router(users_router)
router.include_router(user_lifecycle_router)
router.include_router(categories_router)
router.include_router(audit_router)
router.include_router(email_router)
router.include_router(ocr_router)

__all__ = ["router"]
