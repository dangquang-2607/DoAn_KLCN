"""
Admin Overview — Dashboard KPIs và chỉ số tổng quan hệ thống.
GET /admin/overview
"""
from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.api.dependencies import get_db, require_admin
from app.models.invoice import Invoice
from app.models.transaction import Transaction
from app.models.user import User

router = APIRouter()


@router.get(
    "/overview",
    summary="Tổng quan hệ thống (Admin Dashboard KPIs)",
    description="Lấy các chỉ số KPI tổng thể của hệ thống (active/banned users, tổng số giao dịch, tỷ lệ bóc tách OCR thành công).",
)
def admin_overview(
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    total_users = db.scalar(select(func.count(User.id)).where(User.is_deleted == False)) or 0
    active_users = db.scalar(select(func.count(User.id)).where(User.is_deleted == False, User.is_active == True)) or 0
    banned_users = db.scalar(select(func.count(User.id)).where(User.is_deleted == False, User.is_active == False)) or 0
    deleted_users = db.scalar(select(func.count(User.id)).where(User.is_deleted == True)) or 0

    total_invoices = db.scalar(select(func.count(Invoice.id))) or 0
    completed_invoices = (
        db.scalar(select(func.count(Invoice.id)).where(Invoice.status == "CONFIRMED")) or 0
    )
    ocr_rate = (
        round((completed_invoices / total_invoices) * 100, 1)
        if total_invoices > 0
        else 0.0
    )

    total_tx = db.scalar(select(func.count(Transaction.id))) or 0

    return {
        "users": {
            "total": total_users,
            "active": active_users,
            "banned": banned_users,
            "deleted": deleted_users,
        },
        "invoices": {
            "total": total_invoices,
            "completed": completed_invoices,
            "ocr_success_rate": ocr_rate,
        },
        "total_transactions": total_tx,
    }
