"""
Admin Audit — Nhật ký hành động quản trị (Audit Logs).
GET /admin/audit-logs
"""
from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.api.dependencies import get_db, require_admin
from app.models.audit_log import AuditLog
from app.models.user import User

from ._shared import _iso_utc

router = APIRouter()


@router.get(
    "/audit-logs",
    summary="Nhật ký hệ thống (Audit Logs)",
    description="Lấy danh sách nhật ký hành động quản trị (phân trang) của các Admin trong hệ thống.",
)
def audit_logs(
    page: int = Query(1, ge=1, description="Số trang"),
    page_size: int = Query(50, ge=1, le=200, description="Số bản ghi mỗi trang"),
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    total = db.scalar(select(func.count(AuditLog.id)))
    logs = db.scalars(
        select(AuditLog)
        .order_by(AuditLog.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    ).all()
    return {
        "items": [
            {
                "id": str(l.id),
                "admin_id": str(l.user_id),
                "action": l.action,
                "target_type": l.entity_type,
                "target_id": l.entity_id,
                "created_at": _iso_utc(l.created_at),
            }
            for l in logs
        ],
        "total": total,
        "page": page,
        "page_size": page_size,
    }
