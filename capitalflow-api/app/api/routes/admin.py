"""
Admin routes — Dashboard KPIs, Quản lý người dùng, Giám sát hệ thống, Nhật ký Email & Cấu hình SMTP.
Tất cả endpoints đều yêu cầu quyền ADMIN (hoặc SCOPE=admin:read / admin:write).
"""
from datetime import date, datetime, timedelta, timezone
from uuid import UUID
import uuid
import secrets
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query, BackgroundTasks, Response, status as http_status
from pydantic import BaseModel, EmailStr, Field, field_validator
from sqlalchemy import func, select, text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.api.dependencies import get_db, require_admin
from app.core.config import settings
from app.core.security import hash_password
from app.models.audit_log import AuditLog
from app.models.invoice import Invoice
from app.models.category import Category
from app.models.budget import Budget
from app.models.ocr_job import OcrJob
from app.models.transaction import Transaction
from app.models.user import User, UserRole
from app.models.refresh_token import RefreshToken
from app.models.email_log import EmailLog
from app.models.system_setting import SystemSetting
from app.models.user_deletion import UserDeletionFile, UserDeletionRequest
from app.services.email_service import EmailService, SMTPConfig
from app.services.jobs import enqueue, enqueue_email
from app.services.sessions import revoke_sessions
from app.core.secrets_store import seal, unseal
from app.services.user_deletion import deleted_email_alias, email_fingerprint, original_email
from app.schemas.category import AdminCategoryCreate, CategoryOut, CategoryReorder, CategoryUpdate

router = APIRouter(prefix="/admin", tags=["Admin"])


# ─────────────────────────────────────────────────────────────
# SCHEMAS
# ─────────────────────────────────────────────────────────────

class AdminCreateUserRequest(BaseModel):
    email: EmailStr
    full_name: str
    role: str = "USER"
    password: str | None = None

class UserRoleUpdate(BaseModel):
    role: UserRole

class BulkBanRequest(BaseModel):
    user_ids: list[UUID]
    reason: str = "Vi phạm quy định sử dụng hệ thống"

class BulkUnbanRequest(BaseModel):
    user_ids: list[UUID]

class UserDeleteRequest(BaseModel):
    mode: Literal["soft", "hard"] = "soft"
    reason: str = Field(min_length=3, max_length=500)
    release_email: bool = True
    confirmation: str | None = Field(default=None, max_length=255)

    @field_validator("reason")
    @classmethod
    def normalize_reason(cls, value: str) -> str:
        value = value.strip()
        if len(value) < 3:
            raise ValueError("Lý do phải có ít nhất 3 ký tự")
        return value

class BulkDeleteRequest(BaseModel):
    user_ids: list[UUID] = Field(min_length=1, max_length=100)
    reason: str = Field(min_length=3, max_length=500)
    release_email: bool = True

    @field_validator("reason")
    @classmethod
    def normalize_reason(cls, value: str) -> str:
        value = value.strip()
        if len(value) < 3:
            raise ValueError("Lý do phải có ít nhất 3 ký tự")
        return value

class RestoreUserRequest(BaseModel):
    reason: str = Field(default="Khôi phục bởi Quản trị viên", min_length=3, max_length=500)

    @field_validator("reason")
    @classmethod
    def normalize_reason(cls, value: str) -> str:
        value = value.strip()
        if len(value) < 3:
            raise ValueError("Lý do phải có ít nhất 3 ký tự")
        return value

class SendTestEmailRequest(BaseModel):
    recipient_email: EmailStr
    subject: str = "Kiểm thử Kết nối Email CapitalFlow"
    message: str = "Hệ thống gửi nhận email hoạt động hoàn hảo!"

class SMTPSettingsUpdate(BaseModel):
    smtp_host: str = "smtp.gmail.com"
    smtp_port: int = 587
    smtp_user: str = ""
    smtp_password: str = ""
    smtp_tls: bool = True
    smtp_ssl: bool = False
    emails_from_email: str = "support@capitalflow.vn"
    emails_from_name: str = "CapitalFlow Finance"


# ─────────────────────────────────────────────────────────────
# DASHBOARD OVERVIEW & KPIS
# ─────────────────────────────────────────────────────────────

@router.get(
    "/overview",
    summary="Tổng quan hệ thống (Admin Dashboard KPIs)",
    description="Lấy các chỉ số KPI tổng thể của hệ thống (active/banned users, tổng số giao dịch, tỷ lệ bóc tách OCR thành công).",
)
def admin_overview(
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    total_users = db.scalar(select(func.count(User.id)).where(User.is_deleted == False)) or 0
    active_users = db.scalar(select(func.count(User.id)).where(User.is_deleted == False, User.is_active == True)) or 0
    banned_users = db.scalar(select(func.count(User.id)).where(User.is_deleted == False, User.is_active == False)) or 0
    deleted_users = db.scalar(select(func.count(User.id)).where(User.is_deleted == True)) or 0

    total_invoices = db.scalar(select(func.count(Invoice.id))) or 0
    completed_invoices = (
        db.scalar(
            select(func.count(Invoice.id)).where(Invoice.status == "CONFIRMED")
        )
        or 0
    )
    ocr_rate = (
        round((completed_invoices / total_invoices) * 100, 1)
        if total_invoices > 0
        else 0.0
    )

    total_tx = db.scalar(select(func.count(Transaction.id))) or 0

    return {
        "users": {
            "total": total_users,
            "active": active_users,
            "banned": banned_users,
            "deleted": deleted_users,
        },
        "invoices": {
            "total": total_invoices,
            "completed": completed_invoices,
            "ocr_success_rate": ocr_rate,
        },
        "total_transactions": total_tx,
    }


# ─────────────────────────────────────────────────────────────
# USER MANAGEMENT (RBAC: Ban, Unban, Role, List, Detail)
# ─────────────────────────────────────────────────────────────

def _iso_utc(dt):
    if not dt:
        return None
    s = dt.isoformat()
    return s if s.endswith("Z") or "+" in s else s + "Z"

def _user_out(u: User, deletion: UserDeletionRequest | None = None) -> dict:
    display_email = original_email(u) if u.is_deleted else u.email
    return {
        "id": str(u.id),
        "email": display_email,
        "full_name": u.full_name,
        "role": u.role.value if hasattr(u.role, "value") else u.role,
        "is_active": u.is_active,
        "is_deleted": u.is_deleted,
        "deletion_status": u.deletion_status,
        "deleted_at": _iso_utc(u.deleted_at),
        "is_system_account": u.is_system_account,
        "must_change_password": getattr(u, 'must_change_password', False),
        "created_at": _iso_utc(u.created_at),
        "last_login_at": _iso_utc(u.last_login_at),
        "last_active_at": _iso_utc(getattr(u, 'last_active_at', None)),
        "deletion": _deletion_request_out(deletion) if deletion else None,
    }


@router.get(
    "/users",
    summary="Danh sách người dùng (List Users)",
    description="Danh sách người dùng có phân trang, hỗ trợ tìm kiếm theo email/họ tên và lọc theo vai trò/trạng thái.",
)
def list_users(
    page: int = Query(1, ge=1, description="Số trang"),
    page_size: int = Query(20, ge=1, le=100, description="Số bản ghi mỗi trang"),
    search: str | None = Query(None, description="Tìm theo email hoặc họ tên"),
    role: UserRole | None = Query(None, description="Lọc theo vai trò (USER / ADMIN)"),
    status: str | None = Query(None, pattern="^(active|banned|deleted|purge_pending)$", description="Lọc theo trạng thái"),
    include_deleted: bool = Query(False, description="Bao gồm tài khoản đã xóa"),
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    q = select(User)

    if status == "deleted":
        q = q.where(User.is_deleted == True)
    elif status == "purge_pending":
        q = q.where(User.deletion_status == "PURGE_PENDING")
    elif not include_deleted:
        q = q.where(User.is_deleted == False)

    if search:
        clean_search = search.strip()
        term = f"%{clean_search}%"
        search_predicate = (User.email.ilike(term)) | (User.full_name.ilike(term))
        if "@" in clean_search:
            search_predicate = search_predicate | User.id.in_(
                select(UserDeletionRequest.target_user_id).where(
                    UserDeletionRequest.target_email_hash == email_fingerprint(clean_search)
                )
            )
        q = q.where(search_predicate)
    if role:
        q = q.where(User.role == role)
    if status == "active":
        q = q.where(User.is_deleted == False, User.is_active == True)
    elif status == "banned":
        q = q.where(User.is_deleted == False, User.is_active == False)

    total = db.scalar(select(func.count()).select_from(q.subquery()))
    users = db.scalars(
        q.order_by(User.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    ).all()
    latest_deletions = {}
    if users:
        deletion_rows = db.scalars(
            select(UserDeletionRequest)
            .where(UserDeletionRequest.target_user_id.in_([u.id for u in users]))
            .order_by(UserDeletionRequest.created_at.desc(), UserDeletionRequest.id.desc())
        ).all()
        for deletion in deletion_rows:
            latest_deletions.setdefault(deletion.target_user_id, deletion)

    return {
        "items": [_user_out(u, latest_deletions.get(u.id)) for u in users],
        "total": total,
        "page": page,
        "page_size": page_size,
    }


@router.get(
    "/users/{user_id}",
    summary="Chi tiết người dùng (Get User Detail)",
    description="Lấy thông tin chi tiết một người dùng kèm thống kê số lượng tài khoản ví, giao dịch và hóa đơn.",
)
def get_user(
    user_id: UUID,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    user = _locked_user(db, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="Không tìm thấy người dùng")

    tx_count = db.scalar(
        select(func.count(Transaction.id)).where(Transaction.user_id == user_id)
    )
    inv_count = db.scalar(
        select(func.count(Invoice.id)).where(Invoice.user_id == user_id)
    )

    deletion = db.scalar(
        select(UserDeletionRequest)
        .where(UserDeletionRequest.target_user_id == user_id)
        .order_by(UserDeletionRequest.created_at.desc(), UserDeletionRequest.id.desc())
        .limit(1)
    )
    data = _user_out(user, deletion)
    data["stats"] = {
        "transactions_count": tx_count,
        "invoices_count": inv_count,
    }
    return data


@router.post(
    "/users",
    summary="Tạo người dùng mới (Admin Create User)",
    description="Quản trị viên tạo tài khoản mới cho người dùng, tự động cấp mật khẩu tạm thời và gửi email kích hoạt.",
)
def admin_create_user(
    payload: AdminCreateUserRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    # Kiểm tra trùng email
    existing = db.scalar(select(User).where(User.email == payload.email))
    if existing:
        raise HTTPException(status_code=400, detail="Địa chỉ email này đã được sử dụng trong hệ thống.")

    role_str = payload.role.upper()
    role_enum = UserRole.ADMIN if role_str == "ADMIN" else UserRole.USER

    # Tạo mật khẩu tạm thời nếu không truyền vào
    raw_password = (
        payload.password.strip()
        if payload.password and payload.password.strip()
        else f"Capital@{secrets.token_hex(3).upper()}!26"
    )

    new_user = User(
        id=uuid.uuid4(),
        email=payload.email,
        full_name=payload.full_name,
        role=role_enum,
        password_hash=hash_password(raw_password),
        is_active=True,
        must_change_password=True,
    )
    db.add(new_user)
    db.flush()
    db.refresh(new_user)

    # Ghi nhật ký quản trị
    _write_audit(
        db,
        admin.id,
        "CREATE_USER",
        "user",
        str(new_user.id),
    )

    # Gửi email thông báo tài khoản & mật khẩu tạm
    enqueue_email(db,
        EmailService.send_account_created_by_admin_email,
        new_user.email,
        new_user.full_name or "Thành viên mới",
        raw_password,
        role_str,
        owner_user_id=new_user.id,
    )
    db.commit()

    return {
        "id": str(new_user.id),
        "email": new_user.email,
        "full_name": new_user.full_name,
        "role": role_str,
        "is_active": new_user.is_active,
        "created_at": _iso_utc(new_user.created_at),
        "message": "Đã tạo tài khoản và gửi mật khẩu kích hoạt tạm thời qua email!",
    }


@router.post(
    "/users/{user_id}/reset-password",
    summary="Cấp lại mật khẩu tạm thời cho người dùng",
    description="Quản trị viên tạo mật khẩu tạm thời mới và gửi thẳng đến email của người dùng.",
)
def admin_reset_user_password(
    user_id: UUID,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    target_user = _locked_user(db, user_id)
    if not target_user:
        raise HTTPException(status_code=404, detail="Không tìm thấy người dùng.")
    _ensure_not_deleted(target_user)

    new_temp_pass = f"Pass@{secrets.token_hex(3).upper()}!2026"
    target_user.password_hash = hash_password(new_temp_pass)
    target_user.must_change_password = True
    revoke_sessions(db, target_user, "admin_password_reset")
    db.flush()

    _write_audit(
        db,
        admin.id,
        "RESET_USER_PASSWORD",
        "user",
        str(target_user.id),
    )

    enqueue_email(db,
        EmailService.send_temporary_password_email,
        target_user.email,
        target_user.full_name or "Quý khách",
        new_temp_pass,
        owner_user_id=target_user.id,
    )
    db.commit()

    return {
        "success": True,
        "message": "Đã tạo và gửi mật khẩu kích hoạt mới vào email của người dùng.",
    }


@router.patch(
    "/users/{user_id}/ban",
    summary="Khóa tài khoản người dùng (Ban User)",
    description="Vô hiệu hóa tài khoản người dùng, tự động gửi email thông báo và ghi nhật ký hệ thống.",
)
def ban_user(
    user_id: UUID,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    user = _locked_user(db, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="Không tìm thấy người dùng")
    _ensure_not_deleted(user)
    if _is_protected_account(user):
        raise HTTPException(status_code=400, detail="Không thể khóa tài khoản Quản trị viên")

    user.is_active = False
    _revoke_user_sessions(db, user)
    _write_audit(db, admin.id, "BAN_USER", "user", str(user_id))
    db.flush()

    enqueue_email(db,
        EmailService.send_account_banned_email,
        user.email,
        user.full_name or "Quý khách",
        "Tài khoản bị tạm ngưng bởi Quản trị viên",
        owner_user_id=user.id,
    )
    db.commit()

    return {"message": "Đã khóa tài khoản thành công", "user_id": str(user_id)}


@router.patch(
    "/users/{user_id}/unban",
    summary="Mở khóa tài khoản người dùng (Unban User)",
    description="Kích hoạt lại tài khoản người dùng, tự động gửi email thông báo mở khóa và ghi nhật ký hệ thống.",
)
def unban_user(
    user_id: UUID,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    user = _locked_user(db, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="Không tìm thấy người dùng")
    _ensure_not_deleted(user)

    user.is_active = True
    _write_audit(db, admin.id, "UNBAN_USER", "user", str(user_id))
    db.flush()

    enqueue_email(db,
        EmailService.send_account_unbanned_email,
        user.email,
        user.full_name or "Quý khách",
        owner_user_id=user.id,
    )
    db.commit()

    return {"message": "Đã mở khóa tài khoản thành công", "user_id": str(user_id)}


@router.patch(
    "/users/{user_id}/role",
    summary="Cập nhật vai trò người dùng (Update User Role)",
    description="Thay đổi vai trò người dùng (ADMIN / USER), tự động gửi email thông báo và ghi nhật ký hệ thống.",
)
def update_user_role(
    user_id: UUID,
    payload: UserRoleUpdate,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    user = _locked_user(db, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="Không tìm thấy người dùng")

    _ensure_not_deleted(user)
    if user.is_system_account:
        raise HTTPException(status_code=400, detail="Không thể thay đổi vai trò của System Admin")

    if user.id == admin.id:
        raise HTTPException(status_code=400, detail="Bạn không thể tự thay đổi vai trò của chính mình")

    user.role = payload.role
    _write_audit(db, admin.id, "UPDATE_USER_ROLE", "user", f"{user_id}:{payload.role.value}")
    db.flush()

    enqueue_email(db,
        EmailService.send_role_updated_email,
        user.email,
        user.full_name or "Quý khách",
        payload.role.value,
        owner_user_id=user.id,
    )
    db.commit()

    return {"success": True, "user_id": str(user_id), "role": user.role.value if hasattr(user.role, "value") else user.role}


@router.post(
    "/users/bulk-ban",
    summary="Khóa tài khoản hàng loạt (Bulk Ban Users)",
    description="Khóa nhiều tài khoản người dùng cùng lúc kèm lý do và gửi email thông báo cho từng người.",
)
def bulk_ban_users(
    payload: BulkBanRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    banned_ids = []
    for uid in sorted(set(payload.user_ids), key=str):
        u = _locked_user(db, uid)
        if u and not u.is_deleted and u.id != admin.id and not _is_protected_account(u):
            u.is_active = False
            _revoke_user_sessions(db, u)
            _write_audit(db, admin.id, "BULK_BAN_USER", "user", str(uid))
            banned_ids.append(str(uid))
            enqueue_email(db,
                EmailService.send_account_banned_email,
                u.email,
                u.full_name or "Quý khách",
                payload.reason,
                owner_user_id=u.id,
            )
    db.commit()
    return {"success": True, "banned_count": len(banned_ids), "banned_ids": banned_ids}


@router.post(
    "/users/bulk-unban",
    summary="Mở khóa tài khoản hàng loạt (Bulk Unban Users)",
    description="Mở khóa nhiều tài khoản người dùng cùng lúc và gửi email thông báo.",
)
def bulk_unban_users(
    payload: BulkUnbanRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    unbanned_ids = []
    for uid in sorted(set(payload.user_ids), key=str):
        u = _locked_user(db, uid)
        if u and not u.is_deleted and u.id != admin.id:
            u.is_active = True
            _write_audit(db, admin.id, "BULK_UNBAN_USER", "user", str(uid))
            unbanned_ids.append(str(uid))
            enqueue_email(db,
                EmailService.send_account_unbanned_email,
                u.email,
                u.full_name or "Quý khách",
                owner_user_id=u.id,
            )
    db.commit()
    return {"success": True, "unbanned_count": len(unbanned_ids), "unbanned_ids": unbanned_ids}


def _deletion_request_out(request: UserDeletionRequest) -> dict:
    return {
        "id": str(request.id),
        "user_id": str(request.target_user_id),
        "mode": request.mode,
        "status": request.status,
        "checkpoint": request.purge_checkpoint,
        "file_total": request.file_total,
        "files_deleted": request.files_deleted,
        "error_code": request.error_code,
        "created_at": _iso_utc(request.created_at),
        "updated_at": _iso_utc(request.updated_at),
        "completed_at": _iso_utc(request.completed_at),
    }


# ─────────────────────────────────────────────────────────────
# SYSTEM CATEGORIES
# ─────────────────────────────────────────────────────────────

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
    category_type: str | None = Query(default=None, alias="type", pattern="^(INCOME|EXPENSE)$"),
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


def _validate_deletion_target(target: User, admin: User) -> None:
    if target.id == admin.id:
        raise HTTPException(status_code=400, detail="Bạn không thể tự xóa tài khoản của chính mình")
    if _is_protected_account(target):
        raise HTTPException(status_code=400, detail="Không thể xóa tài khoản Quản trị viên hoặc tài khoản hệ thống")


def _apply_soft_delete(
    db: Session,
    target: User,
    admin: User,
    reason: str,
    release_email: bool,
) -> UserDeletionRequest:
    _validate_deletion_target(target, admin)
    if target.is_deleted:
        raise HTTPException(status_code=409, detail="Tài khoản đã ở trạng thái xóa")
    timestamp = datetime.now(timezone.utc)
    email = target.email
    target.pre_delete_is_active = target.is_active
    target.email_before_delete_sealed = seal(email)
    target.email = deleted_email_alias(target.id) if release_email else email
    target.is_active = False
    target.is_deleted = True
    target.deletion_status = "SOFT_DELETED"
    target.deleted_at = timestamp
    target.deleted_by = admin.id
    _revoke_user_sessions(db, target, "admin_soft_delete")

    request = UserDeletionRequest(
        id=uuid.uuid4(),
        target_user_id=target.id,
        requested_by=admin.id,
        mode="soft",
        status="SOFT_DELETED",
        purge_checkpoint="COMPLETE",
        reason=reason,
        target_email_hash=email_fingerprint(email),
        target_email_sealed=seal(email),
        completed_at=timestamp,
    )
    db.add(request)
    _write_audit(db, admin.id, "SOFT_DELETE_USER", "user", str(target.id))
    enqueue_email(
        db,
        EmailService.send_account_deleted_email,
        email,
        target.full_name or "Quý khách",
        "soft",
        reason,
        dedupe_key=f"soft-delete-notice:{request.id}",
        owner_user_id=target.id,
    )
    return request


@router.delete(
    "/users/{user_id}",
    summary="Xóa mềm hoặc yêu cầu xóa vĩnh viễn người dùng",
)
def delete_user(
    user_id: UUID,
    payload: UserDeleteRequest,
    response: Response,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    target = _locked_user(db, user_id)
    if not target:
        raise HTTPException(status_code=404, detail="Không tìm thấy người dùng")
    _validate_deletion_target(target, admin)

    if payload.mode == "soft":
        request = _apply_soft_delete(db, target, admin, payload.reason, payload.release_email)
        db.commit()
        db.refresh(request)
        return {
            "message": "Đã xóa mềm tài khoản và thu hồi toàn bộ phiên đăng nhập",
            "deletion": _deletion_request_out(request),
        }

    if target.deletion_status == "PURGE_PENDING":
        raise HTTPException(status_code=409, detail="Yêu cầu xóa vĩnh viễn đang được xử lý")
    try:
        email = original_email(target, strict=True)
    except ValueError:
        raise HTTPException(status_code=409, detail="Không thể đọc email gốc để xác nhận xóa")
    confirmation = (payload.confirmation or "").strip()
    valid_phrase = confirmation.casefold() in {"xóa vĩnh viễn", "xoa vinh vien"}
    if confirmation.casefold() != email.casefold() and not valid_phrase:
        raise HTTPException(status_code=422, detail="Nội dung xác nhận xóa vĩnh viễn không khớp")

    timestamp = datetime.now(timezone.utc)
    if not target.is_deleted:
        target.pre_delete_is_active = target.is_active
        target.email_before_delete_sealed = seal(email)
    target.email = deleted_email_alias(target.id)
    target.is_active = False
    target.is_deleted = True
    target.deletion_status = "PURGE_PENDING"
    target.deleted_at = timestamp
    target.deleted_by = admin.id
    _revoke_user_sessions(db, target, "admin_hard_delete")

    request = UserDeletionRequest(
        id=uuid.uuid4(),
        target_user_id=target.id,
        requested_by=admin.id,
        mode="hard",
        status="PENDING",
        purge_checkpoint="REQUESTED",
        reason=payload.reason,
        target_email_hash=email_fingerprint(email),
        target_email_sealed=seal(email),
    )
    db.add(request)
    db.flush()
    _write_audit(db, admin.id, "HARD_DELETE_USER_REQUESTED", "user", str(target.id))
    enqueue_email(
        db,
        EmailService.send_account_deleted_email,
        email,
        target.full_name or "Quý khách",
        "hard",
        payload.reason,
        dedupe_key=f"hard-delete-notice:{request.id}",
    )
    enqueue(
        db,
        "USER_PURGE",
        {"request_id": str(request.id), "user_id": str(target.id)},
        f"user-purge:{request.id}",
        owner_user_id=target.id,
    )
    db.commit()
    db.refresh(request)
    response.status_code = http_status.HTTP_202_ACCEPTED
    return {
        "message": "Đã khóa tài khoản; worker đang xóa dữ liệu theo checkpoint",
        "deletion": _deletion_request_out(request),
    }


@router.post(
    "/users/bulk-delete",
    summary="Xóa mềm nhiều tài khoản",
)
def bulk_delete_users(
    payload: BulkDeleteRequest,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    deleted_ids = []
    skipped_ids = []
    for user_id in sorted(set(payload.user_ids), key=str):
        target = _locked_user(db, user_id)
        if not target or target.id == admin.id or _is_protected_account(target) or target.is_deleted:
            skipped_ids.append(str(user_id))
            continue
        _apply_soft_delete(db, target, admin, payload.reason, payload.release_email)
        deleted_ids.append(str(user_id))
    db.commit()
    return {
        "success": True,
        "deleted_count": len(deleted_ids),
        "deleted_ids": deleted_ids,
        "skipped_ids": skipped_ids,
    }


@router.post(
    "/users/{user_id}/restore",
    summary="Khôi phục tài khoản đã xóa mềm",
)
def restore_user(
    user_id: UUID,
    payload: RestoreUserRequest,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    target = _locked_user(db, user_id)
    if not target:
        raise HTTPException(status_code=404, detail="Không tìm thấy người dùng")
    _validate_deletion_target(target, admin)
    if target.deletion_status != "SOFT_DELETED":
        raise HTTPException(status_code=409, detail="Chỉ có thể khôi phục tài khoản đã xóa mềm")

    try:
        email = original_email(target, strict=True)
    except ValueError:
        raise HTTPException(status_code=409, detail="Không thể đọc email gốc để khôi phục")
    collision = db.scalar(
        select(User.id).where(func.lower(User.email) == email.casefold(), User.id != target.id)
    )
    if collision:
        raise HTTPException(
            status_code=409,
            detail="Email cũ đã được đăng ký lại; cần xử lý tài khoản trùng trước khi khôi phục",
        )

    target.email = email
    target.is_active = target.pre_delete_is_active if target.pre_delete_is_active is not None else True
    target.is_deleted = False
    target.deletion_status = "ACTIVE"
    target.deleted_at = None
    target.deleted_by = None
    target.email_before_delete_sealed = None
    target.pre_delete_is_active = None
    _revoke_user_sessions(db, target, "admin_restore")
    try:
        db.flush()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=409,
            detail="Email cũ vừa được một tài khoản khác sử dụng; không thể khôi phục",
        )

    request = db.scalar(
        select(UserDeletionRequest)
        .where(
            UserDeletionRequest.target_user_id == user_id,
            UserDeletionRequest.mode == "soft",
            UserDeletionRequest.status == "SOFT_DELETED",
        )
        .order_by(UserDeletionRequest.created_at.desc(), UserDeletionRequest.id.desc())
        .limit(1)
    )
    if request:
        request.status = "RESTORED"
        request.purge_checkpoint = "RESTORED"
        request.target_email_sealed = None
        request.updated_at = datetime.now(timezone.utc)
    _write_audit(db, admin.id, "RESTORE_USER", "user", str(target.id))
    enqueue_email(
        db,
        EmailService.send_account_restored_email,
        email,
        target.full_name or "Quý khách",
        dedupe_key=f"restore-user:{target.id}:{target.token_version}",
        owner_user_id=target.id,
    )
    db.commit()
    return {"message": "Đã khôi phục tài khoản", "user": _user_out(target), "reason": payload.reason}


@router.get(
    "/user-deletions/{request_id}",
    summary="Theo dõi tiến độ xóa vĩnh viễn",
)
def get_user_deletion(
    request_id: UUID,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    request = db.get(UserDeletionRequest, request_id)
    if not request:
        raise HTTPException(status_code=404, detail="Không tìm thấy yêu cầu xóa")
    return _deletion_request_out(request)


@router.post(
    "/user-deletions/{request_id}/retry-purge",
    status_code=http_status.HTTP_202_ACCEPTED,
    summary="Thử lại bước xóa dữ liệu bị lỗi",
)
def retry_user_deletion_purge(
    request_id: UUID,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    request = db.scalar(select(UserDeletionRequest).where(UserDeletionRequest.id == request_id).with_hint(
        UserDeletionRequest, "WITH (UPDLOCK, ROWLOCK)", dialect_name="mssql"
    ).execution_options(populate_existing=True))
    if not request:
        raise HTTPException(status_code=404, detail="Không tìm thấy yêu cầu xóa")
    if request.status != "FAILED" or request.purge_checkpoint == "DB_PURGED":
        raise HTTPException(status_code=409, detail="Yêu cầu không ở trạng thái có thể thử lại bước xóa dữ liệu")
    target = _locked_user(db, request.target_user_id)
    if not target or target.deletion_status != "PURGE_PENDING":
        raise HTTPException(status_code=409, detail="Tài khoản đích không còn ở trạng thái chờ xóa")
    request.status = "PENDING"
    request.purge_checkpoint = "REQUESTED"
    request.error_code = None
    request.updated_at = datetime.now(timezone.utc)
    enqueue(
        db,
        "USER_PURGE",
        {"request_id": str(request.id), "user_id": str(target.id)},
        f"user-purge-retry:{request.id}:{uuid.uuid4()}",
        owner_user_id=target.id,
    )
    _write_audit(db, admin.id, "RETRY_USER_PURGE", "user", str(request.target_user_id))
    db.commit()
    return _deletion_request_out(request)


@router.post(
    "/user-deletions/{request_id}/retry-files",
    status_code=http_status.HTTP_202_ACCEPTED,
    summary="Thử lại bước xóa file bị lỗi",
)
def retry_user_deletion_files(
    request_id: UUID,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    request = db.scalar(select(UserDeletionRequest).where(UserDeletionRequest.id == request_id).with_hint(
        UserDeletionRequest, "WITH (UPDLOCK, ROWLOCK)", dialect_name="mssql"
    ).execution_options(populate_existing=True))
    if not request:
        raise HTTPException(status_code=404, detail="Không tìm thấy yêu cầu xóa")
    if request.status != "FAILED" or request.purge_checkpoint != "DB_PURGED":
        raise HTTPException(status_code=409, detail="Yêu cầu không ở trạng thái có thể thử lại bước xóa file")
    failed = db.scalars(select(UserDeletionFile).where(
        UserDeletionFile.request_id == request_id, UserDeletionFile.status == "FAILED"
    )).all()
    if not failed:
        raise HTTPException(status_code=409, detail="Không có file lỗi để thử lại")
    for row in failed:
        row.status = "PENDING"
        row.attempts = 0
        row.error_code = None
    request.status = "FILES_PENDING"
    request.error_code = None
    request.updated_at = datetime.now(timezone.utc)
    enqueue(db, "USER_FILE_PURGE", {"request_id": str(request.id)}, f"user-file-purge-retry:{request.id}:{uuid.uuid4()}")
    _write_audit(db, admin.id, "RETRY_USER_FILE_PURGE", "user", str(request.target_user_id))
    db.commit()
    return _deletion_request_out(request)


# ─────────────────────────────────────────────────────────────
# EMAIL MANAGEMENT & AUDIT LOGS
# ─────────────────────────────────────────────────────────────

@router.post(
    "/email/test",
    summary="Gửi email kiểm thử hệ thống (Test SMTP Email)",
    description="Cho phép Quản trị viên gửi một email thử nghiệm đến địa chỉ bất kỳ để kiểm tra kết nối SMTP.",
)
def send_test_email(
    payload: SendTestEmailRequest,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    job = enqueue_email(db, EmailService.send_test_email, recipient=payload.recipient_email, subject=payload.subject, message=payload.message)
    _write_audit(db, admin.id, "SEND_TEST_EMAIL", "email", payload.recipient_email)
    db.commit()
    return {"success":True,"mode":"QUEUED","job_id":str(job.id),"message":"Đã xếp hàng gửi email thử. Xem nhật ký để kiểm tra kết quả."}



@router.get(
    "/email/logs",
    summary="Nhật ký gửi email (Email Delivery Audit Logs)",
    description="Danh sách phân trang toàn bộ email đã phát đi từ hệ thống (thời gian, người nhận, loại thư, trạng thái).",
)
def get_email_logs(
    page: int = Query(1, ge=1, description="Số trang"),
    page_size: int = Query(20, ge=1, le=100, description="Số bản ghi mỗi trang"),
    email_type: str | None = Query(None, description="Lọc theo loại email"),
    status: str | None = Query(None, description="Lọc theo trạng thái (SENT / LOGGED_DEV / FAILED)"),
    search: str | None = Query(None, description="Tìm theo email người nhận"),
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    q = select(EmailLog)
    if email_type:
        q = q.where(EmailLog.email_type == email_type)
    if status:
        q = q.where(EmailLog.status == status)
    if search:
        q = q.where(EmailLog.recipient.ilike(f"%{search}%"))

    total = db.scalar(select(func.count()).select_from(q.subquery()))
    logs = db.scalars(
        q.order_by(EmailLog.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    ).all()

    return {
        "items": [
            {
                "id": str(l.id),
                "recipient": l.recipient,
                "recipient_email": l.recipient,
                "subject": l.subject,
                "email_type": l.email_type,
                "status": l.status,
                "error_message": l.error_message,
                "created_at": _iso_utc(l.created_at),
            }
            for l in logs
        ],
        "total": total,
        "page": page,
        "page_size": page_size,
    }


@router.get(
    "/email/settings",
    summary="Xem cấu hình SMTP hiện tại (Get SMTP Settings)",
    description="Lấy thông tin cấu hình máy chủ gửi thư SMTP.",
)
def get_email_settings(
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    # Ưu tiên đọc từ DB, fallback về settings (.env)
    db_smtp = _load_smtp_from_db(db)
    smtp_host = db_smtp.get("smtp_host", settings.smtp_host) if db_smtp else settings.smtp_host
    smtp_port = db_smtp.get("smtp_port", settings.smtp_port) if db_smtp else settings.smtp_port
    smtp_user = db_smtp.get("smtp_user", settings.smtp_user) if db_smtp else settings.smtp_user
    smtp_password = db_smtp.get("smtp_password", settings.smtp_password) if db_smtp else settings.smtp_password
    smtp_tls = db_smtp.get("smtp_tls", settings.smtp_tls) if db_smtp else settings.smtp_tls
    smtp_ssl = db_smtp.get("smtp_ssl", settings.smtp_ssl) if db_smtp else settings.smtp_ssl
    emails_from_email = db_smtp.get("emails_from_email", settings.emails_from_email) if db_smtp else settings.emails_from_email
    emails_from_name = db_smtp.get("emails_from_name", settings.emails_from_name) if db_smtp else settings.emails_from_name

    is_dual = not (smtp_user and smtp_password and smtp_user.strip())
    return {
        "smtp_host": smtp_host,
        "smtp_port": smtp_port,
        "smtp_user": smtp_user,
        "has_password": bool(smtp_password),
        "smtp_tls": smtp_tls,
        "smtp_ssl": smtp_ssl,
        "emails_from_email": emails_from_email,
        "emails_from_name": emails_from_name,
        "is_dual_mode": is_dual,
        "mode_display": "Dual-Mode (Console & Preview)" if is_dual else "Real SMTP (Gmail/Custom)",
        "source": "database" if db_smtp else "env_file",
    }


@router.put(
    "/email/settings",
    summary="Cập nhật cấu hình SMTP (Update SMTP Settings)",
    description="Cho phép Quản trị viên cập nhật cấu hình máy chủ gửi thư SMTP trực tiếp từ giao diện.",
)
def update_email_settings(
    payload: SMTPSettingsUpdate,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    # Lưu bền vững vào CSDL (system_settings)
    _save_smtp_to_db(db, payload, admin.id)

    # Đồng thời cập nhật settings RAM cho worker hiện tại
    settings.smtp_host = payload.smtp_host
    settings.smtp_port = payload.smtp_port
    settings.smtp_user = payload.smtp_user
    if payload.smtp_password:
        settings.smtp_password = payload.smtp_password
    settings.smtp_tls = payload.smtp_tls
    settings.smtp_ssl = payload.smtp_ssl
    settings.emails_from_email = payload.emails_from_email
    settings.emails_from_name = payload.emails_from_name

    _write_audit(db, admin.id, "UPDATE_SMTP_SETTINGS", "settings", payload.smtp_user)
    db.commit()

    is_dual = not (settings.smtp_user and settings.smtp_password and settings.smtp_user.strip())
    return {
        "success": True,
        "message": "Đã cập nhật cấu hình SMTP thành công và lưu bền vững vào CSDL!",
        "is_dual_mode": is_dual,
    }




# ─────────────────────────────────────────────────────────────
# SMTP DB HELPERS
# ─────────────────────────────────────────────────────────────

_SMTP_KEYS = ["smtp_host", "smtp_port", "smtp_user", "smtp_password", "smtp_tls", "smtp_ssl", "emails_from_email", "emails_from_name"]

def _save_smtp_to_db(db: Session, payload, admin_id: UUID):
    """Lưu cấu hình SMTP vào bảng system_settings."""
    data = {
        "smtp_host": payload.smtp_host,
        "smtp_port": str(payload.smtp_port),
        "smtp_user": payload.smtp_user,
        "smtp_password": payload.smtp_password or "",
        "smtp_tls": str(payload.smtp_tls),
        "smtp_ssl": str(payload.smtp_ssl),
        "emails_from_email": payload.emails_from_email,
        "emails_from_name": payload.emails_from_name,
    }
    from datetime import datetime, timezone
    now = datetime.now(timezone.utc)
    for key, value in data.items():
        # An empty password means keep the existing secret (same as the runtime update).
        if key == "smtp_password" and not value:
            continue
        if key == "smtp_password":
            value = seal(value)
        existing = db.scalar(select(SystemSetting).where(SystemSetting.key == key))
        if existing:
            existing.value = value
            existing.updated_at = now
            existing.updated_by = admin_id
        else:
            db.add(SystemSetting(key=key, value=value, updated_at=now, updated_by=admin_id))


def _load_smtp_from_db(db: Session) -> SMTPConfig | None:
    """Đọc cấu hình SMTP từ bảng system_settings. Trả về dict hoặc None nếu chưa cấu hình."""
    rows = db.scalars(select(SystemSetting).where(SystemSetting.key.in_(_SMTP_KEYS))).all()
    if not rows:
        return None
    result: dict[str, str | None] = {
        row.key: (unseal(row.value) if row.key == "smtp_password" and row.value else row.value)
        for row in rows
    }
    if len(result) < 3:  # Chưa đủ cấu hình tối thiểu
        return None

    def text_value(key: str, fallback: str) -> str:
        value = result.get(key)
        return value if value is not None else fallback

    def bool_value(key: str, fallback: bool) -> bool:
        value = result.get(key)
        return value.strip().lower() in {"true", "1", "yes"} if value is not None else fallback

    return {
        "smtp_host": text_value("smtp_host", settings.smtp_host),
        "smtp_port": int(result["smtp_port"]) if result.get("smtp_port") else settings.smtp_port,
        "smtp_user": text_value("smtp_user", settings.smtp_user),
        "smtp_password": text_value("smtp_password", settings.smtp_password),
        "smtp_tls": bool_value("smtp_tls", settings.smtp_tls),
        "smtp_ssl": bool_value("smtp_ssl", settings.smtp_ssl),
        "emails_from_email": text_value("emails_from_email", settings.emails_from_email),
        "emails_from_name": text_value("emails_from_name", settings.emails_from_name),
    }


# ─────────────────────────────────────────────────────────────
# AUDIT LOGS
# ─────────────────────────────────────────────────────────────

@router.get(
    "/audit-logs",
    summary="Nhật ký hệ thống (Audit Logs)",
    description="Lấy danh sách nhật ký hành động quản trị (phân trang) của các Admin trong hệ thống.",
)
def audit_logs(
    page: int = Query(1, ge=1, description="Số trang"),
    page_size: int = Query(50, ge=1, le=200, description="Số bản ghi mỗi trang"),
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    total = db.scalar(select(func.count(AuditLog.id)))
    logs = db.scalars(
        select(AuditLog)
        .order_by(AuditLog.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    ).all()
    return {
        "items": [
            {
                "id": str(l.id),
                "admin_id": str(l.user_id),
                "action": l.action,
                "target_type": l.entity_type,
                "target_id": l.entity_id,
                "created_at": _iso_utc(l.created_at),
            }
            for l in logs
        ],
        "total": total,
        "page": page,
        "page_size": page_size,
    }


# ─────────────────────────────────────────────────────────────
# SYSTEM ANALYTICS
# ─────────────────────────────────────────────────────────────

@router.get(
    "/system/analytics",
    summary="Phân tích vận hành hệ thống (System Analytics)",
    description="Thống kê vận hành hệ thống dạng tổng hợp (không chứa dữ liệu cá nhân).",
)
def system_analytics(
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    today = date.today()

    total_tx = db.scalar(select(func.count(Transaction.id))) or 0
    total_income_tx = db.scalar(select(func.count(Transaction.id)).where(Transaction.type == "INCOME")) or 0
    total_expense_tx = db.scalar(select(func.count(Transaction.id)).where(Transaction.type == "EXPENSE")) or 0

    month_start_q = text(
        "SELECT COUNT(*) as cnt FROM transactions WHERE MONTH(transaction_date) = :m AND YEAR(transaction_date) = :y"
    )
    tx_this_month = db.execute(month_start_q, {"m": today.month, "y": today.year}).scalar() or 0

    top_categories_q = text("""
        SELECT TOP 5 c.name, COUNT(t.id) as tx_count
        FROM transactions t
        LEFT JOIN categories c ON t.category_id = c.id
        GROUP BY c.name
        ORDER BY tx_count DESC
    """)
    top_categories = [
        {"name": row[0] or "Không phân loại", "transaction_count": row[1]}
        for row in db.execute(top_categories_q).fetchall()
    ]

    active_users_q = text(
        "SELECT COUNT(DISTINCT user_id) FROM transactions WHERE MONTH(transaction_date) = :m AND YEAR(transaction_date) = :y"
    )
    active_users_this_month = db.execute(active_users_q, {"m": today.month, "y": today.year}).scalar() or 0

    return {
        "period": {"month": today.month, "year": today.year},
        "transactions": {
            "total_all_time": total_tx,
            "this_month": tx_this_month,
            "income_count": total_income_tx,
            "expense_count": total_expense_tx,
        },
        "active_users_this_month": active_users_this_month,
        "top_categories": top_categories,
    }


# ─────────────────────────────────────────────────────────────
# OCR MONITOR
# ─────────────────────────────────────────────────────────────

@router.get(
    "/system/ocr-monitor",
    summary="Giám sát hệ thống OCR (OCR Monitor)",
    description="Giám sát hiệu suất vận hành dịch vụ OCR.",
)
def ocr_monitor(
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    total_invoices = db.scalar(select(func.count(Invoice.id))) or 0
    completed = db.scalar(select(func.count(Invoice.id)).where(Invoice.status == "CONFIRMED")) or 0
    failed = db.scalar(select(func.count(Invoice.id)).where(Invoice.status == "FAILED")) or 0
    processing = db.scalar(select(func.count(Invoice.id)).where(Invoice.status == "PROCESSING")) or 0
    review_required = db.scalar(select(func.count(Invoice.id)).where(Invoice.status == "REVIEW_REQUIRED")) or 0
    uploaded = db.scalar(select(func.count(Invoice.id)).where(Invoice.status == "UPLOADED")) or 0

    ocr_success_rate = round(completed / total_invoices * 100, 1) if total_invoices else 0.0

    total_jobs = db.scalar(select(func.count(OcrJob.id))) or 0
    failed_jobs = db.scalar(select(func.count(OcrJob.id)).where(OcrJob.status == "FAILED")) or 0
    average_processing_ms = db.scalar(
        select(func.avg(OcrJob.processing_ms)).where(OcrJob.processing_ms.is_not(None))
    )

    recent_failures_q = (
        select(OcrJob.id, OcrJob.status, OcrJob.error_message, OcrJob.created_at)
        .where(OcrJob.status == "FAILED")
        .order_by(OcrJob.created_at.desc())
        .limit(10)
    )
    recent_failures = [
        {
            "job_id": str(j.id),
            "error": j.error_message,
            "created_at": _iso_utc(j.created_at),
        }
        for j in db.execute(recent_failures_q).fetchall()
    ]

    return {
        "invoices": {
            "total": total_invoices,
            "completed": completed,
            "failed": failed,
            "processing": processing,
            "review_required": review_required,
            "uploaded": uploaded,
            "success_rate_pct": ocr_success_rate,
        },
        "ocr_jobs": {
            "total": total_jobs,
            "failed": failed_jobs,
            "error_rate_pct": round(failed_jobs / total_jobs * 100, 1) if total_jobs else 0.0,
            "average_processing_ms": round(float(average_processing_ms), 0) if average_processing_ms is not None else None,
        },
        "recent_failures": recent_failures,
    }


@router.post("/system/ocr-jobs/{job_id}/retry", status_code=202)
def retry_failed_ocr_job(
    job_id: UUID,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    job = db.scalar(
        select(OcrJob).where(OcrJob.id == job_id).with_hint(
            OcrJob, "WITH (UPDLOCK, ROWLOCK)", dialect_name="mssql"
        ).execution_options(populate_existing=True)
    )
    if not job or job.status != "FAILED" or not job.invoice_id:
        raise HTTPException(status_code=404, detail="Không tìm thấy lượt OCR lỗi có thể xử lý lại")
    from app.api.routes.invoices import _enqueue_ocr

    result = _enqueue_ocr(db, job.invoice_id, job.user_id)
    _write_audit(db, admin.id, "OCR_RETRY", "ocr_job", str(job.id))
    db.commit()
    return result


# ─────────────────────────────────────────────────────────────
# HELPER
# ─────────────────────────────────────────────────────────────

def _write_audit(db: Session, admin_id: UUID, action: str, target_type: str, target_id: str | None = None):
    entity_uuid = None
    metadata_val = None
    if target_id:
        try:
            entity_uuid = UUID(target_id)
        except Exception:
            entity_uuid = None
            import json
            metadata_val = json.dumps({"target": target_id}, ensure_ascii=False)

    log = AuditLog(
        user_id=admin_id,
        action=action,
        entity_type=target_type,
        entity_id=entity_uuid,
        metadata_json=metadata_val
    )
    db.add(log)


def _is_protected_account(user: User) -> bool:
    return user.is_system_account or user.role == UserRole.ADMIN


def _ensure_not_deleted(user: User) -> None:
    if user.is_deleted:
        raise HTTPException(status_code=409, detail="Tài khoản đã bị xóa hoặc đang chờ xóa vĩnh viễn")


def _revoke_user_sessions(db: Session, user: User, reason: str = "admin_ban"):
    user.token_version += 1
    db.query(RefreshToken).filter(RefreshToken.user_id == user.id, RefreshToken.revoked_at.is_(None)).update(
        {"revoked_at": datetime.now(timezone.utc), "revocation_reason": reason}, synchronize_session="fetch"
    )


def _locked_user(db, user_id):
    return db.scalar(select(User).where(User.id == user_id).with_hint(
        User, "WITH (UPDLOCK, ROWLOCK)", dialect_name="mssql"
    ).execution_options(populate_existing=True))
