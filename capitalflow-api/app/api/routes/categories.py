import uuid
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, or_, case
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from app.models.transaction import Transaction
from app.models.budget import Budget
from app.models.invoice import Invoice
from app.api.dependencies import get_current_user, get_db
from app.models.category import Category
from app.models.user import User
from app.schemas.category import CategoryCreate, CategoryOut, CategoryUpdate

router = APIRouter(prefix="/categories", tags=["Categories"])

@router.get(
    "",
    response_model=list[CategoryOut],
    summary="Danh sách danh mục (List Categories)",
    description=(
        "🇻🇳 **Mô tả**: Lấy danh sách danh mục thu chi (bao gồm danh mục mặc định hệ thống "
        "và danh mục tùy chỉnh của người dùng).\n\n"
        "🇬🇧 **Description**: Retrieve all active income and expense categories "
        "(including system-wide defaults and user-defined custom categories)."
    ),
)
def list_categories(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    cats = db.scalars(
        select(Category)
        .where(or_(Category.owner_user_id == user.id, Category.owner_user_id.is_(None)))
        .where(Category.is_active == True)
        .order_by(
            case((Category.owner_user_id.is_(None), 1), else_=0).desc(),
            Category.sort_order.asc()
        )
    ).all()
    return cats

@router.post(
    "",
    response_model=CategoryOut,
    status_code=201,
    summary="Tạo danh mục mới (Create Category)",
    description=(
        "🇻🇳 **Mô tả**: Tạo một danh mục thu hoặc chi tùy chỉnh mới cho người dùng hiện tại.\n\n"
        "🇬🇧 **Description**: Create a new custom income or expense category for the current authenticated user."
    ),
)
def create_category(payload: CategoryCreate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    cat = Category(owner_user_id=user.id, **payload.model_dump())
    db.add(cat)
    _commit(db)
    db.refresh(cat)
    return cat


def _commit(db):
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="Danh mục cùng tên và loại đã tồn tại")


def _owned_category(db, category_id, user_id):
    cat = db.scalar(select(Category).where(Category.id == category_id, Category.owner_user_id == user_id).with_hint(Category, "WITH (UPDLOCK, ROWLOCK)", dialect_name="mssql").execution_options(populate_existing=True))
    if not cat:
        raise HTTPException(status_code=404, detail="Không tìm thấy danh mục tùy chỉnh")
    return cat


@router.patch("/{category_id}", response_model=CategoryOut)
def update_category(category_id: uuid.UUID, payload: CategoryUpdate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    cat = _owned_category(db, category_id, user.id)
    values = payload.model_dump(exclude_unset=True)
    if any(values.get(k, True) is None for k in ("name", "type", "sort_order", "is_active")):
        raise HTTPException(status_code=422, detail="Trường bắt buộc không được null")
    if values.get("type", cat.type) != cat.type:
        for model in (Transaction, Budget, Invoice):
            if db.scalar(select(model.id).where(model.category_id == cat.id).limit(1)):
                raise HTTPException(status_code=409, detail="Không thể đổi loại danh mục đã được sử dụng")
    for key, value in values.items():
        setattr(cat, key, value)
    _commit(db)
    db.refresh(cat)
    return cat


@router.delete("/{category_id}", status_code=204)
def delete_category(category_id: uuid.UUID, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    cat = _owned_category(db, category_id, user.id)
    cat.is_active = False
    _commit(db)
