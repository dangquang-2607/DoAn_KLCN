from datetime import date
from fastapi import APIRouter, Depends, Query
from sqlalchemy import text
from sqlalchemy.orm import Session
from app.api.dependencies import get_current_user, get_db
from app.models.user import User
from app.services.reporting import monthly_cashflow, category_spending

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
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    today = date.today()
    m = month or today.month
    y = year or today.year

    rows = monthly_cashflow(db, user.id, m, y)
    cf = rows[0] if rows else {"income": 0, "expense": 0}
    return {
        "summary": {"income": float(cf["income"]), "expense": float(cf["expense"]), "net": float(cf["income"]-cf["expense"])},
        "expense_by_category": category_spending(db, user.id, m, y),
        "trend": [{"month": f"Tháng {row['month']}/{row['year']}", "income": float(row["income"]), "expense": float(row["expense"])}
                  for row in reversed(monthly_cashflow(db, user.id)[:6])],
    }
