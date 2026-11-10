"""Hồ sơ hỗ trợ tài khoản."""

from datetime import datetime
from uuid import UUID, uuid4

from sqlalchemy import DateTime, ForeignKey, Index, String, Unicode, Uuid, func, text
from sqlalchemy.orm import Mapped, mapped_column

from app.dung_chung.database.nen_tang import Base


class AccountSupportCase(Base):
    __tablename__ = "account_support_cases"

    id: Mapped[UUID] = mapped_column(Uuid, primary_key=True, default=uuid4)
    account_email: Mapped[str] = mapped_column(Unicode(255))
    contact_email: Mapped[str | None] = mapped_column(Unicode(255))
    source: Mapped[str] = mapped_column(String(20))
    issue: Mapped[str] = mapped_column(String(20))
    status: Mapped[str] = mapped_column(String(20), default="OPEN")
    created_by: Mapped[UUID | None] = mapped_column(Uuid)
    updated_by: Mapped[UUID | None] = mapped_column(Uuid)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.sysutcdatetime())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.sysutcdatetime(), onupdate=func.sysutcdatetime()
    )

    __table_args__ = (
        Index("IX_account_support_queue", "status", "created_at"),
        Index("IX_account_support_email", "account_email", "created_at"),
        Index("UX_account_support_open", "account_email", "issue", unique=True,
              mssql_where=text("status <> 'RESOLVED'"),
              sqlite_where=text("status <> 'RESOLVED'")),
    )


class SupportRequest(Base):
    __tablename__ = "support_requests"

    id: Mapped[UUID] = mapped_column(Uuid, primary_key=True)
    user_id: Mapped[UUID] = mapped_column(ForeignKey("users.id"), nullable=False)
    account_email: Mapped[str] = mapped_column(Unicode(255), nullable=False)
    full_name: Mapped[str] = mapped_column(Unicode(150), nullable=False)
    title: Mapped[str] = mapped_column(Unicode(100), nullable=False)
    message: Mapped[str] = mapped_column(Unicode(1500), nullable=False)
    reply: Mapped[str | None] = mapped_column(Unicode(1500))
    replied_by: Mapped[UUID | None] = mapped_column(ForeignKey("users.id"))
    reply_job_id: Mapped[UUID | None] = mapped_column(ForeignKey("background_jobs.id"))
    reply_queued_at: Mapped[datetime | None] = mapped_column(DateTime)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.sysutcdatetime())

    __table_args__ = (Index("IX_support_requests_queue", "created_at", "id"),)

