"""Kiểm tra danh mục và cảnh báo ngân sách dùng chung cho ví và sổ thu chi.

Các thao tác ghi thu chi nằm ở bookkeeping.py; số dư ví chỉ được thay đổi
qua wallet_api.py. Không còn nghiệp vụ cập nhật số dư accounts cũ.
"""
import uuid
from fastapi import HTTPException
from sqlalchemy import select, or_
from sqlalchemy.orm import Session

from app.chuc_nang.nguoi_dung.tai_chinh.giao_dich.luu_tru.giao_dich import Transaction, TransactionType
from app.chuc_nang.nguoi_dung.tai_chinh.ngan_sach.luu_tru.ngan_sach import Budget
from app.chuc_nang.nguoi_dung.danh_muc.luu_tru.danh_muc import Category
from app.chuc_nang.nguoi_dung.dang_nhap.luu_tru.nguoi_dung import User
from app.chuc_nang.nguoi_dung.tai_chinh.ngan_sach.canh_bao import emit_budget_alert


def _verify_category_ownership(db: Session, category_id: uuid.UUID, user_id: uuid.UUID, tx_type=None, *, allow_inactive: bool = False) -> None:
    """Kiểm tra quyền/loại; chỉ cho giữ danh mục đã ẩn trên chính giao dịch lịch sử."""
    query = select(Category).where(
        Category.id == category_id,
        or_(Category.owner_user_id == user_id, Category.owner_user_id.is_(None))
    )
    if not allow_inactive:
        # SQL Server bit không hỗ trợ cú pháp "IS 1" do .is_(True) sinh ra.
        query = query.where(Category.is_active == True)
    cat = db.scalar(query.with_hint(Category, "WITH (UPDLOCK, ROWLOCK)", dialect_name="mssql").execution_options(populate_existing=True))
    if not cat:
        raise HTTPException(
            status_code=400,
            detail="Danh mục không hợp lệ hoặc không thuộc quyền sở hữu của bạn"
        )
    if tx_type is not None and cat.type != tx_type:
        raise HTTPException(status_code=422, detail="Loại danh mục không khớp loại giao dịch")


def check_budget_alerts_background(db: Session, user_id: uuid.UUID, txn: Transaction):
    """
    Kiểm tra cảnh báo theo ngưỡng của ngân sách và hạn mức 100%.
    Được gọi từ worker BUDGET sau khi giao dịch đã được ghi nhận.
    """
    if txn.type != TransactionType.EXPENSE or txn.kind != "NORMAL":
        return

    tx_date = txn.transaction_date.date() if hasattr(txn.transaction_date, 'date') else txn.transaction_date
    from app.chuc_nang.nguoi_dung.tai_chinh.ngan_sach.ky_han import period_bounds, settings_on, today_vn

    today = today_vn()
    if tx_date > today or not txn.include_in_reports:
        return

    # Tìm các ngân sách đang hoạt động bao quát ngày giao dịch này
    q = select(Budget).where(
        Budget.user_id == user_id,
        Budget.start_date <= tx_date,
        ((Budget.is_recurring == True) & (
            (Budget.recurrence_end_date == None) | (Budget.recurrence_end_date >= tx_date)
        )) | ((Budget.is_recurring == False) & (Budget.end_date >= tx_date)),
    )
    if txn.category_id:
        q = q.where((Budget.category_id == txn.category_id) | (Budget.category_id == None))
    else:
        q = q.where(Budget.category_id == None)

    budgets = db.scalars(q.order_by(Budget.id).with_hint(
        Budget, 'WITH (UPDLOCK, ROWLOCK)', dialect_name='mssql')).all()
    if not budgets:
        return

    user = db.get(User, user_id)

    for b in budgets:
        try:
            if b.is_recurring and b.recurrence_end_date == today_vn() and not b.is_active:
                continue
            if not settings_on(b, tx_date).is_active:
                continue
            bounds = period_bounds(b, tx_date)
            if not bounds:
                continue
            from app.chuc_nang.nguoi_dung.tai_chinh.ngan_sach.ky_han import current_progress
            progress = current_progress(db, b, today)
            if progress and progress["period_state"] == "CURRENT":
                emit_budget_alert(db, b, progress, user)
        except Exception as e:
            raise RuntimeError("Budget alert scheduling failed") from None
