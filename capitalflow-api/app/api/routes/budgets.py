"""
Budget routes — quản lý ngân sách cá nhân.
Dùng view vw_budget_progress cho GET list (hiệu suất cao).
"""
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import text, select
from sqlalchemy.orm import Session
from app.api.dependencies import get_current_user, get_db
from app.models.budget import Budget
from app.models.user import User
from app.schemas.budget import BudgetCreate, BudgetOut, BudgetUpdate, BudgetProgressOut

router = APIRouter(prefix="/budgets", tags=["Budgets"])


@router.get("", response_model=list[BudgetProgressOut])
def list_budgets(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Lấy danh sách ngân sách kèm tiến độ thực tế từ view vw_budget_progress."""
    query = text(
        "SELECT * FROM dbo.vw_budget_progress WHERE user_id = :u_id ORDER BY start_date DESC"
    )
    result = db.execute(query, {"u_id": user.id}).mappings().all()
    return [BudgetProgressOut.model_validate(dict(row)) for row in result]


@router.get("/{budget_id}", response_model=BudgetProgressOut)
def get_budget(
    budget_id: UUID,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Lấy chi tiết tiến độ của một ngân sách cụ thể."""
    query = text(
        "SELECT * FROM dbo.vw_budget_progress WHERE budget_id = :b_id AND user_id = :u_id"
    )
    row = db.execute(query, {"b_id": budget_id, "u_id": user.id}).mappings().first()
    if not row:
        raise HTTPException(status_code=404, detail="Không tìm thấy ngân sách")
    return BudgetProgressOut.model_validate(dict(row))


@router.post("", response_model=BudgetOut, status_code=201)
def create_budget(
    payload: BudgetCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Tạo ngân sách mới."""
    budget = Budget(user_id=user.id, **payload.model_dump())
    db.add(budget)
    db.commit()
    db.refresh(budget)
    return budget


@router.patch("/{budget_id}", response_model=BudgetOut)
def update_budget(
    budget_id: UUID,
    payload: BudgetUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Cập nhật ngân sách."""
    budget = db.scalar(
        select(Budget).where(Budget.id == budget_id, Budget.user_id == user.id)
    )
    if not budget:
        raise HTTPException(status_code=404, detail="Không tìm thấy ngân sách")

    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(budget, k, v)

    db.commit()
    db.refresh(budget)
    return budget


@router.delete("/{budget_id}", status_code=204)
def delete_budget(
    budget_id: UUID,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Xóa ngân sách."""
    budget = db.scalar(
        select(Budget).where(Budget.id == budget_id, Budget.user_id == user.id)
    )
    if not budget:
        raise HTTPException(status_code=404, detail="Không tìm thấy ngân sách")
    db.delete(budget)
    db.commit()
