"""Period-scoped, aggregate-only administration analytics.

Dates are transaction dates (not insert timestamps). No balances, amounts or
individual transactions leave this endpoint. Calendar weeks start on Monday.
"""
from datetime import date, datetime, timedelta, timezone
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import case, func, select
from sqlalchemy.orm import Session

from app.chuc_nang.nguoi_dung.dang_nhap.luu_tru.nguoi_dung import User
from app.chuc_nang.nguoi_dung.danh_muc.luu_tru.danh_muc import Category
from app.chuc_nang.nguoi_dung.tai_chinh.giao_dich.luu_tru.giao_dich import Transaction
from app.dung_chung.http.phu_thuoc import get_db, require_admin

router = APIRouter()


def local_today() -> date:
    return datetime.now(timezone(timedelta(hours=7))).date()


def period_start(day: date, unit: str) -> date:
    if unit == "month":
        return day.replace(day=1)
    if unit == "week":
        return day - timedelta(days=day.weekday())
    return day


def shift_period(start: date, unit: str, steps: int) -> date:
    if unit == "month":
        month = start.year * 12 + start.month - 1 + steps
        return date(month // 12, month % 12 + 1, 1)
    return start + timedelta(days=steps * (7 if unit == "week" else 1))


def date_scope(start: date, end: date):
    return (Transaction.transaction_date >= start) & (Transaction.transaction_date < end)


@router.get("/system/analytics", summary="Phân tích lịch sử sử dụng hệ thống")
def system_analytics(
    unit: Literal["day", "week", "month"] = "month",
    anchor: date | None = Query(None, description="Một ngày thuộc kỳ cần phân tích"),
    periods: int = Query(12, ge=3, le=12),
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    today = local_today()
    anchor = anchor or today
    if anchor > today or anchor < date(2000, 1, 1):
        raise HTTPException(422, "Chọn kỳ từ năm 2000 đến ngày hiện tại")
    start = period_start(anchor, unit)
    full_end = shift_period(start, unit, 1)
    end = min(full_end, today + timedelta(days=1))
    partial = full_end > today
    previous_start = shift_period(start, unit, -1)
    # Same elapsed calendar days for an unfinished period; never compare a
    # partial month to an entire preceding month. Cap both for shorter months.
    comparison_days = min((end - start).days, (start - previous_start).days)
    comparison_end = start + timedelta(days=comparison_days) if partial else end
    previous_end = previous_start + timedelta(days=comparison_days) if partial else start
    previous_count = db.scalar(select(func.count(Transaction.id)).where(date_scope(previous_start, previous_end))) or 0
    comparable_count = db.scalar(select(func.count(Transaction.id)).where(date_scope(start, comparison_end))) or 0

    normal = Transaction.kind == "NORMAL"
    income = normal & (Transaction.type == "INCOME")
    expense = normal & (Transaction.type == "EXPENSE")
    totals = db.execute(select(
        func.count(Transaction.id),
        func.count(func.distinct(Transaction.user_id)),
        func.sum(case((income, 1), else_=0)),
        func.sum(case((expense, 1), else_=0)),
        func.sum(case((Transaction.kind != "NORMAL", 1), else_=0)),
    ).where(date_scope(start, end))).one()
    total, users, income_count, expense_count, other_count = (int(v or 0) for v in totals)

    # Query grouped daily counts once; bucket in Python to stay portable across
    # SQL Server and SQLite. At most 12 months of aggregate rows, no raw records.
    starts = [shift_period(start, unit, -i) for i in reversed(range(periods))]
    daily = db.execute(select(Transaction.transaction_date, func.count(Transaction.id))
                       .where(date_scope(starts[0], end))
                       .group_by(Transaction.transaction_date)).all()
    bucket_counts = {day: 0 for day in starts}
    for day, count in daily:
        bucket = period_start(day, unit)
        bucket_counts[bucket] += count
    trend = [{"id": day.isoformat(), "start": day.isoformat(),
              "end": (min(shift_period(day, unit, 1), end) - timedelta(days=1)).isoformat(),
              "count": bucket_counts[day], "partial": shift_period(day, unit, 1) > today}
             for day in starts]

    top = db.execute(select(Category.name, func.count(Transaction.id).label("tx_count"))
                     .select_from(Transaction).outerjoin(Category, Transaction.category_id == Category.id)
                     .where(date_scope(start, end)).group_by(Category.name)
                     .order_by(func.count(Transaction.id).desc(), Category.name).limit(5)).all()
    # Retain the legacy fields for existing clients; new UI uses scoped metrics.
    month_start = today.replace(day=1)
    legacy = db.execute(select(
        func.count(Transaction.id),
        func.sum(case((Transaction.type == "INCOME", 1), else_=0)),
        func.sum(case((Transaction.type == "EXPENSE", 1), else_=0)),
        func.sum(case((date_scope(month_start, shift_period(month_start, "month", 1)), 1), else_=0)),
        func.count(func.distinct(case((date_scope(month_start, shift_period(month_start, "month", 1)), Transaction.user_id)))),
    )).one()
    all_total, all_income, all_expense, monthly, monthly_users = (int(v or 0) for v in legacy)
    return {
        "period": {"unit": unit, "start": start.isoformat(), "end": (end - timedelta(days=1)).isoformat(),
                   "calendar_end": (full_end - timedelta(days=1)).isoformat(), "partial": partial,
                   "today": today.isoformat(), "month": anchor.month, "year": anchor.year},
        "metrics": {"total": total, "active_users": users, "income_count": income_count,
                    "expense_count": expense_count, "other_count": other_count},
        "comparison": {"current": comparable_count, "previous": previous_count,
                       "change_pct": round((comparable_count - previous_count) / previous_count * 100, 1) if previous_count else None,
                       "current_start": start.isoformat(), "current_end": (comparison_end - timedelta(days=1)).isoformat(),
                       "previous_start": previous_start.isoformat(), "previous_end": (previous_end - timedelta(days=1)).isoformat()},
        "trend": trend,
        "transactions": {"total_all_time": all_total, "this_month": monthly,
                         "income_count": all_income, "expense_count": all_expense},
        "active_users_this_month": monthly_users,
        "top_categories": [{"name": name or "Không phân loại", "transaction_count": count} for name, count in top],
        "generated_at": datetime.now(timezone.utc).isoformat(),
    }
