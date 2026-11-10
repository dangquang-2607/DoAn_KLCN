"""Cung cấp REST API quản lý danh mục thu/chi của người dùng.

Vai trò: điều phối danh sách, tạo và cập nhật danh mục trong phạm vi cho phép.
Đầu vào: DTO category, current user và DB session.
Đầu ra: category response hoặc HTTP error.
Ràng buộc: không cho người dùng sửa danh mục hệ thống ngoài quyền được cấp.
"""

import uuid
from typing import Literal
from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy import select, or_, case, exists
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from app.chuc_nang.nguoi_dung.tai_chinh.giao_dich.luu_tru.giao_dich import Transaction
from app.chuc_nang.nguoi_dung.tai_chinh.ngan_sach.luu_tru.ngan_sach import Budget
from app.chuc_nang.nguoi_dung.hoa_don_ai.luu_tru.invoice import Invoice
from app.dung_chung.http.phu_thuoc import get_current_user, get_db
from app.chuc_nang.nguoi_dung.danh_muc.luu_tru.danh_muc import Category, CategoryType
from app.chuc_nang.nguoi_dung.dang_nhap.luu_tru.nguoi_dung import User
from app.chuc_nang.nguoi_dung.danh_muc.schemas import CategoryCreate, CategoryOut, CategoryQuota, CategoryUpdate, CategoryRestore, CategorySuggestionRequest, CategorySuggestionOut
from app.chuc_nang.nguoi_dung.danh_muc.phan_loai import suggest_category
from app.chuc_nang.nguoi_dung.goi_dich_vu.han_muc import LIMITS, category_count, lock_owner, plan_for, require_capacity


def private_categories(response: Response):
    response.headers["Cache-Control"] = "no-store, private"


router = APIRouter(prefix="/categories", tags=["Categories"], dependencies=[Depends(private_categories)])


def _references(category_id):
    # Bao gồm cả bản ghi lịch sử/đã ẩn/thùng rác, không chỉ dữ liệu đang dùng.
    return or_(*(exists().where(model.category_id == category_id) for model in (Transaction, Budget, Invoice)))


def _category_out(category, in_use):
    return CategoryOut.model_validate(category).model_copy(update={
        "can_permanently_delete": category.owner_user_id is not None and not in_use,
    })


def _single_out(db, category):
    return _category_out(category, db.scalar(select(case((_references(category.id), True), else_=False))))


@router.get("/limits", response_model=CategoryQuota)
def category_limits(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    plan, _ = plan_for(db, user.id)
    used = category_count(db, user.id)
    limit = LIMITS[plan]["categories"]
    return {"plan": plan, "used": used, "limit": limit, "remaining": max(0, limit - used), "can_create": used < limit}

@router.get(
    "",
    response_model=list[CategoryOut],
    summary="Danh sách danh mục (List Categories)",
    description=(
        "🇻🇳 **Mô tả**: Lấy danh sách danh mục thu chi (bao gồm danh mục mặc định hệ thống "
        "và danh mục tùy chỉnh của người dùng). status=active lấy danh mục đang dùng; "
        "archived lấy danh mục cá nhân đã ẩn; all phục vụ tra cứu lịch sử.\n\n"
        "🇬🇧 **Description**: List scoped categories by active, archived or all status."
    ),
)
def list_categories(
    status: Literal["active", "archived", "all"] = "active",
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    query = select(Category, case((_references(Category.id), True), else_=False).label("in_use")).where(or_(Category.owner_user_id == user.id, Category.owner_user_id.is_(None)))
    # SQL Server bit cần phép so sánh (= 1/0); .is_(True/False) sinh SQL "IS 1/0" không hợp lệ.
    if status == "active":
        query = query.where(Category.is_active == True)
    elif status == "archived":
        query = query.where(Category.owner_user_id == user.id, Category.is_active == False)
    rows = db.execute(
        query.order_by(
            case((Category.owner_user_id.is_(None), 1), else_=0).desc(),
            Category.sort_order.asc(), Category.name.asc(), Category.id.asc(),
        )
    ).all()
    return [_category_out(category, in_use) for category, in_use in rows]

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
    scope = (user.id, payload.name, payload.type)
    existing = _duplicate_category(db, *scope)
    if existing:
        _raise_duplicate(existing)
    require_capacity(db, user.id, "categories")
    cat = Category(owner_user_id=user.id, **payload.model_dump())
    db.add(cat)
    _commit(db, duplicate_scope=scope)
    db.refresh(cat)
    return _single_out(db, cat)


@router.post("/suggest", response_model=CategorySuggestionOut)
def suggest_transaction_category(
    payload: CategorySuggestionRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    return suggest_category(
        db,
        user.id,
        payload.type,
        description=payload.description,
        note=payload.note,
        item_names=payload.item_names,
    ).as_dict()


def _duplicate_category(db: Session, user_id: uuid.UUID, name: str, category_type: CategoryType) -> Category | None:
    return db.scalar(select(Category).where(
        Category.owner_user_id == user_id, Category.name == name, Category.type == category_type,
    ))


def _raise_duplicate(cat: Category):
    if not cat.is_active:
        raise HTTPException(status_code=409, detail={
            "code": "CATEGORY_ARCHIVED",
            "message": f'Danh mục “{cat.name}” đã tồn tại nhưng đang bị ẩn. Bạn có muốn khôi phục danh mục này không?',
            "category": {"id": str(cat.id), "name": cat.name, "type": cat.type},
        })
    raise HTTPException(status_code=409, detail="Danh mục cùng tên và loại đã tồn tại")


def _commit(db: Session, *, duplicate_scope: tuple[uuid.UUID, str, CategoryType] | None = None):
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        # Kiểm tra lại sau rollback để xử lý cả yêu cầu tạo trùng chạy đồng thời.
        if duplicate_scope:
            existing = _duplicate_category(db, *duplicate_scope)
            if existing:
                _raise_duplicate(existing)
        raise HTTPException(status_code=409, detail="Danh mục cùng tên và loại đã tồn tại")


def _owned_category(db, category_id, user_id, *, exclusive=False):
    hint = "WITH (XLOCK, ROWLOCK)" if exclusive else "WITH (UPDLOCK, ROWLOCK)"
    cat = db.scalar(select(Category).where(Category.id == category_id, Category.owner_user_id == user_id).with_hint(Category, hint, dialect_name="mssql").execution_options(populate_existing=True))
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
    return _single_out(db, cat)


@router.delete("/{category_id}", status_code=204)
def delete_category(category_id: uuid.UUID, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    cat = _owned_category(db, category_id, user.id)
    cat.is_active = False
    _commit(db)


def _used_category_error():
    return HTTPException(status_code=409, detail={
        "code": "CATEGORY_IN_USE",
        "message": "Danh mục đã liên kết với giao dịch, ngân sách hoặc hóa đơn. Bạn chỉ có thể ẩn danh mục để giữ nguyên lịch sử.",
    })


@router.delete("/{category_id}/permanent", status_code=204, summary="Xóa vĩnh viễn danh mục cá nhân chưa sử dụng")
def permanently_delete_category(category_id: uuid.UUID, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    # Cùng thứ tự khóa với cấp hạn mức. XLOCK chặn tham chiếu FK mới cho đến commit.
    lock_owner(db, user.id)
    cat = _owned_category(db, category_id, user.id, exclusive=True)
    if db.scalar(select(case((_references(cat.id), True), else_=False))):
        raise _used_category_error()
    db.delete(cat)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise _used_category_error()


@router.post("/{category_id}/restore", response_model=CategoryOut, summary="Khôi phục danh mục cá nhân đã ẩn")
def restore_category(
    category_id: uuid.UUID,
    payload: CategoryRestore | None = None,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    cat = _owned_category(db, category_id, user.id)
    # Retry hoặc hai cửa sổ khôi phục cùng lúc không ghi đè metadata đã được lưu.
    if cat.is_active:
        return _single_out(db, cat)
    if payload is not None:
        for key, value in payload.model_dump(exclude_unset=True).items():
            setattr(cat, key, value)
    cat.is_active = True
    _commit(db)
    db.refresh(cat)
    return _single_out(db, cat)
