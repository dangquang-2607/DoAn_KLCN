"""Calendar periods and effective-dated settings for user-created budgets.

Periods are calculated from transactions on demand. No background job is needed
to roll a weekly, monthly, or yearly budget into its next period.
"""

import calendar
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal

from sqlalchemy import and_, func, or_, select
from sqlalchemy.orm import Session

from app.chuc_nang.nguoi_dung.tai_chinh.ngan_sach.luu_tru.ngan_sach import Budget, BudgetChange
from app.chuc_nang.nguoi_dung.tai_chinh.giao_dich.luu_tru.giao_dich import Transaction


def today_vn() -> date:
    return datetime.now(timezone(timedelta(hours=7))).date()


def period_bounds(budget: Budget, day: date) -> tuple[date, date] | None:
    if not budget.is_recurring:
        return (budget.start_date, budget.end_date) if budget.start_date <= day <= budget.end_date else None
    if budget.recurrence_end_date and day > budget.recurrence_end_date:
        return None
    day = max(day, budget.start_date)
    if budget.period_type == "WEEKLY":
        start = day - timedelta(days=day.weekday())
        end = start + timedelta(days=6)
    elif budget.period_type == "MONTHLY":
        start = day.replace(day=1)
        end = day.replace(day=calendar.monthrange(day.year, day.month)[1])
    elif budget.period_type == "YEARLY":
        start, end = date(day.year, 1, 1), date(day.year, 12, 31)
    else:
        return None
    start = max(start, budget.start_date)
    if budget.recurrence_end_date:
        end = min(end, budget.recurrence_end_date)
    return (start, end) if start <= end else None


def next_period_start(budget: Budget, today: date) -> date:
    bounds = period_bounds(budget, today)
    if not bounds:
        return budget.start_date
    return bounds[1] + timedelta(days=1)


def settings_on(budget: Budget, day: date) -> BudgetChange | Budget:
    settings = budget
    for change in budget.changes:
        if change.effective_date > day:
            break
        settings = change
    return settings


def active_windows(budget: Budget, start: date, end: date) -> list[tuple[date, date]]:
    if not budget.is_recurring:
        return [(start, end)]
    cursor = start
    state = settings_on(budget, start).is_active
    windows: list[tuple[date, date]] = []
    for change in budget.changes:
        if change.effective_date <= start:
            continue
        if change.effective_date > end:
            break
        if state and cursor < change.effective_date:
            windows.append((cursor, change.effective_date - timedelta(days=1)))
        cursor, state = change.effective_date, change.is_active
    if state and cursor <= end:
        windows.append((cursor, end))
    return windows


def progress_for_period(db: Session, budget: Budget, start: date, end: date, today: date) -> dict:
    snapshot = settings_on(budget, start) if budget.is_recurring else budget
    windows = active_windows(budget, start, min(end, today)) if start <= today else []
    spent = Decimal("0")
    if windows:
        conditions = [and_(Transaction.transaction_date >= left, Transaction.transaction_date <= right)
                      for left, right in windows]
        query = select(func.coalesce(func.sum(-Transaction.amount), 0)).where(
            Transaction.user_id == budget.user_id,
            Transaction.kind == "NORMAL",
            Transaction.type == "EXPENSE",
            or_(*conditions),
        )
        if budget.category_id:
            query = query.where(Transaction.category_id == budget.category_id)
        spent = Decimal(db.scalar(query) or 0)
    limit = Decimal(snapshot.amount_limit)
    warning = Decimal(snapshot.warning_percent)
    usage = spent / limit * 100
    current = settings_on(budget, today).is_active if budget.is_recurring else budget.is_active
    pending = next((change.effective_date for change in budget.changes
                    if change.effective_date > today and (
                        change.name != snapshot.name or change.amount_limit != snapshot.amount_limit
                        or change.warning_percent != snapshot.warning_percent)), None) if budget.is_recurring else None
    pending_state = next((change.effective_date for change in budget.changes
                          if change.effective_date > today and change.is_active != current), None) if budget.is_recurring else None
    ended = end < today or (budget.is_recurring and budget.recurrence_end_date == today and not budget.is_active)
    period_state = "COMPLETED" if ended else "UPCOMING" if start > today else "PAUSED" if not current else "CURRENT"
    return {
        "budget_id": budget.id, "user_id": budget.user_id, "category_id": budget.category_id,
        "budget_name": snapshot.name, "amount_limit": limit, "currency": budget.currency,
        "period_type": budget.period_type, "start_date": start, "end_date": end,
        "applies_from": budget.start_date,
        "warning_percent": warning, "is_active": current,
        "is_recurring": budget.is_recurring, "recurrence_end_date": budget.recurrence_end_date,
        "period_state": period_state,
        "configured_name": budget.name, "configured_amount_limit": budget.amount_limit,
        "configured_warning_percent": budget.warning_percent, "configured_is_active": budget.is_active,
        "next_effective_date": pending, "next_state_date": pending_state,
        "spent_amount": spent, "remaining_amount": limit - spent, "usage_percent": usage,
        "progress_status": "EXCEEDED" if spent > limit else "WARNING" if usage >= warning else "SAFE",
    }


def current_progress(db: Session, budget: Budget, today: date | None = None) -> dict | None:
    today = today or today_vn()
    bounds = period_bounds(budget, today)
    if not bounds:
        return None
    return progress_for_period(db, budget, *bounds, today)


def history_for_year(db: Session, budget: Budget, year: int, today: date | None = None) -> list[dict]:
    today = today or today_vn()
    if not budget.is_recurring:
        return [progress_for_period(db, budget, budget.start_date, budget.end_date, today)] if (
            budget.end_date < today and budget.end_date.year == year
        ) else []
    day = max(budget.start_date, date(year, 1, 1))
    ended_today = budget.recurrence_end_date == today and not budget.is_active
    last = min(today if ended_today else today - timedelta(days=1), date(year, 12, 31))
    if budget.recurrence_end_date:
        last = min(last, budget.recurrence_end_date)
    items: list[dict] = []
    while day <= last:
        bounds = period_bounds(budget, day)
        if not bounds:
            break
        start, end = bounds
        if (end < today or (ended_today and end == today)) and end.year == year:
            items.append(progress_for_period(db, budget, start, end, today))
        day = end + timedelta(days=1)
    return items
