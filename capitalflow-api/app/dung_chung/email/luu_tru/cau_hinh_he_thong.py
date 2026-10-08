"""Ánh xạ cấu hình hệ thống có thể thay đổi trong thời gian chạy.

Vai trò: lưu cấu hình quản trị như SMTP theo khóa/giá trị.
Đầu vào: admin routes và services đọc cấu hình động.
Đầu ra: thực thể SystemSetting cho API/worker.
Ràng buộc: giá trị bí mật phải được mã hóa trước khi lưu.
"""

import uuid
from datetime import datetime, timezone
from sqlalchemy import DateTime, String, Unicode, UnicodeText, Uuid, ForeignKey, Index
from sqlalchemy.orm import Mapped, mapped_column
from app.dung_chung.database.nen_tang import Base


class SystemSetting(Base):
    """Bảng lưu trữ cấu hình hệ thống bền vững (SMTP, v.v.)."""
    __tablename__ = "system_settings"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    key: Mapped[str] = mapped_column(Unicode(100), unique=True, nullable=False)
    value: Mapped[str | None] = mapped_column(UnicodeText, nullable=True)
    description: Mapped[str | None] = mapped_column(Unicode(500), nullable=True)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc), nullable=False,
    )
    updated_by: Mapped[uuid.UUID | None] = mapped_column(
        Uuid, ForeignKey("users.id"), nullable=True
    )

    __table_args__ = (Index("IX_system_settings_key", "key", unique=True),)
