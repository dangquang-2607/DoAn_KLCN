"""
Admin routes — Dashboard KPIs, Quản lý người dùng, Giám sát hệ thống, Nhật ký Email & Cấu hình SMTP.
Tất cả endpoints đều yêu cầu quyền ADMIN (hoặc SCOPE=admin:read / admin:write).
"""
from datetime import date, datetime, timedelta, timezone
from uuid import UUID
import uuid
import secrets

from fastapi import APIRouter, Depends, HTTPException, Query, BackgroundTasks
from pydantic import BaseModel, EmailStr
from sqlalchemy import func, select, text
from sqlalchemy.orm import Session

from app.api.dependencies import get_db, require_admin
from app.core.config import settings
from app.core.security import hash_password
from app.models.audit_log import AuditLog
from app.models.invoice import Invoice
from app.models.ocr_job import OcrJob
from app.models.transaction import Transaction
from app.models.user import User, UserRole
from app.models.refresh_token import RefreshToken
from app.models.email_log import EmailLog
from app.models.system_setting import SystemSetting
from app.services.email_service import EmailService
from app.services.jobs import enqueue_email
from app.services.sessions import revoke_sessions
from app.core.secrets_store import seal, unseal

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
    total_users = db.scalar(select(func.count(User.id))) or 0
    active_users = db.scalar(select(func.count(User.id)).where(User.is_active == True)) or 0
    banned_users = db.scalar(select(func.count(User.id)).where(User.is_active == False)) or 0

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

def _user_out(u: User) -> dict:
    return {
        "id": str(u.id),
        "email": u.email,
        "full_name": u.full_name,
        "role": u.role.value if hasattr(u.role, "value") else u.role,
        "is_active": u.is_active,
        "must_change_password": getattr(u, 'must_change_password', False),
        "created_at": _iso_utc(u.created_at),
        "last_login_at": _iso_utc(u.last_login_at),
        "last_active_at": _iso_utc(getattr(u, 'last_active_at', None)),
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
    status: str | None = Query(None, description="Lọc theo trạng thái (active / banned)"),
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    q = select(User)

    if search:
        term = f"%{search}%"
        q = q.where((User.email.ilike(term)) | (User.full_name.ilike(term)))
    if role:
        q = q.where(User.role == role)
    if status == "active":
        q = q.where(User.is_active == True)
    elif status == "banned":
        q = q.where(User.is_active == False)

    total = db.scalar(select(func.count()).select_from(q.subquery()))
    users = db.scalars(
        q.order_by(User.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    ).all()

    return {
        "items": [_user_out(u) for u in users],
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

    data = _user_out(user)
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

    role_str = str(payload.role).upper()
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
    if user.role == UserRole.ADMIN or user.email in ["admin@capitalflow.vn", "admin@cashflow.vn"]:
        raise HTTPException(status_code=400, detail="Không thể khóa tài khoản Quản trị viên")

    user.is_active = False
    _revoke_user_sessions(db, user)
    _write_audit(db, admin.id, "BAN_USER", "user", str(user_id))
    db.flush()

    enqueue_email(db,
        EmailService.send_account_banned_email,
        user.email,
        user.full_name or "Quý khách",
        "Tài khoản bị tạm ngưng bởi Quản trị viên"
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

    user.is_active = True
    _write_audit(db, admin.id, "UNBAN_USER", "user", str(user_id))
    db.flush()

    enqueue_email(db,
        EmailService.send_account_unbanned_email,
        user.email,
        user.full_name or "Quý khách"
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

    if user.email in ["admin@capitalflow.vn", "admin@cashflow.vn"]:
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
        payload.role.value
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
        if u and u.id != admin.id and u.email not in ["admin@capitalflow.vn", "admin@cashflow.vn"] and u.role != UserRole.ADMIN:
            u.is_active = False
            _revoke_user_sessions(db, u)
            _write_audit(db, admin.id, "BULK_BAN_USER", "user", str(uid))
            banned_ids.append(str(uid))
            enqueue_email(db,
                EmailService.send_account_banned_email,
                u.email,
                u.full_name or "Quý khách",
                payload.reason
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
        if u and u.id != admin.id:
            u.is_active = True
            _write_audit(db, admin.id, "BULK_UNBAN_USER", "user", str(uid))
            unbanned_ids.append(str(uid))
            enqueue_email(db,
                EmailService.send_account_unbanned_email,
                u.email,
                u.full_name or "Quý khách"
            )
    db.commit()
    return {"success": True, "unbanned_count": len(unbanned_ids), "unbanned_ids": unbanned_ids}


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


def _load_smtp_from_db(db: Session) -> dict | None:
    """Đọc cấu hình SMTP từ bảng system_settings. Trả về dict hoặc None nếu chưa cấu hình."""
    rows = db.scalars(select(SystemSetting).where(SystemSetting.key.in_(_SMTP_KEYS))).all()
    if not rows:
        return None
    result = {r.key: (unseal(r.value) if r.key=="smtp_password" else r.value) for r in rows}
    if len(result) < 3:  # Chưa đủ cấu hình tối thiểu
        return None
    # Convert types
    if "smtp_port" in result:
        result["smtp_port"] = int(result["smtp_port"]) if result["smtp_port"] else 587
    if "smtp_tls" in result:
        result["smtp_tls"] = result["smtp_tls"].lower() in ("true", "1", "yes")
    if "smtp_ssl" in result:
        result["smtp_ssl"] = result["smtp_ssl"].lower() in ("true", "1", "yes")
    return result


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
        },
        "recent_failures": recent_failures,
    }


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


def _revoke_user_sessions(db: Session, user: User):
    user.token_version += 1
    db.query(RefreshToken).filter(RefreshToken.user_id == user.id, RefreshToken.revoked_at.is_(None)).update(
        {"revoked_at": datetime.now(timezone.utc), "revocation_reason": "admin_ban"}, synchronize_session="fetch"
    )


def _locked_user(db, user_id):
    return db.scalar(select(User).where(User.id == user_id).with_hint(
        User, "WITH (UPDLOCK, ROWLOCK)", dialect_name="mssql"
    ).execution_options(populate_existing=True))
