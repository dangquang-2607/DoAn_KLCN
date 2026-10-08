"""Trạng thái bền vững cho quy trình xóa người dùng và dọn file bất đồng bộ."""
import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Index, Integer, String, Unicode, UnicodeText, Uuid, func
from sqlalchemy.orm import Mapped, mapped_column

from app.dung_chung.database.nen_tang import Base


class UserDeletionRequest(Base):
    __tablename__ = "user_deletion_requests"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    # Không đặt FK tới users: request này là dấu vết bền vững sau khi hard delete.
    target_user_id: Mapped[uuid.UUID] = mapped_column(Uuid, nullable=False)
    requested_by: Mapped[uuid.UUID] = mapped_column(Uuid, nullable=False)
    mode: Mapped[str] = mapped_column(String(10), nullable=False)
    status: Mapped[str] = mapped_column(String(30), nullable=False)
    purge_checkpoint: Mapped[str] = mapped_column(String(30), nullable=False, default="REQUESTED")
    reason: Mapped[str] = mapped_column(Unicode(500), nullable=False)
    target_email_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    target_email_sealed: Mapped[str | None] = mapped_column(UnicodeText, nullable=True)
    file_total: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    files_deleted: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    error_code: Mapped[str | None] = mapped_column(String(100), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.sysutcdatetime())
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.sysutcdatetime(), onupdate=func.sysutcdatetime())
    completed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    __table_args__ = (
        Index("IX_user_deletion_requests_target", "target_user_id", "created_at"),
        Index("IX_user_deletion_requests_status", "status", "created_at"),
    )


class UserDeletionFile(Base):
    __tablename__ = "user_deletion_files"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    request_id: Mapped[uuid.UUID] = mapped_column(
        Uuid,
        ForeignKey("user_deletion_requests.id", ondelete="CASCADE"),
        nullable=False,
    )
    storage_key: Mapped[str] = mapped_column(Unicode(1000), nullable=False)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="PENDING")
    attempts: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    error_code: Mapped[str | None] = mapped_column(String(100), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.sysutcdatetime())
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    __table_args__ = (
        Index("UX_user_deletion_files_request_key", "request_id", "storage_key", unique=True),
        Index("IX_user_deletion_files_status", "request_id", "status"),
    )
