from datetime import date
from fastapi import APIRouter, Depends
from sqlalchemy import func, select, text
from sqlalchemy.orm import Session
from app.api.dependencies import get_current_user, get_db
from app.models.account import Account
from app.models.transaction import Transaction
from app.models.user import User
from app.services.reporting import monthly_cashflow

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])

@router.get(
    "",
    summary="Dữ liệu tổng quan Dashboard (Dashboard Overview)",
    description=(
        "🇻🇳 **Mô tả**: Lấy dữ liệu tổng quan cho màn hình chính: tổng tài sản ròng, "
        "thu nhập, chi tiêu, dòng tiền trong tháng và 5 giao dịch gần nhất.\n\n"
        "🇬🇧 **Description**: Retrieve dashboard metrics: total net worth, monthly income, "
        "expenses, net cashflow, and the 5 most recent transactions."
    ),
)
def dashboard(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    today = date.today()
    month, year = today.month, today.year

    net_worth = db.scalar(select(func.coalesce(func.sum(Account.balance), 0)).where(Account.user_id == user.id)) or 0

    rows = monthly_cashflow(db, user.id, month, year)
    cf = rows[0] if rows else {"income": 0, "expense": 0}
    income_month, expense_month = cf["income"], cf["expense"]
    net_cash_flow = income_month - expense_month

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
