"""Thông báo dùng chung của người dùng, độc lập với ví và nguồn phát sinh."""

import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Index, String, Text, Unicode, Uuid, func, text
from sqlalchemy.orm import Mapped, mapped_column

from app.dung_chung.database.nen_tang import Base


class Notification(Base):
    __tablename__ = "notifications"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), nullable=False)
    kind: Mapped[str] = mapped_column(String(30), nullable=False)
    severity: Mapped[str] = mapped_column(String(16), nullable=False, default="INFO")
    title: Mapped[str] = mapped_column(Unicode(160), nullable=False)
    message: Mapped[str] = mapped_column(Unicode(1000), nullable=False)
    source_type: Mapped[str | None] = mapped_column(String(30), nullable=True)
    source_id: Mapped[uuid.UUID | None] = mapped_column(Uuid, nullable=True)
    action_url: Mapped[str | None] = mapped_column(Unicode(300), nullable=True)
    metadata_json: Mapped[str | None] = mapped_column(Text, nullable=True)
    dedupe_key: Mapped[str | None] = mapped_column(String(180), nullable=True)
    read_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, server_default=func.sysutcdatetime())

    __table_args__ = (
        Index("IX_notifications_user_created", "user_id", "created_at", "id"),
        Index("IX_notifications_user_unread", "user_id", "read_at"),
        Index("UX_notifications_user_dedupe", "user_id", "dedupe_key", unique=True,
              mssql_where=text("dedupe_key IS NOT NULL"),
              sqlite_where=text("dedupe_key IS NOT NULL")),
    )
