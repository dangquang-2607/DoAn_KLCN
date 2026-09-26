"""Dùng chung định nghĩa báo cáo: chỉ giao dịch NORMAL được tính là thu hoặc chi."""
from datetime import date
from decimal import Decimal
from sqlalchemy import select, func, case, extract, and_, or_
from sqlalchemy.orm import Session
from uuid import UUID
from app.modules.taichinh.persistence.budget import Budget
from app.modules.taichinh.persistence.transaction import Transaction as T
from app.modules.danhmuc.persistence.category import Category


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


def budget_progress(db: Session, budget: Budget) -> dict:
    query = select(func.coalesce(func.sum(-T.amount), 0)).where(
        T.user_id == budget.user_id, T.kind == "NORMAL", T.type == "EXPENSE",
        T.transaction_date.between(budget.start_date, budget.end_date),
    )
    if budget.category_id:
        query = query.where(T.category_id == budget.category_id)
    spent = Decimal(db.scalar(query) or 0)
    return _progress(budget, spent)


def _progress(budget, spent):
    usage = spent / budget.amount_limit * 100
    return dict(
        budget_id=budget.id, user_id=budget.user_id, category_id=budget.category_id,
        budget_name=budget.name, amount_limit=budget.amount_limit, currency=budget.currency,
        period_type=budget.period_type, start_date=budget.start_date, end_date=budget.end_date,
        warning_percent=budget.warning_percent, is_active=budget.is_active,
        spent_amount=spent, remaining_amount=budget.amount_limit-spent, usage_percent=usage,
        progress_status="EXCEEDED" if spent > budget.amount_limit else "WARNING" if usage >= budget.warning_percent else "SAFE",
    )


def budgets_progress(db, user_id):
    rows=db.execute(select(Budget,func.coalesce(func.sum(-T.amount),0)).outerjoin(T,and_(
        T.user_id==Budget.user_id,T.kind=="NORMAL",T.type=="EXPENSE",
        T.transaction_date>=Budget.start_date,T.transaction_date<=Budget.end_date,
        or_(Budget.category_id.is_(None),T.category_id==Budget.category_id)
    )).where(Budget.user_id==user_id).group_by(*Budget.__table__.columns).order_by(Budget.start_date.desc())).all()
    return [_progress(b,Decimal(spent)) for b,spent in rows]
