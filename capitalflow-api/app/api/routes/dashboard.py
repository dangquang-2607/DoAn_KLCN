from datetime import date
from fastapi import APIRouter, Depends
from sqlalchemy import func, select, text
from sqlalchemy.orm import Session
from app.api.dependencies import get_current_user, get_db
from app.models.account import Account
from app.models.transaction import Transaction
from app.models.user import User

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])

@router.get("")
def dashboard(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    today = date.today()
    month, year = today.month, today.year

    net_worth = db.scalar(select(func.coalesce(func.sum(Account.balance), 0)).where(Account.user_id == user.id)) or 0

    # Query view for cashflow V3
    query = text("SELECT total_income, total_expense, net_cashflow FROM dbo.vw_monthly_cashflow WHERE user_id = :u_id AND month_start = DATEFROMPARTS(:y, :m, 1)")
    cf = db.execute(query, {"u_id": user.id, "m": month, "y": year}).mappings().first()
    
    income_month = cf["total_income"] if cf else 0
    expense_month = abs(cf["total_expense"]) if cf else 0
    net_cash_flow = cf["net_cashflow"] if cf else 0

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
                "transaction_date": str(t.transaction_date),
            }
            for t in recent
        ],
    }
