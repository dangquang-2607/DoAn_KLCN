"""
Budget routes — quản lý ngân sách cá nhân.
Dùng view vw_budget_progress cho GET list (hiệu suất cao).
"""
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import text, select
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from app.models.category import Category
from app.services.reporting import budget_progress, budgets_progress
from app.api.dependencies import get_current_user, get_db
from app.models.budget import Budget
from app.models.user import User
from app.schemas.budget import BudgetCreate, BudgetOut, BudgetUpdate, BudgetProgressOut

router = APIRouter(prefix="/budgets", tags=["Budgets"])


@router.get(
    "",
    response_model=list[BudgetProgressOut],
    summary="Danh sách ngân sách và tiến độ (List Budgets & Progress)",
    description=(
        "🇻🇳 **Mô tả**: Lấy danh sách ngân sách chi tiêu kèm số tiền đã chi và tiến độ thực tế (tính toán qua view SQL).\n\n"
        "🇬🇧 **Description**: Retrieve all budgets with real-time spending progress and utilization percentage."
    ),
)
def list_budgets(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    return budgets_progress(db, user.id)


@router.get(
    "/{budget_id}",
    response_model=BudgetProgressOut,
    summary="Chi tiết tiến độ ngân sách (Get Budget Details)",
    description=(
        "🇻🇳 **Mô tả**: Lấy chi tiết thông tin và tiến độ chi tiêu của một ngân sách cụ thể theo ID.\n\n"
        "🇬🇧 **Description**: Retrieve detailed spending metrics and progress for a specific budget by ID."
    ),
)
def get_budget(
    budget_id: UUID,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    budget = db.scalar(select(Budget).where(Budget.id == budget_id, Budget.user_id == user.id))
    if not budget:
        raise HTTPException(status_code=404, detail="Không tìm thấy ngân sách")
    return budget_progress(db, budget)


@router.post(
    "",
    response_model=BudgetOut,
    status_code=201,
    summary="Tạo ngân sách mới (Create Budget)",
    description=(
        "🇻🇳 **Mô tả**: Thiết lập hạn mức chi tiêu định kỳ mới cho danh mục cụ thể.\n\n"
        "🇬🇧 **Description**: Create a new periodic spending budget for a specific category."
    ),
)
def create_budget(
    payload: BudgetCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    _validate_budget(db, user.id, payload.model_dump())
    budget = Budget(user_id=user.id, **payload.model_dump())
    db.add(budget)
    _commit_budget(db)
    db.refresh(budget)
    return budget


@router.patch(
    "/{budget_id}",
    response_model=BudgetOut,
    summary="Cập nhật ngân sách (Update Budget)",
    description=(
        "🇻🇳 **Mô tả**: Chỉnh sửa hạn mức chi tiêu hoặc khoảng thời gian hiệu lực của ngân sách.\n\n"
        "🇬🇧 **Description**: Update budget spending limit or active date period."
    ),
)
def update_budget(
    budget_id: UUID,
    payload: BudgetUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    budget = db.scalar(
        select(Budget).where(Budget.id == budget_id, Budget.user_id == user.id)
    )
    if not budget:
        raise HTTPException(status_code=404, detail="Không tìm thấy ngân sách")

    values = payload.model_dump(exclude_unset=True)
    if any(value is None for value in values.values()):
        raise HTTPException(status_code=422, detail="Trường ngân sách không được null")
    _validate_budget(db, user.id, {"start_date": budget.start_date, "end_date": budget.end_date, **values})
    for k, v in values.items():
        setattr(budget, k, v)

    _commit_budget(db)
    db.refresh(budget)
    return budget


@router.delete(
    "/{budget_id}",
    status_code=204,
    summary="Xóa ngân sách (Delete Budget)",
    description=(
        "🇻🇳 **Mô tả**: Xóa bỏ một ngân sách chi tiêu khỏi hệ thống theo ID.\n\n"
        "🇬🇧 **Description**: Delete a budget entry by ID."
    ),
)
def delete_budget(
    budget_id: UUID,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    budget = db.scalar(
        select(Budget).where(Budget.id == budget_id, Budget.user_id == user.id)
    )
    if not budget:
        raise HTTPException(status_code=404, detail="Không tìm thấy ngân sách")
    db.delete(budget)
    _commit_budget(db)


def _commit_budget(db):
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="Ngân sách trùng phạm vi hoặc vi phạm ràng buộc dữ liệu")


def _validate_budget(db, user_id, values):
    if values["end_date"] < values["start_date"]:
        raise HTTPException(status_code=422, detail="Ngày kết thúc phải sau hoặc bằng ngày bắt đầu")
    category_id = values.get("category_id")
    if category_id:
        cat = db.get(Category, category_id)
        if not cat or not cat.is_active or cat.type != "EXPENSE" or cat.owner_user_id not in (None, user_id):
            raise HTTPException(status_code=422, detail="Danh mục chi tiêu không hợp lệ")
