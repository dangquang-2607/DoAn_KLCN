"""Calendar periods and effective-dated settings for user-created budgets.

Periods are calculated from transactions on demand. No background job is needed
to roll a weekly, monthly, or yearly budget into its next period.
"""

import calendar
from bisect import bisect_left, bisect_right
from collections import defaultdict
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal, ROUND_DOWN, ROUND_HALF_UP
from itertools import accumulate

from fastapi import HTTPException
from sqlalchemy import func, or_, select
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
        end = start + timedelta(days=min(6, (date.max - start).days))
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
    if bounds[1] == date.max:
        raise HTTPException(422, "Không có kỳ ngân sách tiếp theo sau ngày tối đa")
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


def expense_scope(user_id):
    return (
        Transaction.user_id == user_id,
        Transaction.kind == "NORMAL",
        Transaction.include_in_reports == True,
        Transaction.type == "EXPENSE",
    )


def progress_for_period(db: Session, budget: Budget, start: date, end: date, today: date) -> dict:
    windows = active_windows(budget, start, min(end, today)) if start <= today else []
    spent = Decimal("0")
    if windows:
        conditions = [Transaction.transaction_date.between(left, right) for left, right in windows]
        query = select(func.coalesce(func.sum(-Transaction.amount), 0)).where(
            *expense_scope(budget.user_id), or_(*conditions),
        )
        if budget.category_id:
            query = query.where(Transaction.category_id == budget.category_id)
        spent = Decimal(db.scalar(query) or 0)
    return format_progress(budget, start, end, today, spent)


def progress_for_periods(db: Session, user_id, periods, today: date) -> list[dict]:
    """Read daily totals once and sum each period's existing active windows."""
    windows_by_period = [
        active_windows(budget, start, min(end, today)) if start <= today else []
        for budget, start, end in periods
    ]
    windows = [window for period_windows in windows_by_period for window in period_windows]
    series = defaultdict(lambda: defaultdict(Decimal))
    if windows:
        query = select(Transaction.category_id, Transaction.transaction_date,
                       func.sum(-Transaction.amount)).where(
            *expense_scope(user_id),
            Transaction.transaction_date.between(
                min(left for left, _ in windows), max(right for _, right in windows),
            ),
        ).group_by(Transaction.category_id, Transaction.transaction_date)
        categories = {budget.category_id for budget, _, _ in periods}
        if None not in categories:
            query = query.where(Transaction.category_id.in_(categories))
        for category, day, spent in db.execute(query):
            if category is not None:
                series[category][day] = spent
            if None in categories:
                series[None][day] += spent

    cumulative = {}
    for category, totals in series.items():
        days = sorted(totals)
        cumulative[category] = (days, list(accumulate((totals[day] for day in days), initial=Decimal("0.00"))))

    items = []
    for (budget, start, end), period_windows in zip(periods, windows_by_period):
        spent = Decimal("0")
        if period_windows:
            days, totals = cumulative.get(budget.category_id, ([], [Decimal("0.00")]))
            spent = sum((totals[bisect_right(days, right)] - totals[bisect_left(days, left)]
                         for left, right in period_windows), Decimal("0.00"))
        items.append(format_progress(budget, start, end, today, spent or Decimal("0")))
    return items


def format_progress(budget: Budget, start: date, end: date, today: date, spent: Decimal) -> dict:
    snapshot = settings_on(budget, start) if budget.is_recurring else budget
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
    period_days = (end - start).days + 1
    elapsed_days = max(0, (min(today, end) - start).days + 1)
    remaining_days = 0 if ended else max(0, (end - max(today, start)).days + 1)
    active_elapsed_days = sum(
        (right - left).days + 1
        for left, right in active_windows(budget, start, min(today, end))
    ) if elapsed_days else 0
    remaining = limit - spent
    # Round the daily allowance down so following it cannot exceed the balance.
    daily_allowance = (max(remaining, Decimal("0")) / remaining_days).quantize(
        Decimal("1"), rounding=ROUND_DOWN,
    ) if period_state == "CURRENT" and remaining_days else None
    average_daily_spent = (spent / active_elapsed_days).quantize(
        Decimal("0.01"), rounding=ROUND_HALF_UP,
    ) if active_elapsed_days else None
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
        "spent_amount": spent, "remaining_amount": remaining, "usage_percent": usage,
        "progress_status": "EXCEEDED" if spent > limit else "WARNING" if usage >= warning else "SAFE",
        "period_days": period_days, "elapsed_days": elapsed_days, "remaining_days": remaining_days,
        "active_elapsed_days": active_elapsed_days,
        "daily_allowance": daily_allowance, "average_daily_spent": average_daily_spent,
    }


def current_progress(db: Session, budget: Budget, today: date | None = None) -> dict | None:
    today = today or today_vn()
    bounds = period_bounds(budget, max(today, budget.start_date))
    if not bounds:
        return None
    return progress_for_period(db, budget, *bounds, today)


def historical_periods(budget: Budget, year: int, today: date):
    if not budget.is_recurring:
        if budget.end_date < today and budget.end_date.year == year:
            yield budget, budget.start_date, budget.end_date
        return
    day = max(budget.start_date, date(year, 1, 1))
    ended_today = budget.recurrence_end_date == today and not budget.is_active
    last = min(today if ended_today else today - timedelta(days=1), date(year, 12, 31))
    if budget.recurrence_end_date:
        last = min(last, budget.recurrence_end_date)
    while day <= last:
        bounds = period_bounds(budget, day)
        if not bounds:
            break
        start, end = bounds
        if (end < today or (ended_today and end == today)) and end.year == year:
            yield budget, start, end
        if end == date.max:
            break
        day = end + timedelta(days=1)
