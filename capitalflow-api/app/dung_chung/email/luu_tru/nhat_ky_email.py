"""Ánh xạ lịch sử gửi email phục vụ vận hành và kiểm toán.

Vai trò: lưu loại email, người nhận đã xử lý phù hợp, trạng thái và lỗi giao nhận.
Đầu vào: email service và worker EMAIL.
Đầu ra: bản ghi EmailLog cho admin monitoring.
Ràng buộc: không lưu nội dung bí mật hoặc credential SMTP dạng rõ.
"""

import uuid
from datetime import datetime, timezone
from sqlalchemy import DateTime, String, Unicode, UnicodeText, ForeignKey, Uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.dung_chung.database.nen_tang import Base

class EmailLog(Base):
    __tablename__ = "email_logs"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid,
        ForeignKey("users.id", name="FK_email_logs_users", ondelete="SET NULL"),
        nullable=True,
    )
    recipient: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    subject: Mapped[str] = mapped_column(Unicode(255), nullable=False)
    email_type: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    status: Mapped[str] = mapped_column(String(20), nullable=False, index=True)  # SENT, LOGGED_DEV, FAILED
    error_message: Mapped[str | None] = mapped_column(UnicodeText, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)

    user = relationship("User", backref="email_logs", lazy="joined")
