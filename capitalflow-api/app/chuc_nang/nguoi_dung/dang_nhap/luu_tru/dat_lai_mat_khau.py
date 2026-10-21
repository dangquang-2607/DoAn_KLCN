"""Ánh xạ OTP đặt lại mật khẩu có thời hạn và trạng thái sử dụng.

Vai trò: lưu dấu vết OTP phục vụ quy trình khôi phục tài khoản và liên kết ngân hàng.
Đầu vào: auth routes, ví liên kết và email worker.
Đầu ra: thực thể PasswordResetOTP cho kiểm tra, vô hiệu hóa và audit.
Ràng buộc: không lưu OTP dạng có thể sử dụng lại ngoài thời hạn hoặc sau khi hoàn tất.
"""

import uuid
from datetime import datetime
from sqlalchemy import DateTime, Integer, String, Boolean, ForeignKey, Uuid, func
from sqlalchemy.orm import Mapped, mapped_column
from app.dung_chung.database.nen_tang import Base


class PasswordResetOTP(Base):
    __tablename__ = "password_reset_otps"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid,
        ForeignKey("users.id", name="FK_password_reset_otps_users", ondelete="CASCADE"),
        nullable=True,
    )
    email: Mapped[str] = mapped_column(String(255), index=True, nullable=False)
    otp_code: Mapped[str] = mapped_column(String(64), nullable=False)
    purpose: Mapped[str] = mapped_column(
        String(50), default="RESET_PASSWORD", server_default="RESET_PASSWORD", nullable=False
    )
    expires_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    is_used: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    failed_attempts: Mapped[int] = mapped_column(Integer, default=0, nullable=False, server_default="0")
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.sysutcdatetime(), nullable=False)