"""
API quản lý danh sách, chi tiết, khóa/mở khóa, vai trò và thao tác hàng loạt.
Tiền tố đường dẫn: /admin/users*
"""
import secrets
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.orm import Session, load_only

from app.dung_chung.http.phu_thuoc import get_db, require_admin
from app.dung_chung.security.passwords import hash_password
from app.chuc_nang.nguoi_dung.hoa_don_ai.luu_tru.invoice import Invoice
from app.chuc_nang.nguoi_dung.tai_chinh.giao_dich.luu_tru.giao_dich import Transaction
from app.chuc_nang.nguoi_dung.dang_nhap.luu_tru.nguoi_dung import User, UserRole
from app.dung_chung.email.dich_vu import EmailService
from app.dung_chung.tac_vu_nen.hang_doi import enqueue_email
from app.chuc_nang.nguoi_dung.dang_nhap.nghiep_vu.session_management import revoke_sessions
from app.chuc_nang.nguoi_dung.goi_dich_vu.luu_tru import Subscription
from app.chuc_nang.nguoi_dung.goi_dich_vu.han_muc import utcnow
from app.chuc_nang.nguoi_dung.goi_dich_vu.dich_vu import iso

from app.chuc_nang.quan_tri.dung_chung.tien_ich import (
    BulkBanRequest,
    BulkUnbanRequest,
    UserRoleUpdate,
    _bulk_skip,
    _is_protected_account,
    _locked_user,
    _search_pattern,
    _user_out,
    _write_audit,
)

router = APIRouter()

_USER_DISPLAY_FIELDS = (
    User.id, User.email, User.full_name, User.role, User.is_active,
    User.is_system_account, User.must_change_password, User.support_only,
    User.created_at, User.last_login_at, User.last_active_at,
)


def _plan_out(until, instant):
    return {"plan": "PREMIUM" if until and until > instant else "FREE", "premium_until": iso(until)}


@router.get(
    "/users",
    summary="Danh sách người dùng (List Users)",
    description="Danh sách người dùng có phân trang, hỗ trợ tìm kiếm theo email/họ tên và lọc theo vai trò/trạng thái.",
)
def list_users(
    page: int = Query(1, ge=1, description="Số trang"),
    page_size: int = Query(20, ge=1, le=100, description="Số bản ghi mỗi trang"),
    search: str | None = Query(None, max_length=255, description="Tìm theo email hoặc họ tên"),
    role: UserRole | None = Query(None, description="Lọc theo vai trò (USER / ADMIN)"),
    status: str | None = Query(None, pattern="^(active|banned)$", description="Lọc theo trạng thái"),
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    q = select(User.id)

    if search:
        clean_search = search.strip()
        term = _search_pattern(clean_search)
        search_predicate = User.email.ilike(term, escape="\\") | User.full_name.ilike(term, escape="\\")
        q = q.where(search_predicate)

    if role:
        q = q.where(User.role == role)
    if status == "active":
        q = q.where(User.is_active == True)
    elif status == "banned":
        q = q.where(User.is_active == False)

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
    subscriptions = {user_id: premium_until for user_id, premium_until in db.execute(
        select(Subscription.user_id, Subscription.premium_until)
        .where(Subscription.user_id.in_(page_ids))).all()} if page_ids else {}
    instant = utcnow()

    return {
        "items": [{**_user_out(u), **_plan_out(subscriptions.get(u.id), instant)} for u in users],
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

    data = _user_out(user)
    subscription = db.get(Subscription, user_id)
    data.update(_plan_out(subscription.premium_until if subscription else None, utcnow()))
    data["stats"] = {
        "transactions_count": tx_count,
        "invoices_count": inv_count,
    }
    return data


@router.post(
    "/users/{user_id}/reset-password",
    summary="Cấp lại mật khẩu tạm thời cho người dùng",
    description="Quản trị viên tạo mật khẩu tạm thời mới và gửi thẳng đến email của người dùng.",
)
def admin_reset_user_password(
    user_id: UUID,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    target_user = _locked_user(db, user_id)
    if not target_user:
        raise HTTPException(status_code=404, detail="Không tìm thấy người dùng.")
    if target_user.is_system_account or target_user.id == admin.id:
        raise HTTPException(400, "Không thể cấp lại mật khẩu cho System Admin hoặc chính mình")

    new_temp_pass = secrets.token_urlsafe(18)
    target_user.password_hash = hash_password(new_temp_pass)
    target_user.must_change_password = True
    revoke_sessions(db, target_user, "admin_password_reset")
    db.flush()

    _write_audit(db, admin.id, "RESET_USER_PASSWORD", "user", str(target_user.id),
                 after={"temporary_access_issued": True, "sessions_revoked": True})

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
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    user = _locked_user(db, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="Không tìm thấy người dùng")
    if _is_protected_account(user):
        raise HTTPException(status_code=400, detail="Không thể khóa tài khoản Quản trị viên")
    if not user.is_active:
        return {"message": "Tài khoản đã bị khóa", "user_id": str(user_id)}

    user.is_active = False
    revoke_sessions(db, user, "admin_ban")
    _write_audit(db, admin.id, "BAN_USER", "user", str(user_id),
                 before={"is_active": True}, after={"is_active": False, "sessions_revoked": True})
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
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    user = _locked_user(db, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="Không tìm thấy người dùng")

    if user.is_system_account or user.id == admin.id:
        raise HTTPException(400, "Không thể mở khóa System Admin hoặc chính mình")
    if user.is_active:
        return {"message": "Tài khoản đang hoạt động", "user_id": str(user_id)}

    user.is_active = True
    _write_audit(db, admin.id, "UNBAN_USER", "user", str(user_id),
                 before={"is_active": False}, after={"is_active": True})
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
    description="Chỉ System Admin được thay đổi vai trò ADMIN / USER. Thu hồi phiên đăng nhập, gửi email và ghi nhật ký khi vai trò thay đổi.",
)
def update_user_role(
    user_id: UUID,
    payload: UserRoleUpdate,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    if not admin.is_system_account:
        raise HTTPException(403, "Chỉ System Admin được cấp hoặc gỡ quyền ADMIN")
    user = _locked_user(db, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="Không tìm thấy người dùng")

    if user.is_system_account:
        raise HTTPException(status_code=400, detail="Không thể thay đổi vai trò của System Admin")

    if user.id == admin.id:
        raise HTTPException(status_code=400, detail="Bạn không thể tự thay đổi vai trò của chính mình")
    support_only = payload.role == UserRole.ADMIN and payload.support_only
    if user.role == payload.role and user.support_only == support_only:
        return {"success": True, "user_id": str(user_id), "role": payload.role.value}

    previous = {"role": user.role, "support_only": user.support_only}
    user.role = payload.role
    user.support_only = support_only
    revoke_sessions(db, user, "admin_role_changed")
    _write_audit(db, admin.id, "UPDATE_USER_ROLE", "user", str(user_id),
                 before=previous, after={"role": user.role, "support_only": user.support_only, "sessions_revoked": True})
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
    description="Tối đa 100 ID, loại bỏ ID trùng. Khóa các tài khoản hợp lệ; trả banned_ids và skipped kèm lý do cho từng tài khoản không xử lý.",
)
def bulk_ban_users(
    payload: BulkBanRequest,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    banned_ids = []
    skipped = []
    for uid in sorted(set(payload.user_ids), key=str):
        u = _locked_user(db, uid)
        skip = _bulk_skip(u, admin.id, banning=True)
        if skip:
            skipped.append({"user_id": str(uid), "reason": skip[0], "message": skip[1]})
        elif u is not None:
            u.is_active = False
            revoke_sessions(db, u, "admin_ban")
            _write_audit(db, admin.id, "BULK_BAN_USER", "user", str(uid),
                         before={"is_active": True}, after={"is_active": False, "sessions_revoked": True})
            banned_ids.append(str(uid))
            enqueue_email(db,
                EmailService.send_account_banned_email,
                u.email,
                u.full_name or "Quý khách",
                payload.reason,
                owner_user_id=u.id,
            )
    db.commit()
    return {"success": True, "banned_count": len(banned_ids), "banned_ids": banned_ids,
            "skipped_count": len(skipped), "skipped": skipped}


@router.post(
    "/users/bulk-unban",
    summary="Mở khóa tài khoản hàng loạt (Bulk Unban Users)",
    description="Tối đa 100 ID, loại bỏ ID trùng. Mở khóa các tài khoản hợp lệ; trả unbanned_ids và skipped kèm lý do cho từng tài khoản không xử lý.",
)
def bulk_unban_users(
    payload: BulkUnbanRequest,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    unbanned_ids = []
    skipped = []
    for uid in sorted(set(payload.user_ids), key=str):
        u = _locked_user(db, uid)
        skip = _bulk_skip(u, admin.id, banning=False)
        if skip:
            skipped.append({"user_id": str(uid), "reason": skip[0], "message": skip[1]})
        elif u is not None:
            u.is_active = True
            _write_audit(db, admin.id, "BULK_UNBAN_USER", "user", str(uid),
                         before={"is_active": False}, after={"is_active": True})
            unbanned_ids.append(str(uid))
            enqueue_email(db,
                EmailService.send_account_unbanned_email,
                u.email,
                u.full_name or "Quý khách",
                owner_user_id=u.id,
            )
    db.commit()
    return {"success": True, "unbanned_count": len(unbanned_ids), "unbanned_ids": unbanned_ids,
            "skipped_count": len(skipped), "skipped": skipped}
