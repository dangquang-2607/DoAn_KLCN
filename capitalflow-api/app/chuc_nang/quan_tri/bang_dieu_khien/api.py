"""
API cung cấp KPI và chỉ số tổng quan cho bảng điều khiển quản trị.
GET /admin/overview
"""
from fastapi import APIRouter, Depends
from sqlalchemy import case, func, select
from sqlalchemy.orm import Session

from app.dung_chung.http.phu_thuoc import get_db, require_admin
from app.chuc_nang.nguoi_dung.hoa_don_ai.luu_tru.invoice import Invoice
from app.chuc_nang.nguoi_dung.tai_chinh.giao_dich.luu_tru.giao_dich import Transaction
from app.chuc_nang.nguoi_dung.dang_nhap.luu_tru.nguoi_dung import User
from app.chuc_nang.quan_tri.phan_tich_van_hanh.api import local_today

router = APIRouter()


@router.get(
    "/overview",
    summary="Tổng quan hệ thống (Admin Dashboard KPIs)",
    description="Số tài khoản có thể truy cập/bị khóa, giao dịch và hóa đơn đã được người dùng xác nhận.",
)
def admin_overview(
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    today = local_today()
    # Mỗi bảng chỉ tổng hợp một lượt, thay vì chín truy vấn đếm riêng.
    user_counts = db.execute(select(
        func.sum(case((User.is_deleted == False, 1), else_=0)),
        func.sum(case(((User.is_deleted == False) & (User.is_active == True), 1), else_=0)),
        func.sum(case(((User.is_deleted == False) & (User.is_active == False), 1), else_=0)),
        func.sum(case((User.is_deleted == True, 1), else_=0)),
    )).one()
    total_users, active_users, banned_users, deleted_users = (int(value or 0) for value in user_counts)

    invoice_counts = db.execute(select(
        func.count(Invoice.id), func.sum(case((Invoice.status == "CONFIRMED", 1), else_=0)),
    )).one()
    total_invoices, completed_invoices = (int(value or 0) for value in invoice_counts)
    ocr_rate = (
        round((completed_invoices / total_invoices) * 100, 1)
        if total_invoices > 0
        else 0.0
    )

    transaction_counts = db.execute(select(
        func.count(Transaction.id),
        func.sum(case((Transaction.transaction_date == today, 1), else_=0)),
        func.sum(case(((Transaction.transaction_date >= today.replace(day=1)) &
                       (Transaction.transaction_date <= today), 1), else_=0)),
    )).one()
    total_tx, today_tx, month_tx = (int(value or 0) for value in transaction_counts)

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
        "transactions_today": today_tx,
        "transactions_this_month": month_tx,
        "today": today.isoformat(),
    }
