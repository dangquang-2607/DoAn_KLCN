"""User-owned budget configurations, calendar periods, and history."""
from datetime import date, timedelta
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload
from sqlalchemy.exc import IntegrityError
from app.chuc_nang.nguoi_dung.danh_muc.luu_tru.danh_muc import Category
from app.chuc_nang.nguoi_dung.tai_chinh.bao_cao_tai_chinh.dich_vu import budget_progress, budgets_progress
from app.chuc_nang.nguoi_dung.tai_chinh.ngan_sach.ky_han import history_for_year, next_period_start, period_bounds, settings_on, today_vn
from app.dung_chung.http.phu_thuoc import get_current_user, get_db
from app.chuc_nang.nguoi_dung.tai_chinh.ngan_sach.luu_tru.ngan_sach import Budget, BudgetChange
from app.chuc_nang.nguoi_dung.dang_nhap.luu_tru.nguoi_dung import User
from app.chuc_nang.nguoi_dung.tai_chinh.ngan_sach.schemas import BudgetCreate, BudgetOut, BudgetUpdate, BudgetProgressOut

router = APIRouter(prefix="/budgets", tags=["Budgets"])


@router.get(
    "",
    response_model=list[BudgetProgressOut],
    summary="Danh sách ngân sách và tiến độ (List Budgets & Progress)",
    description=(
        "🇻🇳 **Mô tả**: Lấy kỳ hiện tại của ngân sách, tính từ giao dịch và lịch thay đổi.\n\n"
        "🇬🇧 **Description**: Retrieve all budgets with real-time spending progress and utilization percentage."
    ),
)
def list_budgets(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    return budgets_progress(db, user.id)


@router.get("/history", response_model=list[BudgetProgressOut], summary="Lịch sử các kỳ ngân sách")
def list_budget_history(
    year: int | None = Query(default=None, ge=1900, le=9999),
    budget_id: UUID | None = None,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    selected_year = year or today_vn().year
    query = select(Budget).options(selectinload(Budget.changes)).where(Budget.user_id == user.id)
    if budget_id:
        query = query.where(Budget.id == budget_id)
    budgets = db.scalars(query).all()
    items = [item for budget in budgets for item in history_for_year(db, budget, selected_year)]
    return sorted(items, key=lambda item: (item["end_date"], str(item["budget_id"])), reverse=True)


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
        "🇻🇳 **Mô tả**: Người dùng tự thiết lập hạn mức theo tuần, tháng, năm hoặc khoảng ngày tùy chọn.\n\n"
        "🇬🇧 **Description**: Create a new periodic spending budget for a specific category."
    ),
)
def create_budget(
    payload: BudgetCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    values = payload.model_dump()
    if values["is_recurring"]:
        if values["period_type"] == "CUSTOM":
            raise HTTPException(422, "Kỳ tùy chỉnh không lặp lại")
        if values["end_date"] is not None:
            raise HTTPException(422, "Ngân sách định kỳ chỉ cần ngày bắt đầu và ngày kết thúc áp dụng tùy chọn")
        budget = Budget(user_id=user.id, **{**values, "end_date": values["start_date"]})
        budget.end_date = period_bounds(budget, budget.start_date)[1]
    else:
        if values["end_date"] is None:
            raise HTTPException(422, "Cần chọn ngày kết thúc cho ngân sách tùy chỉnh")
        if values["recurrence_end_date"] is not None:
            raise HTTPException(422, "Ngày kết thúc lặp chỉ dành cho ngân sách định kỳ")
        budget = Budget(user_id=user.id, **values)
    if not budget.name or not budget.name.strip():
        category = db.get(Category, budget.category_id) if budget.category_id else None
        label = {"WEEKLY": "hàng tuần", "MONTHLY": "hàng tháng", "YEARLY": "hàng năm", "CUSTOM": "tùy chỉnh"}[budget.period_type]
        budget.name = f"{category.name if category else 'Chi tiêu'} {label}"
    else:
        budget.name = budget.name.strip()
    _validate_budget(db, user.id, budget)
    if budget.is_recurring:
        budget.changes.append(BudgetChange(
            effective_date=budget.start_date, name=budget.name,
            amount_limit=budget.amount_limit, warning_percent=budget.warning_percent,
            is_active=True,
        ))
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
    timing = values.pop("effective_from", "NEXT")
    if any(value is None for key, value in values.items() if key != "recurrence_end_date"):
        raise HTTPException(status_code=422, detail="Trường ngân sách không được null")
    if budget.is_recurring:
        if {"period_type", "start_date", "end_date"} & values.keys():
            raise HTTPException(422, "Kỳ và ngày bắt đầu của ngân sách định kỳ không thể đổi; hãy kết thúc rồi tạo cấu hình mới")
        today = today_vn()
        if budget.recurrence_end_date and budget.recurrence_end_date < today:
            raise HTTPException(409, "Ngân sách đã kết thúc; lịch sử chỉ có thể xem")
        if "recurrence_end_date" in values:
            new_end = values.pop("recurrence_end_date")
            if new_end and new_end < today:
                raise HTTPException(422, "Ngày kết thúc áp dụng không được lùi về trước hôm nay")
            budget.recurrence_end_date = new_end
        if budget.recurrence_end_date and budget.recurrence_end_date < budget.start_date:
            raise HTTPException(422, "Ngày kết thúc áp dụng phải từ ngày bắt đầu trở đi")
        setting_values = {key: values.pop(key) for key in ("name", "amount_limit", "warning_percent") if key in values}
        if "name" in setting_values and not setting_values["name"].strip():
            raise HTTPException(422, "Tên ngân sách không được chỉ có khoảng trắng")
        if setting_values:
            effective = max(budget.start_date, today if timing == "CURRENT" else next_period_start(budget, today))
            if timing == "CURRENT":
                bounds = period_bounds(budget, today)
                if not bounds:
                    raise HTTPException(409, "Ngân sách đã kết thúc")
                effective = bounds[0]
            _change_settings(budget, effective, setting_values)
            for key, value in setting_values.items():
                setattr(budget, key, value)
        if "is_active" in values:
            active = values.pop("is_active")
            # Calendar-day budgets keep transactions already dated today. A
            # pause/resume takes effect at tomorrow's date boundary.
            _change_settings(budget, max(budget.start_date, today + timedelta(days=1)), {"is_active": active})
            budget.is_active = active
        if values:
            raise HTTPException(422, "Trường cập nhật ngân sách không hợp lệ")
        _validate_budget(db, user.id, budget, exclude_id=budget.id)
    else:
        if "recurrence_end_date" in values:
            raise HTTPException(422, "Ngân sách cũ có khoảng ngày cố định")
        for key, value in values.items():
            setattr(budget, key, value.strip() if key == "name" else value)
        _validate_budget(db, user.id, budget, exclude_id=budget.id)

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


def _validate_budget(db, user_id, budget: Budget, exclude_id: UUID | None = None):
    if budget.end_date < budget.start_date:
        raise HTTPException(status_code=422, detail="Ngày kết thúc phải sau hoặc bằng ngày bắt đầu")
    if budget.recurrence_end_date and budget.recurrence_end_date < budget.start_date:
        raise HTTPException(422, "Ngày kết thúc áp dụng phải từ ngày bắt đầu trở đi")
    category_id = budget.category_id
    if category_id:
        cat = db.get(Category, category_id)
        if not cat or (not cat.is_active and exclude_id is None) or cat.type != "EXPENSE" or cat.owner_user_id not in (None, user_id):
            raise HTTPException(status_code=422, detail="Danh mục chi tiêu không hợp lệ")
    candidate_end = budget.recurrence_end_date or date.max if budget.is_recurring else budget.end_date
    others = db.scalars(select(Budget).where(Budget.user_id == user_id, Budget.category_id == category_id)).all()
    for other in others:
        if other.id == exclude_id:
            continue
        other_end = (other.recurrence_end_date or date.max) if other.is_recurring else other.end_date
        if budget.start_date <= other_end and other.start_date <= candidate_end:
            raise HTTPException(409, "Đã có ngân sách cùng danh mục trong khoảng thời gian này")


def _change_settings(budget: Budget, effective: date, changes: dict):
    base = settings_on(budget, effective)
    existing = next((item for item in budget.changes if item.effective_date == effective), None)
    if existing is None:
        existing = BudgetChange(
            effective_date=effective, name=base.name,
            amount_limit=base.amount_limit, warning_percent=base.warning_percent,
            is_active=base.is_active,
        )
        budget.changes.append(existing)
    for item in budget.changes:
        if item.effective_date >= effective:
            for key, value in changes.items():
                setattr(item, key, value.strip() if key == "name" else value)
    budget.changes.sort(key=lambda item: item.effective_date)
