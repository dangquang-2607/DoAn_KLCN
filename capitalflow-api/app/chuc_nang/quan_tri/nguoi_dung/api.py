"""
API quản lý danh sách, chi tiết, tạo mới, khóa/mở khóa, vai trò và thao tác hàng loạt.
Tiền tố đường dẫn: /admin/users*
"""
import secrets
import uuid
from uuid import UUID

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.orm import Session, load_only

from app.dung_chung.http.phu_thuoc import get_db, require_admin
from app.dung_chung.security.passwords import hash_password
from app.chuc_nang.nguoi_dung.hoa_don_ai.luu_tru.invoice import Invoice
from app.chuc_nang.nguoi_dung.tai_chinh.giao_dich.luu_tru.giao_dich import Transaction
from app.chuc_nang.nguoi_dung.dang_nhap.luu_tru.nguoi_dung import User, UserRole
from app.chuc_nang.quan_tri.nguoi_dung.luu_tru.xoa_nguoi_dung import UserDeletionRequest
from app.dung_chung.email.dich_vu import EmailService
from app.dung_chung.tac_vu_nen.hang_doi import enqueue_email
from app.chuc_nang.nguoi_dung.dang_nhap.nghiep_vu.session_management import revoke_sessions

from app.chuc_nang.quan_tri.dung_chung.tien_ich import (
    AdminCreateUserRequest,
    BulkBanRequest,
    BulkUnbanRequest,
    UserRoleUpdate,
    _deletion_request_out,
    _ensure_not_deleted,
    _is_protected_account,
    _iso_utc,
    _locked_user,
    _revoke_user_sessions,
    _user_out,
    _write_audit,
)

router = APIRouter()

_USER_DISPLAY_FIELDS = (
    User.id, User.email, User.full_name, User.role, User.is_active, User.is_deleted,
    User.deletion_status, User.deleted_at, User.is_system_account, User.must_change_password,
    User.created_at, User.last_login_at, User.last_active_at, User.email_before_delete_sealed,
)
_DELETION_DISPLAY_FIELDS = (
    UserDeletionRequest.id, UserDeletionRequest.target_user_id, UserDeletionRequest.mode,
    UserDeletionRequest.status, UserDeletionRequest.purge_checkpoint, UserDeletionRequest.file_total,
    UserDeletionRequest.files_deleted, UserDeletionRequest.error_code, UserDeletionRequest.created_at,
    UserDeletionRequest.updated_at, UserDeletionRequest.completed_at,
)


def _latest_deletions(db: Session, user_ids: list[UUID]) -> dict[UUID, UserDeletionRequest]:
    """Chỉ lấy yêu cầu mới nhất mỗi người, không tải toàn bộ lịch sử xóa."""
    if not user_ids:
        return {}
    ranked = select(
        UserDeletionRequest.id,
        func.row_number().over(
            partition_by=UserDeletionRequest.target_user_id,
            order_by=(UserDeletionRequest.created_at.desc(), UserDeletionRequest.id.desc()),
        ).label("position"),
    ).where(UserDeletionRequest.target_user_id.in_(user_ids)).subquery()
    rows = db.scalars(select(UserDeletionRequest)
                      .options(load_only(*_DELETION_DISPLAY_FIELDS, raiseload=True))
                      .where(UserDeletionRequest.id.in_(select(ranked.c.id).where(ranked.c.position == 1))))
    return {row.target_user_id: row for row in rows}


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
    from app.chuc_nang.quan_tri.nguoi_dung.vong_doi.dich_vu import email_fingerprint

    q = select(User.id)

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
    page_ids = db.scalars(
        q.order_by(User.created_at.desc(), User.id.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    ).all()

    # Chỉ đọc thông tin hiển thị sau khi đã giới hạn trang, không đọc password_hash.
    users_by_id = {user.id: user for user in db.scalars(select(User)
        .options(load_only(*_USER_DISPLAY_FIELDS, raiseload=True))
        .where(User.id.in_(page_ids)))} if page_ids else {}
    users = [users_by_id[identifier] for identifier in page_ids if identifier in users_by_id]
    latest_deletions = _latest_deletions(db, [user.id for user in users])

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
    # GET không cần UPDLOCK: không giữ khóa cập nhật trong lúc tính thống kê.
    user = db.scalar(select(User).options(load_only(*_USER_DISPLAY_FIELDS, raiseload=True))
                     .where(User.id == user_id))
    if not user:
        raise HTTPException(status_code=404, detail="Không tìm thấy người dùng")

    tx_count = db.scalar(
        select(func.count(Transaction.id)).where(Transaction.user_id == user_id)
    )
    inv_count = db.scalar(
        select(func.count(Invoice.id)).where(Invoice.user_id == user_id)
    )

    deletion = _latest_deletions(db, [user_id]).get(user_id)
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
    existing = db.scalar(select(User).where(User.email == payload.email))
    if existing:
        raise HTTPException(status_code=400, detail="Địa chỉ email này đã được sử dụng trong hệ thống.")

    role_str = payload.role.upper()
    role_enum = UserRole.ADMIN if role_str == "ADMIN" else UserRole.USER

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

    _write_audit(db, admin.id, "CREATE_USER", "user", str(new_user.id))

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

    _write_audit(db, admin.id, "RESET_USER_PASSWORD", "user", str(target_user.id))

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
