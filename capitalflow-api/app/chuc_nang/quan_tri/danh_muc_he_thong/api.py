"""
API quản lý danh mục hệ thống dùng chung.
GET/POST/PATCH/PUT /admin/categories*
"""
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.dung_chung.http.phu_thuoc import get_db, require_admin
from app.chuc_nang.nguoi_dung.tai_chinh.ngan_sach.luu_tru.ngan_sach import Budget
from app.chuc_nang.nguoi_dung.danh_muc.luu_tru.danh_muc import Category
from app.chuc_nang.nguoi_dung.hoa_don_ai.luu_tru.invoice import Invoice
from app.chuc_nang.nguoi_dung.tai_chinh.giao_dich.luu_tru.giao_dich import Transaction
from app.chuc_nang.nguoi_dung.dang_nhap.luu_tru.nguoi_dung import User
from app.chuc_nang.nguoi_dung.danh_muc.schemas import AdminCategoryCreate, CategoryOut, CategoryReorder, CategoryUpdate

from app.chuc_nang.quan_tri.dung_chung.tien_ich import _write_audit

router = APIRouter()


def _global_category(db: Session, category_id: UUID, *, lock: bool = False) -> Category:
    query = select(Category).where(
        Category.id == category_id,
        Category.owner_user_id.is_(None),
    )
    if lock:
        query = query.with_hint(
            Category, "WITH (UPDLOCK, ROWLOCK)", dialect_name="mssql"
        ).execution_options(populate_existing=True)
    category = db.scalar(query)
    if not category:
        raise HTTPException(status_code=404, detail="Không tìm thấy danh mục hệ thống")
    return category


def _commit_category(db: Session) -> None:
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(
            status_code=409,
            detail="Danh mục hệ thống cùng tên và loại đã tồn tại",
        ) from exc


@router.get("/categories", response_model=list[CategoryOut])
def list_system_categories(
    category_type: str | None = None,
    include_inactive: bool = True,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    query = select(Category).where(Category.owner_user_id.is_(None))
    if category_type:
        query = query.where(Category.type == category_type)
    if not include_inactive:
        query = query.where(Category.is_active == True)
    return db.scalars(query.order_by(Category.type, Category.sort_order, Category.name)).all()


@router.post("/categories", response_model=CategoryOut, status_code=201)
def create_system_category(
    payload: AdminCategoryCreate,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    values = payload.model_dump()
    if "sort_order" not in payload.model_fields_set:
        current_max = db.scalar(
            select(func.max(Category.sort_order)).where(
                Category.owner_user_id.is_(None), Category.type == payload.type
            )
        )
        values["sort_order"] = int(current_max or 0) + 10
    category = Category(owner_user_id=None, **values)
    db.add(category)
    _write_audit(db, admin.id, "CATEGORY_CREATE", "category", str(category.id))
    _commit_category(db)
    db.refresh(category)
    return category


@router.patch("/categories/{category_id}", response_model=CategoryOut)
def update_system_category(
    category_id: UUID,
    payload: CategoryUpdate,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    category = _global_category(db, category_id, lock=True)
    values = payload.model_dump(exclude_unset=True)
    if any(values.get(key, True) is None for key in ("name", "type", "sort_order", "is_active")):
        raise HTTPException(status_code=422, detail="Trường bắt buộc không được null")
    if values.get("type", category.type) != category.type:
        for model in (Transaction, Budget, Invoice):
            if db.scalar(select(model.id).where(model.category_id == category.id).limit(1)):
                raise HTTPException(
                    status_code=409,
                    detail="Không thể đổi loại danh mục hệ thống đã được sử dụng",
                )
    for key, value in values.items():
        setattr(category, key, value)
    _write_audit(db, admin.id, "CATEGORY_UPDATE", "category", str(category.id))
    _commit_category(db)
    db.refresh(category)
    return category


@router.put("/categories/reorder", response_model=list[CategoryOut])
def reorder_system_categories(
    payload: CategoryReorder,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    categories = db.scalars(
        select(Category)
        .where(Category.owner_user_id.is_(None), Category.type == payload.type)
        .with_hint(Category, "WITH (UPDLOCK, ROWLOCK)", dialect_name="mssql")
        .execution_options(populate_existing=True)
    ).all()
    by_id = {category.id: category for category in categories}
    if set(payload.ordered_ids) != set(by_id):
        raise HTTPException(
            status_code=422,
            detail="Danh sách sắp xếp phải chứa đầy đủ danh mục của loại đã chọn",
        )
    for index, category_id in enumerate(payload.ordered_ids, start=1):
        by_id[category_id].sort_order = index * 10
    _write_audit(db, admin.id, "CATEGORY_REORDER", "category")
    db.commit()
    return [by_id[category_id] for category_id in payload.ordered_ids]
