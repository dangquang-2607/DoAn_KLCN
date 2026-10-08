"""
API quản lý nhật ký email, cấu hình SMTP và gửi email kiểm thử.
GET/PUT/POST /admin/email/*
"""
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy import case, func, select
from sqlalchemy.orm import Session

from app.dung_chung.http.phu_thuoc import get_db, require_admin
from app.dung_chung.config import settings
from app.dung_chung.security.secrets import seal, unseal
from app.dung_chung.email.luu_tru.nhat_ky_email import EmailLog
from app.dung_chung.email.luu_tru.cau_hinh_he_thong import SystemSetting
from app.chuc_nang.nguoi_dung.dang_nhap.luu_tru.nguoi_dung import User
from app.dung_chung.email.dich_vu import EmailService, SMTPConfig
from app.dung_chung.tac_vu_nen.hang_doi import enqueue_email

from app.chuc_nang.quan_tri.dung_chung.tien_ich import SMTPSettingsUpdate, SendTestEmailRequest, _iso_utc, _write_audit

router = APIRouter()

# ─────────────────────────────────────────────────────────────
# HÀM HỖ TRỢ CẤU HÌNH SMTP TRONG CSDL
# ─────────────────────────────────────────────────────────────

_SMTP_KEYS = ["smtp_host", "smtp_port", "smtp_user", "smtp_password", "smtp_tls", "smtp_ssl", "emails_from_email", "emails_from_name"]


def _save_smtp_to_db(db: Session, payload: SMTPSettingsUpdate, admin_id: UUID):
    """Lưu cấu hình SMTP vào bảng system_settings."""
    from datetime import datetime, timezone
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
    now = datetime.now(timezone.utc)
    for key, value in data.items():
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
    if len(result) < 3:
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
# CÁC ENDPOINT
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
    return {"success": True, "mode": "QUEUED", "job_id": str(job.id), "message": "Đã xếp hàng gửi email thử. Xem nhật ký để kiểm tra kết quả."}


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
    conditions = []
    if email_type:
        conditions.append(EmailLog.email_type == email_type)
    if status:
        conditions.append(EmailLog.status == status)
    if search:
        conditions.append(EmailLog.recipient.ilike(f"%{search}%"))

    total, sent, failed, preview = db.execute(select(
        func.count(EmailLog.id), func.sum(case((EmailLog.status == "SENT", 1), else_=0)),
        func.sum(case((EmailLog.status == "FAILED", 1), else_=0)),
        func.sum(case((EmailLog.status == "LOGGED_DEV", 1), else_=0)),
    ).where(*conditions)).one()
    # Phân trang theo khóa trước; không sắp xếp error_message (NVARCHAR(MAX))
    # và không kích hoạt quan hệ EmailLog.user vốn eager-load toàn bộ User.
    page_ids = db.scalars(
        select(EmailLog.id).where(*conditions)
        .order_by(EmailLog.created_at.desc(), EmailLog.id.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    ).all()
    logs_by_id = {log.id: log for log in db.execute(select(
        EmailLog.id, EmailLog.recipient, EmailLog.subject, EmailLog.email_type,
        EmailLog.status, EmailLog.error_message, EmailLog.created_at,
    ).where(EmailLog.id.in_(page_ids)))} if page_ids else {}
    logs = [logs_by_id[identifier] for identifier in page_ids if identifier in logs_by_id]

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
        "summary": {"sent": int(sent or 0), "failed": int(failed or 0), "preview": int(preview or 0)},
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
    _save_smtp_to_db(db, payload, admin.id)

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
