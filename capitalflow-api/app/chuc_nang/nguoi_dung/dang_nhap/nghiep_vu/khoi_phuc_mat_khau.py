"""Hỗ trợ OTP đặt lại mật khẩu và khóa bản ghi người dùng.

Vai trò: tạo digest OTP và đọc user với khóa SQL Server chống race.
Đầu vào: email, OTP, Session và khóa bí mật runtime.
Đầu ra: digest cố định hoặc User đã được khóa.
Ràng buộc: không lưu OTP dạng rõ và không bỏ khóa khi xác minh nhiều bước.
"""

import hashlib
import hmac

from sqlalchemy import select

from app.dung_chung.config import settings
from app.chuc_nang.nguoi_dung.dang_nhap.luu_tru.nguoi_dung import User


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
