"""Dùng chung định nghĩa báo cáo: chỉ giao dịch NORMAL được tính là thu hoặc chi."""
from datetime import date, timedelta
from decimal import Decimal
from fastapi import HTTPException
from sqlalchemy import select, func, case, extract
from sqlalchemy.orm import Session
from uuid import UUID
from app.chuc_nang.nguoi_dung.tai_chinh.ngan_sach.luu_tru.ngan_sach import Budget
from app.chuc_nang.nguoi_dung.tai_chinh.ngan_sach.ky_han import (
    current_progress, period_bounds, progress_for_period, progress_for_periods, today_vn,
)
from sqlalchemy.orm import selectinload
from app.chuc_nang.nguoi_dung.tai_chinh.giao_dich.luu_tru.giao_dich import Transaction as T
from app.chuc_nang.nguoi_dung.danh_muc.luu_tru.danh_muc import Category


def monthly_cashflow(db: Session, user_id: UUID, month: int | None = None, year: int | None = None) -> list[dict]:
    today = today_vn()
    y, m = extract("year", T.transaction_date), extract("month", T.transaction_date)
    query = select(
        y.label("year"), m.label("month"),
        func.sum(case((T.type == "INCOME", T.amount), else_=0)).label("income"),
        func.sum(case((T.type == "EXPENSE", -T.amount), else_=0)).label("expense"),
    ).where(T.user_id == user_id, T.kind == "NORMAL", T.include_in_reports == True,
            T.transaction_date <= today)
    periods = []
    if month is not None:
        if year is None:
            raise ValueError("year is required when month is provided")
        start = date(year, month, 1)
        end = date(year+1,1,1) if month==12 and year<9999 else date(year,month+1,1) if month<12 else None
        query = query.where(T.transaction_date >= start)
        query = query.where(T.transaction_date < end) if end else query
    else:
        cursor = today.replace(day=1)
        for _ in range(6):
            periods.append(cursor)
            if cursor == date.min:
                break
            cursor = (cursor - timedelta(days=1)).replace(day=1)
        query = query.where(T.transaction_date >= periods[-1])
    query = query.group_by(y, m).order_by(y.desc(), m.desc())
    rows = db.execute(query).mappings().all()
    if month is None:
        by_month = {(int(row["year"]), int(row["month"])): dict(row) for row in rows}
        return [by_month.get((day.year, day.month), {
            "year": day.year, "month": day.month, "income": Decimal("0"), "expense": Decimal("0")
        }) for day in periods]
    return [dict(row) for row in rows]


def _category_totals(rows) -> dict[str, float]:
    totals: dict[str, Decimal] = {}
    for name, amount in rows:
        label = name or "Khác"
        totals[label] = totals.get(label, Decimal("0")) + Decimal(amount)
    return {name: float(amount) for name, amount in totals.items()}


def cashflow_range(db: Session, user_id: UUID, start: date, end: date) -> dict[str, float]:
    row = db.execute(
        select(
            func.coalesce(func.sum(case((T.type == "INCOME", T.amount), else_=0)), 0),
            func.coalesce(func.sum(case((T.type == "EXPENSE", -T.amount), else_=0)), 0),
        ).where(
            T.user_id == user_id,
            T.kind == "NORMAL", T.include_in_reports == True,
            T.transaction_date.between(start, end),
            T.transaction_date <= today_vn(),
        )
    ).one()
    income, expense = Decimal(row[0]), Decimal(row[1])
    return {"income": float(income), "expense": float(expense), "net": float(income - expense)}


def _category_cashflow_query(
    user_id: UUID, start: date, end: date, *,
    kinds: tuple[str, ...],
):
    return (
        select().select_from(T)
        .outerjoin(Category, Category.id == T.category_id)
        .where(
            T.user_id == user_id, T.kind == "NORMAL", T.include_in_reports == True, T.type.in_(kinds),
            T.transaction_date.between(start, end),
            T.transaction_date <= today_vn(),
        )
    )


def category_cashflow_range(
    db: Session, user_id: UUID, start: date, end: date, *,
    kinds: tuple[str, ...] = ("INCOME", "EXPENSE"),
) -> dict[str, dict[str, float]]:
    rows = db.execute(
        _category_cashflow_query(user_id, start, end, kinds=kinds)
        .add_columns(T.type, Category.name, func.sum(case((T.type == "EXPENSE", -T.amount), else_=T.amount)))
        .group_by(T.type, Category.name)
    ).all()
    return {kind: _category_totals((name, amount) for row_kind, name, amount in rows if row_kind == kind)
            for kind in kinds}


def expense_category_breakdown(db: Session, user_id: UUID, start: date, end: date) -> list[dict]:
    rows = db.execute(
        _category_cashflow_query(user_id, start, end, kinds=("EXPENSE",))
        .add_columns(Category.id, Category.name, Category.icon, Category.color, func.sum(-T.amount))
        .group_by(Category.id, Category.name, Category.icon, Category.color)
    ).all()
    return [
        {"id": category_id, "name": name or "Không phân loại", "icon": icon, "color": color, "amount": float(amount)}
        for category_id, name, icon, color, amount in rows
    ]


def overview_expense_categories(db: Session, user_id: UUID, today: date) -> list[dict]:
    week = today - timedelta(days=today.weekday())
    month = today.replace(day=1)
    rows = db.execute(
        select(Category.id, Category.name, Category.icon, Category.color,
               func.sum(case((T.transaction_date >= week, -T.amount), else_=0)),
               func.sum(case((T.transaction_date >= month, -T.amount), else_=0)))
        .select_from(T).outerjoin(Category, Category.id == T.category_id)
        .where(T.user_id == user_id, T.kind == "NORMAL", T.include_in_reports == True,
               T.type == "EXPENSE", T.transaction_date.between(min(week, month), today))
        .group_by(Category.id, Category.name, Category.icon, Category.color)
    )
    return [{"id": str(category_id) if category_id else "uncategorized", "name": name or "Khác",
             "icon": icon, "color": color, "week": float(weekly), "month": float(monthly)}
            for category_id, name, icon, color, weekly, monthly in rows]


def cashflow_trend_range(db: Session, user_id: UUID, start: date, end: date, *, daily: bool = False) -> list[dict]:
    """Return points within the selected range, using the same NORMAL-only rule as totals."""
    rows = db.execute(
        select(
            T.transaction_date,
            func.coalesce(func.sum(case((T.type == "INCOME", T.amount), else_=0)), 0),
            func.coalesce(func.sum(case((T.type == "EXPENSE", -T.amount), else_=0)), 0),
        ).where(
            T.user_id == user_id, T.kind == "NORMAL", T.include_in_reports == True,
            T.transaction_date.between(start, end),
            T.transaction_date <= today_vn(),
        ).group_by(T.transaction_date).order_by(T.transaction_date)
    ).all()
    duration = (end - start).days + 1
    step = "day" if daily or duration <= 31 else "week" if duration <= 100 else "month" if duration <= 730 else "quarter"
    def bucket_for(day: date) -> date:
        if step == "day":
            return day
        if step == "week":
            return day - timedelta(days=day.weekday())
        if step == "month":
            return day.replace(day=1)
        return day.replace(month=((day.month - 1) // 3) * 3 + 1, day=1)

    grouped: dict[date, dict] = {}
    cursor = bucket_for(start)
    while cursor <= end:
        bucket = bucket_for(cursor)
        grouped.setdefault(bucket, {"date": bucket.isoformat(), "income": Decimal("0"), "expense": Decimal("0")})
        if step in ("day", "week"):
            delta = 1 if step == "day" else 7
            if (end - cursor).days < delta:
                break
            cursor += timedelta(days=delta)
        else:
            next_month = cursor.month + (1 if step == "month" else 3)
            next_year = cursor.year + (next_month - 1) // 12
            if next_year > 9999:
                break
            cursor = date(next_year, (next_month - 1) % 12 + 1, 1)
    for day, income, expense in rows:
        bucket = bucket_for(day)
        point = grouped.setdefault(bucket, {"date": bucket.isoformat(), "income": Decimal("0"), "expense": Decimal("0")})
        point["income"] += Decimal(income)
        point["expense"] += Decimal(expense)
    cumulative = Decimal("0")
    points = []
    for _, point in sorted(grouped.items()):
        point["net"] = point["income"] - point["expense"]
        cumulative += point["net"]
        point["cumulative"] = cumulative
        points.append({
            "date": point["date"], "income": float(point["income"]), "expense": float(point["expense"]),
            "net": float(point["net"]), "cumulative": float(point["cumulative"]),
        })
    return points


def budget_progress(db: Session, budget: Budget) -> dict:
    today = today_vn()
    current = current_progress(db, budget, today)
    if current:
        return current
    # An expired one-time budget remains readable by ID as a historical record.
    end = budget.recurrence_end_date or budget.end_date
    bounds = period_bounds(budget, end) if budget.is_recurring else (budget.start_date, budget.end_date)
    if bounds is None:
        raise HTTPException(409, "Kỳ ngân sách không hợp lệ")
    start, end = bounds
    return progress_for_period(db, budget, start, end, today)




def budgets_progress(db, user_id):
    today = today_vn()
    budgets = db.scalars(select(Budget).options(selectinload(Budget.changes)).where(
        Budget.user_id == user_id
    ).order_by(Budget.start_date.desc())).all()
    periods = []
    for budget in budgets:
        if budget.is_recurring and budget.recurrence_end_date == today and not budget.is_active:
            continue
        bounds = period_bounds(budget, max(today, budget.start_date))
        if bounds:
            periods.append((budget, *bounds))
    return progress_for_periods(db, user_id, periods, today)
