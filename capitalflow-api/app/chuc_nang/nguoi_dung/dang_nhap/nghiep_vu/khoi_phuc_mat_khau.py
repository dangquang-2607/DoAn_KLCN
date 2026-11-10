"""Hỗ trợ OTP đặt lại mật khẩu và khóa bản ghi người dùng.

Vai trò: tạo digest OTP và đọc user với khóa SQL Server chống race.
Đầu vào: email, OTP, Session và khóa bí mật runtime.
Đầu ra: digest cố định hoặc User đã được khóa.
Ràng buộc: không lưu OTP dạng rõ và không bỏ khóa khi xác minh nhiều bước.
"""

from datetime import datetime, timedelta, timezone
import hashlib
import hmac
import logging
import secrets

from fastapi import HTTPException
from sqlalchemy import func, select, update
from sqlalchemy.orm import Session

from app.chuc_nang.nguoi_dung.dang_nhap.luu_tru.dat_lai_mat_khau import PasswordResetOTP

from app.dung_chung.config import settings
from app.chuc_nang.nguoi_dung.dang_nhap.luu_tru.nguoi_dung import User

logger = logging.getLogger("capitalflow")
RESET_PURPOSE = "RESET_PASSWORD"
RESET_COOLDOWN = timedelta(seconds=60)
RESET_WINDOW = timedelta(minutes=15)
RESET_MAX_PER_WINDOW = 3
RESET_TTL = timedelta(minutes=10)


def utc(value):
    return value.replace(tzinfo=timezone.utc) if value.tzinfo is None else value.astimezone(timezone.utc)


def reset_otp_query(user_id):
    return select(PasswordResetOTP).where(
        PasswordResetOTP.user_id == user_id, PasswordResetOTP.purpose == RESET_PURPOSE
    )


def latest_reset_otp(db, user_id):
    return db.scalar(reset_otp_query(user_id).order_by(
        PasswordResetOTP.created_at.desc(), PasswordResetOTP.id.desc()
    ).limit(1))


def reset_issue_block(db, user_id, latest, now):
    if latest and utc(latest.created_at) + RESET_COOLDOWN > now:
        return "Chờ ít nhất 60 giây kể từ lần cấp mã gần nhất."
    count = db.scalar(select(func.count()).select_from(reset_otp_query(user_id).where(
        PasswordResetOTP.created_at > now - RESET_WINDOW
    ).subquery()))
    if count >= RESET_MAX_PER_WINDOW:
        return "Tài khoản đã đạt giới hạn 3 lần cấp mã trong 15 phút."
    return None


def issue_reset_otp(db, user, latest, now):
    """Caller holds the user row lock and has checked the reset issue limits."""
    db.execute(update(PasswordResetOTP).where(
        PasswordResetOTP.user_id == user.id,
        PasswordResetOTP.purpose == RESET_PURPOSE,
        PasswordResetOTP.is_used == False,
    ).values(is_used=True))
    while True:
        code = f"{secrets.randbelow(1_000_000):06d}"
        digest = otp_digest(user.email, code)
        if not latest or not hmac.compare_digest(latest.otp_code, digest):
            break
    db.add(PasswordResetOTP(
        user_id=user.id, email=user.email, otp_code=digest,
        purpose=RESET_PURPOSE, expires_at=now + RESET_TTL, created_at=now,
    ))
    return code


def deliver_reset_otp(email, name, user_id, code):
    """Send after commit. A transport failure never resets the password."""
    from app.dung_chung.email.dich_vu import EmailService

    try:
        EmailService.send_password_reset_otp(email, name or "Quý khách", code, user_id=user_id)
    except Exception as exc:
        logger.warning("Không thể gửi OTP (%s)", type(exc).__name__)

def otp_digest(email: str, code: str) -> str:
    """Băm OTP gắn với email bằng HMAC của hệ thống."""

    message = f"otp:{email.lower()}:{code}".encode()
    return hmac.new(settings.jwt_secret_key.encode(), message, hashlib.sha256).hexdigest()


def select_locked_user(db, email: str):
    """Khóa user trong transaction để giới hạn thử OTP nhất quán."""

    return db.scalar(
        select(User)
        .where(User.email == email)
        .with_hint(User, "WITH (UPDLOCK, ROWLOCK)", dialect_name="mssql")
        .execution_options(populate_existing=True)
    )


def validate_reset_otp(db: Session, email: str, code: str, expired_message: str) -> tuple[User, PasswordResetOTP]:
    user = select_locked_user(db, email)
    if not user or not user.is_active:
        raise HTTPException(status_code=400, detail="Mã OTP không hợp lệ")
    now = datetime.now(timezone.utc)

    # Tìm OTP mới nhất chưa sử dụng theo email (không lọc theo otp_code để đếm lần sai)
    latest_otp = db.scalar(
        select(PasswordResetOTP).where(
            PasswordResetOTP.email == email,
            PasswordResetOTP.purpose == "RESET_PASSWORD",
            PasswordResetOTP.is_used == False,
        ).order_by(PasswordResetOTP.created_at.desc())
    )

    if not latest_otp:
        raise HTTPException(status_code=400, detail="Mã OTP không chính xác hoặc đã được sử dụng")

    # Kiểm tra hết hạn
    exp = latest_otp.expires_at.replace(tzinfo=timezone.utc) if latest_otp.expires_at.tzinfo is None else latest_otp.expires_at
    if exp < now:
        raise HTTPException(status_code=400, detail=expired_message)

    # Kiểm tra mã OTP có khớp không
    if not hmac.compare_digest(latest_otp.otp_code, otp_digest(email, code)):
        latest_otp.failed_attempts += 1
        if latest_otp.failed_attempts >= 5:
            latest_otp.is_used = True  # Vô hiệu hóa OTP sau 5 lần sai
            db.commit()
            raise HTTPException(
                status_code=400,
                detail="Mã OTP đã bị vô hiệu hóa do nhập sai quá 5 lần. Vui lòng yêu cầu gửi lại mã mới."
            )
        db.commit()
        remaining = 5 - latest_otp.failed_attempts
        raise HTTPException(
            status_code=400,
            detail=f"Mã OTP không chính xác. Bạn còn {remaining} lần thử."
        )

    return user, latest_otp
