"""Cung cấp dữ liệu tổng quan tài chính cho bảng điều khiển người dùng.

Vai trò: tổng hợp số dư, thu chi, ngân sách và hoạt động gần đây từ reporting/services.
Đầu vào: current user, thời gian tham chiếu và DB session.
Đầu ra: response dashboard đã giới hạn theo người dùng.
Ràng buộc: dùng chung định nghĩa số liệu với reporting để tránh lệch dữ liệu giữa màn hình.
"""

from fastapi import APIRouter, Depends
from sqlalchemy import func, select, text
from sqlalchemy.orm import Session
from app.dung_chung.http.phu_thuoc import get_current_user, get_db
from app.chuc_nang.nguoi_dung.tai_chinh.vi_tai_khoan.luu_tru.account import Account
from app.chuc_nang.nguoi_dung.tai_chinh.giao_dich.luu_tru.giao_dich import Transaction
from app.chuc_nang.nguoi_dung.dang_nhap.luu_tru.nguoi_dung import User
from app.chuc_nang.nguoi_dung.tai_chinh.bao_cao_tai_chinh.dich_vu import cashflow_range
from app.chuc_nang.nguoi_dung.tai_chinh.ngan_sach.ky_han import today_vn

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])

@router.get(
    "",
    summary="Dữ liệu tổng quan Dashboard (Dashboard Overview)",
    description=(
        "🇻🇳 **Mô tả**: Lấy dữ liệu tổng quan cho màn hình chính: tổng tài sản ròng, "
        "thu nhập, chi tiêu, dòng tiền trong tháng và 5 giao dịch gần nhất.\n\n"
        "🇬🇧 **Description**: Retrieve dashboard metrics: total net worth, monthly income, "
        "expenses, net cashflow, and the 5 most recent transactions."
    ),
)
def dashboard(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    today = today_vn()
    month, year = today.month, today.year

    net_worth = db.scalar(select(func.coalesce(func.sum(Account.balance), 0)).where(Account.user_id == user.id, Account.is_active == True, Account.exclude_from_total == False)) or 0

    cf = cashflow_range(db, user.id, today.replace(day=1), today)
    income_month, expense_month = cf["income"], cf["expense"]
    net_cash_flow = income_month - expense_month

    recent = db.scalars(
        select(Transaction)
        .where(Transaction.user_id == user.id)
        .order_by(Transaction.transaction_date.desc(), Transaction.created_at.desc())
        .limit(5)
    ).all()

    return {
        "net_worth": float(net_worth),
        "income_this_month": float(income_month),
        "expense_this_month": float(expense_month),
        "net_cash_flow": float(net_cash_flow),
        "period": {"month": month, "year": year},
        "recent_transactions": [
            {
                "id": str(t.id),
                "description": t.description,
                "amount": float(t.amount),
                "type": t.type,
                "kind": t.kind,
                "transaction_date": str(t.transaction_date),
            }
            for t in recent
        ],
    }
