"""Cung cấp REST API phân tích dòng tiền và xu hướng tài chính.

Vai trò: chuyển bộ lọc HTTP thành truy vấn reporting dành riêng cho người dùng hiện tại.
Đầu vào: khoảng thời gian, current user và DB session.
Đầu ra: dữ liệu tổng hợp cho biểu đồ/phân tích.
Ràng buộc: không trộn dữ liệu giữa người dùng và không tự định nghĩa lại công thức báo cáo.
"""

from datetime import date, timedelta
import csv
import io
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import Response
from sqlalchemy import select
from sqlalchemy.orm import Session
from app.shared.http.dependencies import get_current_user, get_db
from app.modules.dangnhap.persistence.user import User
from app.modules.taichinh.persistence.transaction import Transaction
from app.modules.taichinh.persistence.account import Account
from app.modules.danhmuc.persistence.category import Category
from app.modules.taichinh.reporting.service import monthly_cashflow, category_spending, cashflow_range, category_spending_range

router = APIRouter(prefix="/analytics", tags=["Analytics"])

@router.get(
    "",
    summary="Phân tích báo cáo tài chính (Financial Analytics)",
    description=(
        "🇻🇳 **Mô tả**: Báo cáo phân tích tài chính chi tiết theo tháng: tổng quan thu/chi/dòng tiền ròng, "
        "cơ cấu chi tiêu theo từng danh mục và biểu đồ xu hướng 6 tháng gần nhất.\n\n"
        "🇬🇧 **Description**: Detailed monthly financial analysis: cashflow summary (income, expenses, net), "
        "category spending breakdown, and 6-month historical trend."
    ),
)
def get_analytics(
    month: int | None = Query(None, ge=1, le=12, description="[VI] Tháng phân tích (1-12) | [EN] Month (1-12)"),
    year: int | None = Query(None, ge=1900, le=9999, description="[VI] Năm phân tích (YYYY) | [EN] Year (YYYY)"),
    start_date: date | None = Query(None),
    end_date: date | None = Query(None),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    today = date.today()
    if bool(start_date) != bool(end_date):
        raise HTTPException(status_code=422, detail="Cần cung cấp cả ngày bắt đầu và ngày kết thúc")
    if start_date and end_date:
        if start_date > end_date:
            raise HTTPException(status_code=422, detail="Ngày bắt đầu phải trước ngày kết thúc")
        if (end_date - start_date).days > 366:
            raise HTTPException(status_code=422, detail="Khoảng báo cáo tối đa 367 ngày")
        start, end = start_date, end_date
    else:
        m, y = month or today.month, year or today.year
        start = date(y, m, 1)
        end = date(y + 1, 1, 1) - timedelta(days=1) if m == 12 else date(y, m + 1, 1) - timedelta(days=1)

    days = (end - start).days + 1
    previous_end = start - timedelta(days=1)
    previous_start = previous_end - timedelta(days=days - 1)
    summary = cashflow_range(db, user.id, start, end)

    return {
        "period": {"start_date": start, "end_date": end},
        "summary": summary,
        "previous_summary": cashflow_range(db, user.id, previous_start, previous_end),
        "expense_by_category": category_spending_range(db, user.id, start, end),
        "trend": [{"month": f"Tháng {row['month']}/{row['year']}", "income": float(row["income"]), "expense": float(row["expense"])}
                  for row in reversed(monthly_cashflow(db, user.id)[:6])],
    }


def _csv_safe(value) -> str:
    text_value = str(value or "")
    return "'" + text_value if text_value[:1] in ("=", "+", "-", "@", "\t", "\r") else text_value


@router.get("/export.csv")
def export_analytics_csv(
    start_date: date = Query(...),
    end_date: date = Query(...),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    if start_date > end_date or (end_date - start_date).days > 366:
        raise HTTPException(status_code=422, detail="Khoảng báo cáo không hợp lệ hoặc vượt quá 367 ngày")
    rows = db.execute(
        select(Transaction, Account.name, Category.name)
        .join(Account, Account.id == Transaction.account_id)
        .outerjoin(Category, Category.id == Transaction.category_id)
        .where(Transaction.user_id == user.id, Transaction.transaction_date.between(start_date, end_date))
        .order_by(Transaction.transaction_date.desc(), Transaction.created_at.desc())
    ).all()
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["Ngày", "Loại", "Tài khoản", "Danh mục", "Số tiền", "Diễn giải", "Nguồn"])
    for transaction, account_name, category_name in rows:
        writer.writerow([
            transaction.transaction_date.isoformat(), transaction.type,
            _csv_safe(account_name), _csv_safe(category_name or "Không phân loại"),
            transaction.amount, _csv_safe(transaction.description), transaction.source,
        ])
    return Response(
        content="\ufeff" + output.getvalue(),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="bao-cao-{start_date}-{end_date}.csv"'},
    )
