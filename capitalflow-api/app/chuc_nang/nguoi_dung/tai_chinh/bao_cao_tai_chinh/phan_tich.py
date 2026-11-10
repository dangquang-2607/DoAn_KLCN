"""Cung cấp REST API phân tích dòng tiền và xu hướng tài chính.

Vai trò: chuyển bộ lọc HTTP thành truy vấn reporting dành riêng cho người dùng hiện tại.
Đầu vào: khoảng thời gian, current user và DB session.
Đầu ra: dữ liệu tổng hợp cho biểu đồ/phân tích.
Ràng buộc: không trộn dữ liệu giữa người dùng và không tự định nghĩa lại công thức báo cáo.
"""

from datetime import date, timedelta
from typing import Literal
import calendar
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.orm import Session
from app.dung_chung.http.phu_thuoc import get_current_user, get_db
from app.chuc_nang.nguoi_dung.dang_nhap.luu_tru.nguoi_dung import User
from app.chuc_nang.nguoi_dung.tai_chinh.giao_dich.luu_tru.giao_dich import Transaction
from app.chuc_nang.nguoi_dung.tai_chinh.giao_dich.filters import with_account_display
from app.chuc_nang.nguoi_dung.danh_muc.luu_tru.danh_muc import Category
from app.chuc_nang.nguoi_dung.tai_chinh.ngan_sach.ky_han import today_vn
from app.chuc_nang.nguoi_dung.tai_chinh.bao_cao_tai_chinh.dich_vu import (
    cashflow_range, cashflow_trend_range, category_cashflow_range, expense_category_breakdown,
    monthly_cashflow, overview_expense_categories,
)

router = APIRouter(prefix="/analytics", tags=["Analytics"])

@router.get(
    "",
    summary="Phân tích báo cáo tài chính (Financial Analytics)",
    description=(
        "🇻🇳 **Mô tả**: Báo cáo phân tích tài chính chi tiết theo tháng: tổng quan thu/chi/dòng tiền ròng, "
        "cơ cấu thu chi theo từng danh mục và biểu đồ xu hướng 6 tháng gần nhất.\n\n"
        "🇬🇧 **Description**: Detailed monthly financial analysis: cashflow summary (income, expenses, net), "
        "income and expense breakdown by category, and 6-month historical trend."
    ),
)
def get_analytics(
    month: int | None = Query(None, ge=1, le=12, description="[VI] Tháng phân tích (1-12) | [EN] Month (1-12)"),
    year: int | None = Query(None, ge=1900, le=9999, description="[VI] Năm phân tích (YYYY) | [EN] Year (YYYY)"),
    start_date: date | None = Query(None),
    end_date: date | None = Query(None),
    scope: str | None = Query(None, pattern="^all$"),
    comparison: Literal["previous_period", "previous_month"] | None = Query(None),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    today = today_vn()
    if bool(start_date) != bool(end_date):
        raise HTTPException(status_code=422, detail="Cần cung cấp cả ngày bắt đầu và ngày kết thúc")
    if scope == "all":
        first = db.scalar(select(func.min(Transaction.transaction_date)).where(
            Transaction.user_id == user.id, Transaction.kind == "NORMAL",
            Transaction.include_in_reports == True, Transaction.transaction_date <= today))
        start, end = min(first, today) if first else today, today
    elif start_date and end_date:
        if start_date > end_date:
            raise HTTPException(status_code=422, detail="Ngày bắt đầu phải trước ngày kết thúc")
        if (end_date - start_date).days > 366:
            raise HTTPException(status_code=422, detail="Khoảng báo cáo tối đa 367 ngày")
        start, end = start_date, end_date
    else:
        m, y = month or today.month, year or today.year
        start = date(y, m, 1)
        end = date(y, m, calendar.monthrange(y, m)[1])

    days = (end - start).days + 1
    calendar_comparison = comparison == "previous_month" or (
        comparison is None and not start_date and scope is None
    )
    previous_available = scope != "all" and (
        start.replace(day=1) > date.min if calendar_comparison else start.toordinal() > days
    )
    previous_summary = {"income": 0.0, "expense": 0.0, "net": 0.0}
    previous_expense_by_category: dict[str, float] = {}
    if previous_available:
        if calendar_comparison:
            previous_end = start.replace(day=1) - timedelta(days=1)
            previous_start = previous_end.replace(day=1)
        else:
            previous_end = start - timedelta(days=1)
            previous_start = previous_end - timedelta(days=days - 1)
        previous_summary = cashflow_range(db, user.id, previous_start, previous_end)
        previous_expense_by_category = category_cashflow_range(
            db, user.id, previous_start, previous_end, kinds=("EXPENSE",),
        )["EXPENSE"]
    summary = cashflow_range(db, user.id, start, end)
    by_category = category_cashflow_range(db, user.id, start, end)

    return {
        "period": {"start_date": start, "end_date": end},
        "summary": summary,
        "previous_period_available": previous_available,
        "previous_summary": previous_summary,
        "income_by_category": by_category["INCOME"],
        "expense_by_category": by_category["EXPENSE"],
        "expense_categories": expense_category_breakdown(db, user.id, start, end),
        "previous_expense_by_category": previous_expense_by_category,
        "period_trend": cashflow_trend_range(db, user.id, start, end),
        "trend": [{"month": f"Tháng {row['month']}/{row['year']}", "income": float(row["income"]), "expense": float(row["expense"])}
                  for row in reversed(monthly_cashflow(db, user.id)[:6])],
    }


@router.get("/monthly-trend")
def monthly_trend(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    today = today_vn()
    history_start = today.replace(day=1)
    for _ in range(3):
        history_start = (history_start - timedelta(days=1)).replace(day=1)
    return {"through": today, "days": cashflow_trend_range(db, user.id, history_start, today, daily=True),
            "expense_categories": overview_expense_categories(db, user.id, today)}


def _export_rows(
    start_date: date | None, end_date: date | None, scope: str | None,
    db: Session, user: User,
):
    if scope == "all":
        first = db.scalar(select(func.min(Transaction.transaction_date)).where(
            Transaction.user_id == user.id, Transaction.kind == "NORMAL",
            Transaction.include_in_reports == True, Transaction.transaction_date <= today_vn()))
        end_date = today_vn()
        start_date = min(first, end_date) if first else end_date
    if not start_date or not end_date or start_date > end_date or (scope != "all" and (end_date - start_date).days > 366):
        raise HTTPException(status_code=422, detail="Khoảng báo cáo không hợp lệ hoặc vượt quá 367 ngày")
    rows = db.execute(
        with_account_display(select(Transaction)).add_columns(Category.name)
        .outerjoin(Category, Category.id == Transaction.category_id)
        .where(Transaction.user_id == user.id, Transaction.transaction_date.between(start_date, end_date),
               Transaction.kind == 'NORMAL', Transaction.include_in_reports == True,
               Transaction.transaction_date <= today_vn())
        .order_by(Transaction.transaction_date.desc(), Transaction.created_at.desc(), Transaction.id)
    ).all()
    return start_date, end_date, rows


@router.get("/export-data")
def export_analytics_data(
    start_date: date | None = Query(None),
    end_date: date | None = Query(None),
    scope: str | None = Query(None, pattern="^all$"),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Dữ liệu đầy đủ của kỳ để client tạo Excel, vẫn giới hạn theo current user."""
    start_date, end_date, rows = _export_rows(start_date, end_date, scope, db, user)
    return {
        "period": {"start_date": start_date, "end_date": end_date},
        "transactions": [
            {
                "id": transaction.id,
                "account_id": transaction.account_id,
                "invoice_id": transaction.invoice_id,
                "wallet_entry_id": transaction.wallet_entry_id,
                "include_in_reports": transaction.include_in_reports,
                "note": transaction.note or "",
                "transaction_date": transaction.transaction_date,
                "type": transaction.type, "kind": transaction.kind,
                "account_name": account_name,
                "category_id": transaction.category_id,
                "category_name": category_name or "Không phân loại",
                "amount": str(transaction.amount), "currency": currency,
                "description": transaction.description or "", "source": transaction.source,
            }
            for transaction, account_name, currency, category_name in rows
        ],
    }
