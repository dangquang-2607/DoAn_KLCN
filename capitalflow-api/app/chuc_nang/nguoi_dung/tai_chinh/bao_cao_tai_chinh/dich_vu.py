"""Dùng chung định nghĩa báo cáo: chỉ giao dịch NORMAL được tính là thu hoặc chi."""
from datetime import date, timedelta
from decimal import Decimal
from sqlalchemy import select, func, case, extract
from sqlalchemy.orm import Session
from uuid import UUID
from app.chuc_nang.nguoi_dung.tai_chinh.ngan_sach.luu_tru.ngan_sach import Budget
from app.chuc_nang.nguoi_dung.tai_chinh.ngan_sach.ky_han import current_progress, progress_for_period, period_bounds, today_vn
from sqlalchemy.orm import selectinload
from app.chuc_nang.nguoi_dung.tai_chinh.giao_dich.luu_tru.giao_dich import Transaction as T
from app.chuc_nang.nguoi_dung.danh_muc.luu_tru.danh_muc import Category


def monthly_cashflow(db: Session, user_id: UUID, month: int | None = None, year: int | None = None) -> list[dict]:
    y, m = extract("year", T.transaction_date), extract("month", T.transaction_date)
    query = select(
        y.label("year"), m.label("month"),
        func.sum(case((T.type == "INCOME", T.amount), else_=0)).label("income"),
        func.sum(case((T.type == "EXPENSE", -T.amount), else_=0)).label("expense"),
    ).where(T.user_id == user_id, T.kind == "NORMAL")
    if month is not None:
        if year is None:
            raise ValueError("year is required when month is provided")
        start = date(year, month, 1)
        end = date(year+1,1,1) if month==12 and year<9999 else date(year,month+1,1) if month<12 else None
        query = query.where(T.transaction_date >= start)
        query = query.where(T.transaction_date < end) if end else query
    query = query.group_by(y, m).order_by(y.desc(), m.desc())
    if month is None: query = query.limit(6)
    rows = db.execute(query).mappings().all()
    return [dict(row) for row in rows]


def category_spending(db: Session, user_id: UUID, month: int, year: int) -> dict[str, float]:
    start=date(year,month,1)
    end=date(year+1,1,1) if month==12 and year<9999 else date(year,month+1,1) if month<12 else date.max
    rows = db.execute(select(Category.name, func.sum(-T.amount)).outerjoin(
        Category, Category.id == T.category_id
    ).where(T.user_id == user_id, T.kind == "NORMAL", T.type == "EXPENSE",
            T.transaction_date >= start, T.transaction_date < end).group_by(Category.name)).all()
    return {name or "Khác": float(amount) for name, amount in rows}


def cashflow_range(db: Session, user_id: UUID, start: date, end: date) -> dict[str, float]:
    row = db.execute(
        select(
            func.coalesce(func.sum(case((T.type == "INCOME", T.amount), else_=0)), 0),
            func.coalesce(func.sum(case((T.type == "EXPENSE", -T.amount), else_=0)), 0),
        ).where(
            T.user_id == user_id,
            T.kind == "NORMAL",
            T.transaction_date.between(start, end),
        )
    ).one()
    income, expense = Decimal(row[0]), Decimal(row[1])
    return {"income": float(income), "expense": float(expense), "net": float(income - expense)}


def category_spending_range(db: Session, user_id: UUID, start: date, end: date) -> dict[str, float]:
    rows = db.execute(
        select(Category.name, func.sum(-T.amount))
        .outerjoin(Category, Category.id == T.category_id)
        .where(
            T.user_id == user_id, T.kind == "NORMAL", T.type == "EXPENSE",
            T.transaction_date.between(start, end),
        )
        .group_by(Category.name)
    ).all()
    return {name or "Khác": float(amount) for name, amount in rows}


def cashflow_trend_range(db: Session, user_id: UUID, start: date, end: date) -> list[dict]:
    """Return points within the selected range, using the same NORMAL-only rule as totals."""
    rows = db.execute(
        select(
            T.transaction_date,
            func.coalesce(func.sum(case((T.type == "INCOME", T.amount), else_=0)), 0),
            func.coalesce(func.sum(case((T.type == "EXPENSE", -T.amount), else_=0)), 0),
        ).where(
            T.user_id == user_id, T.kind == "NORMAL",
            T.transaction_date.between(start, end),
        ).group_by(T.transaction_date).order_by(T.transaction_date)
    ).all()
    duration = (end - start).days + 1
    step = "day" if duration <= 31 else "week" if duration <= 100 else "month" if duration <= 730 else "quarter"
    def bucket_for(day: date) -> date:
        if step == "day":
            return day
        if step == "week":
            return day - timedelta(days=day.weekday())
        if step == "month":
            return day.replace(day=1)
        return day.replace(month=((day.month - 1) // 3) * 3 + 1, day=1)

    grouped: dict[date, dict] = {}
    cursor = start
    while cursor <= end:
        bucket = bucket_for(cursor)
        grouped.setdefault(bucket, {"date": bucket.isoformat(), "income": 0.0, "expense": 0.0})
        if step in ("day", "week"):
            cursor += timedelta(days=1 if step == "day" else 7)
        else:
            next_month = cursor.month + (1 if step == "month" else 3)
            next_year = cursor.year + (next_month - 1) // 12
            cursor = date(next_year, (next_month - 1) % 12 + 1, 1)
    for day, income, expense in rows:
        bucket = bucket_for(day)
        point = grouped.setdefault(bucket, {"date": bucket.isoformat(), "income": 0.0, "expense": 0.0})
        point["income"] += float(income)
        point["expense"] += float(expense)
    cumulative = 0.0
    for point in grouped.values():
        point["net"] = point["income"] - point["expense"]
        cumulative += point["net"]
        point["cumulative"] = cumulative
    return list(grouped.values())


def budget_progress(db: Session, budget: Budget) -> dict:
    today = today_vn()
    current = current_progress(db, budget, today)
    if current:
        return current
    # An expired one-time budget remains readable by ID as a historical record.
    end = budget.recurrence_end_date or budget.end_date
    bounds = period_bounds(budget, end) if budget.is_recurring else (budget.start_date, budget.end_date)
    return progress_for_period(db, budget, *bounds, today)




def budgets_progress(db, user_id):
    today = today_vn()
    budgets = db.scalars(select(Budget).options(selectinload(Budget.changes)).where(
        Budget.user_id == user_id
    ).order_by(Budget.start_date.desc())).all()
    return [item for budget in budgets
            if not (budget.is_recurring and budget.recurrence_end_date == today
                    and not budget.is_active)
            if (item := current_progress(db, budget, today)) is not None]
