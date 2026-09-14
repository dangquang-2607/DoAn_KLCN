import os

routes_dir = r"d:\code\DoAn_KLCN\capitalflow-api\app\api\routes"

accounts_py = """import uuid
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session
from app.api.dependencies import get_current_user, get_db
from app.models.account import Account
from app.models.user import User
from app.schemas.account import AccountCreate, AccountOut, AccountUpdate

router = APIRouter(prefix="/api/accounts", tags=["Accounts"])

@router.get("", response_model=list[AccountOut])
def list_accounts(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    accounts = db.scalars(select(Account).where(Account.user_id == user.id, Account.is_active == True).order_by(Account.created_at.desc())).all()
    return accounts

@router.post("", response_model=AccountOut, status_code=201)
def create_account(payload: AccountCreate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    acc = Account(user_id=user.id, **payload.model_dump())
    db.add(acc)
    db.commit()
    db.refresh(acc)
    return acc

@router.patch("/{acc_id}", response_model=AccountOut)
def update_account(acc_id: uuid.UUID, payload: AccountUpdate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    acc = db.scalar(select(Account).where(Account.id == acc_id, Account.user_id == user.id))
    if not acc:
        raise HTTPException(status_code=404, detail="Không tìm thấy tài khoản")
    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(acc, k, v)
    db.commit()
    db.refresh(acc)
    return acc
"""

categories_py = """import uuid
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, or_
from sqlalchemy.orm import Session
from app.api.dependencies import get_current_user, get_db
from app.models.category import Category
from app.models.user import User
from app.schemas.category import CategoryCreate, CategoryOut, CategoryUpdate

router = APIRouter(prefix="/api/categories", tags=["Categories"])

@router.get("", response_model=list[CategoryOut])
def list_categories(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    cats = db.scalars(
        select(Category)
        .where(or_(Category.owner_user_id == user.id, Category.owner_user_id.is_(None)))
        .where(Category.is_active == True)
        .order_by(Category.owner_user_id.is_(None).desc(), Category.sort_order.asc())
    ).all()
    return cats

@router.post("", response_model=CategoryOut, status_code=201)
def create_category(payload: CategoryCreate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    cat = Category(owner_user_id=user.id, **payload.model_dump())
    db.add(cat)
    db.commit()
    db.refresh(cat)
    return cat
"""

dashboard_py = """from datetime import date
from fastapi import APIRouter, Depends
from sqlalchemy import func, select, text
from sqlalchemy.orm import Session
from app.api.dependencies import get_current_user, get_db
from app.models.account import Account
from app.models.transaction import Transaction
from app.models.user import User

router = APIRouter(prefix="/api/dashboard", tags=["Dashboard"])

@router.get("")
def dashboard(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    today = date.today()
    month, year = today.month, today.year

    net_worth = db.scalar(select(func.coalesce(func.sum(Account.balance), 0)).where(Account.user_id == user.id)) or 0

    # Query view for cashflow V3
    query = text("SELECT total_income, total_expense, net_cashflow FROM dbo.vw_monthly_cashflow WHERE user_id = :u_id AND transaction_month = :m AND transaction_year = :y")
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
"""

analytics_py = """from datetime import date
from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.orm import Session
from app.api.dependencies import get_current_user, get_db
from app.models.user import User

router = APIRouter(prefix="/api/analytics", tags=["Analytics"])

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
    q_cf = text("SELECT * FROM dbo.vw_monthly_cashflow WHERE user_id = :u_id AND transaction_month = :m AND transaction_year = :y")
    cf = db.execute(q_cf, {"u_id": user.id, "m": m, "y": y}).mappings().first()
    
    # Biểu đồ chi tiêu theo danh mục
    q_cat = text("SELECT category_name, total_spent FROM dbo.vw_monthly_category_spending WHERE user_id = :u_id AND transaction_month = :m AND transaction_year = :y ORDER BY total_spent DESC")
    cat_spending = db.execute(q_cat, {"u_id": user.id, "m": m, "y": y}).mappings().all()

    expense_by_category = {row["category_name"] or "Khác": float(abs(row["total_spent"])) for row in cat_spending}

    # Xu hướng 6 tháng gần nhất (mock query until full view available, or just query vw_monthly_cashflow for 6 months)
    q_trend = text("SELECT transaction_month, total_income, total_expense FROM dbo.vw_monthly_cashflow WHERE user_id = :u_id ORDER BY transaction_year DESC, transaction_month DESC OFFSET 0 ROWS FETCH NEXT 6 ROWS ONLY")
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
"""

routes = {
    "accounts.py": accounts_py,
    "categories.py": categories_py,
    "dashboard.py": dashboard_py,
    "analytics.py": analytics_py,
}

for filename, content in routes.items():
    filepath = os.path.join(routes_dir, filename)
    with open(filepath, "w", encoding="utf-8") as f:
        f.write(content)
    print(f"Generated {filename}")
