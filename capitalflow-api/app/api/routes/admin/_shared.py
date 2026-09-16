"""
Admin package — Shared helpers, schemas và utility functions.
Dùng chung cho tất cả các sub-module trong admin package.
"""
from datetime import datetime, timezone
from uuid import UUID
import uuid

from fastapi import HTTPException
from pydantic import BaseModel, EmailStr, Field, field_validator
from sqlalchemy import select
from sqlalchemy.orm import Session
from typing import Literal

from app.models.audit_log import AuditLog
from app.models.refresh_token import RefreshToken
from app.models.user import User, UserRole
from app.models.user_deletion import UserDeletionRequest
from app.services.user_deletion import original_email


# ─────────────────────────────────────────────────────────────
# REQUEST SCHEMAS
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
# UTILITY HELPERS
# ─────────────────────────────────────────────────────────────

def _iso_utc(dt) -> str | None:
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


def _validate_deletion_target(target: User, admin: User) -> None:
    if target.id == admin.id:
        raise HTTPException(status_code=400, detail="Bạn không thể tự xóa tài khoản của chính mình")
    if _is_protected_account(target):
        raise HTTPException(status_code=400, detail="Không thể xóa tài khoản Quản trị viên hoặc tài khoản hệ thống")


def _revoke_user_sessions(db: Session, user: User, reason: str = "admin_ban"):
    user.token_version += 1
    db.query(RefreshToken).filter(RefreshToken.user_id == user.id, RefreshToken.revoked_at.is_(None)).update(
        {"revoked_at": datetime.now(timezone.utc), "revocation_reason": reason}, synchronize_session="fetch"
    )


def _locked_user(db: Session, user_id: UUID) -> User | None:
    return db.scalar(select(User).where(User.id == user_id).with_hint(
        User, "WITH (UPDLOCK, ROWLOCK)", dialect_name="mssql"
    ).execution_options(populate_existing=True))
