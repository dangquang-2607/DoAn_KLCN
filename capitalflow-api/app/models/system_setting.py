from sqlalchemy import Unicode, UnicodeText
import uuid
from datetime import datetime, timezone
from sqlalchemy import DateTime, String, Text, Uuid, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column
from app.models.base import Base


class SystemSetting(Base):
    """Bảng lưu trữ cấu hình hệ thống bền vững (SMTP, v.v.)."""
    __tablename__ = "system_settings"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    key: Mapped[str] = mapped_column(Unicode(100), unique=True, nullable=False, index=True)
    value: Mapped[str | None] = mapped_column(UnicodeText, nullable=True)
    description: Mapped[str | None] = mapped_column(Unicode(500), nullable=True)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc), nullable=False,
    )
    updated_by: Mapped[uuid.UUID | None] = mapped_column(
        Uuid, ForeignKey("users.id"), nullable=True
    )
