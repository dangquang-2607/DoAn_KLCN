"""
Các hàm hỗ trợ, schema và tiện ích dùng chung của module quản trị.
Dùng chung cho tất cả các phân hệ con trong module quản trị.
"""
import json
from datetime import timezone
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, EmailStr, Field, field_validator
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.chuc_nang.quan_tri.nhat_ky_quan_tri.luu_tru.nhat_ky import AuditLog
from app.chuc_nang.nguoi_dung.dang_nhap.luu_tru.nguoi_dung import User, UserRole
from app.dung_chung.text.unicode import validate_utf16_length


# ─────────────────────────────────────────────────────────────
# SCHEMA REQUEST
# ─────────────────────────────────────────────────────────────

class UserRoleUpdate(BaseModel):
    role: UserRole
    support_only: bool = False

class BulkBanRequest(BaseModel):
    user_ids: list[UUID] = Field(min_length=1, max_length=100)
    reason: str = Field(default="Vi phạm quy định sử dụng hệ thống", min_length=1, max_length=500)

    @field_validator("reason")
    @classmethod
    def valid_reason(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("Lý do khóa không được rỗng")
        return value

class BulkUnbanRequest(BaseModel):
    user_ids: list[UUID] = Field(min_length=1, max_length=100)

class SendTestEmailRequest(BaseModel):
    recipient_email: EmailStr
    subject: str = Field(default="Kiểm thử Kết nối Email CapitalFlow", min_length=1, max_length=255)
    message: str = Field(default="Hệ thống gửi nhận email hoạt động hoàn hảo!", max_length=5000)

    @field_validator("subject")
    @classmethod
    def valid_subject(cls, value: str) -> str:
        if not value.strip() or any(c in value for c in "\r\n\x00"):
            raise ValueError("Tiêu đề email không hợp lệ")
        validate_utf16_length(value, 255, "Tiêu đề email")
        return value

class SMTPSettingsUpdate(BaseModel):
    smtp_host: str = Field(default="smtp.gmail.com", min_length=1, max_length=253)
    smtp_port: int = Field(default=587, ge=1, le=65535)
    smtp_user: str = Field(default="", max_length=255)
    smtp_password: str = Field(default="", max_length=4096)
    smtp_tls: bool = True
    smtp_ssl: bool = False
    emails_from_email: EmailStr | Literal[""] = "support@capitalflow.vn"
    emails_from_name: str = Field(default="CapitalFlow Finance", max_length=255)

    @field_validator("smtp_host", "smtp_user", "emails_from_name")
    @classmethod
    def valid_header(cls, value: str) -> str:
        if any(c in value for c in "\r\n\x00"):
            raise ValueError("Cấu hình email chứa ký tự không hợp lệ")
        return value.strip()

    @field_validator("smtp_host")
    @classmethod
    def valid_host(cls, value: str) -> str:
        if not value or any(c.isspace() for c in value) or "://" in value:
            raise ValueError("Máy chủ SMTP không hợp lệ")
        return value


# ─────────────────────────────────────────────────────────────
# HÀM TIỆN ÍCH DÙNG CHUNG
# ─────────────────────────────────────────────────────────────

def _iso_utc(dt) -> str | None:
    if not dt:
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")


def _search_pattern(value: str) -> str:
    term = value.strip().replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_").replace("[", "\\[")
    return f"%{term}%"


def _bulk_skip(user: User | None, admin_id: UUID, *, banning: bool) -> tuple[str, str] | None:
    if user is None:
        return "NOT_FOUND", "Không tìm thấy tài khoản"
    if user.id == admin_id:
        return "SELF", "Không thể thao tác trên chính tài khoản đang dùng"
    if user.is_system_account or (banning and _is_protected_account(user)):
        return "PROTECTED", "Tài khoản được bảo vệ"
    if user.is_active == (not banning):
        return "ALREADY_BANNED" if banning else "ALREADY_ACTIVE", "Tài khoản đã ở trạng thái yêu cầu"
    return None


def _user_out(u: User) -> dict:
    return {
        "id": str(u.id),
        "email": u.email,
        "full_name": u.full_name,
        "role": u.role.value if hasattr(u.role, "value") else u.role,
        "is_active": u.is_active,
        "is_system_account": u.is_system_account,
        "support_only": u.support_only,
        "must_change_password": getattr(u, 'must_change_password', False),
        "created_at": _iso_utc(u.created_at),
        "last_login_at": _iso_utc(u.last_login_at),
        "last_active_at": _iso_utc(getattr(u, 'last_active_at', None)),
    }


def _write_audit(db: Session, admin_id: UUID, action: str, target_type: str, target_id: str | None = None,
                 *, before: dict | None = None, after: dict | None = None):
    entity_uuid = None
    if target_id:
        try:
            entity_uuid = UUID(target_id)
        except Exception:
            entity_uuid = None
    request = db.info.get("request")
    context = {}
    if request is not None:
        from app.dung_chung.http.trung_gian.kiem_toan import _get_client_ip
        context = {
            "route": request.url.path,
            "http_method": request.method,
            "status_code": getattr(request.scope.get("route"), "status_code", None) or 200,
            "request_id": getattr(request.state, "audit_request_id", None),
            "ip_address": _get_client_ip(request),
            "user_agent": request.headers.get("user-agent", "")[:1000],
        }
        # Middleware still records errors if the transaction later fails.
        request.state.admin_audit_written = True

    log = AuditLog(
        user_id=admin_id,
        action=action,
        entity_type=target_type,
        entity_id=entity_uuid,
        old_values_json=json.dumps(before, ensure_ascii=False) if before else None,
        new_values_json=json.dumps(after, ensure_ascii=False) if after else None,
        **context,
    )
    db.add(log)


def _is_protected_account(user: User) -> bool:
    return user.is_system_account or user.role == UserRole.ADMIN


def _locked_user(db: Session, user_id: UUID) -> User | None:
    return db.scalar(select(User).where(User.id == user_id).with_hint(
        User, "WITH (UPDLOCK, ROWLOCK)", dialect_name="mssql"
    ).execution_options(populate_existing=True))
