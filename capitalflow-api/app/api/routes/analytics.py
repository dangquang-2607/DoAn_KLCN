from datetime import date
from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.orm import Session
from app.api.dependencies import get_current_user, get_db
from app.models.user import User

router = APIRouter(prefix="/analytics", tags=["Analytics"])

@router.get("")
def get_analytics(
    month: int | None = None,
    year: int | None = None,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    today = date.today()
    m = month or today.month
    y = year or today.year

    # Thống kê tổng quan từ view
    q_cf = text("SELECT * FROM dbo.vw_monthly_cashflow WHERE user_id = :u_id AND month_start = DATEFROMPARTS(:y, :m, 1)")
    cf = db.execute(q_cf, {"u_id": user.id, "m": m, "y": y}).mappings().first()
    
    # Biểu đồ chi tiêu theo danh mục
    q_cat = text("SELECT category_name, total_spent FROM dbo.vw_monthly_category_spending WHERE user_id = :u_id AND month_start = DATEFROMPARTS(:y, :m, 1) ORDER BY total_spent DESC")
    cat_spending = db.execute(q_cat, {"u_id": user.id, "m": m, "y": y}).mappings().all()

    expense_by_category = {row["category_name"] or "Khác": float(abs(row["total_spent"])) for row in cat_spending}

    # Xu hướng 6 tháng gần nhất (mock query until full view available, or just query vw_monthly_cashflow for 6 months)
    q_trend = text("SELECT MONTH(month_start) AS transaction_month, total_income, total_expense FROM dbo.vw_monthly_cashflow WHERE user_id = :u_id ORDER BY month_start DESC OFFSET 0 ROWS FETCH NEXT 6 ROWS ONLY")
    trend_data = db.execute(q_trend, {"u_id": user.id}).mappings().all()
    trend = [
        {
            "month": f"Tháng {r['transaction_month']}",
            "income": float(r['total_income']),
            "expense": float(abs(r['total_expense'])),
        }
        for r in reversed(trend_data)
    ]

    return {
        "summary": {
            "income": float(cf["total_income"]) if cf else 0.0,
            "expense": float(abs(cf["total_expense"])) if cf else 0.0,
            "net": float(cf["net_cashflow"]) if cf else 0.0,
        },
        "expense_by_category": expense_by_category,
        "trend": trend,
    }
