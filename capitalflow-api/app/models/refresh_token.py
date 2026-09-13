from sqlalchemy import Unicode, UnicodeText
"""
RefreshToken model — quản lý phiên đăng nhập với Family Rotation.
Thêm parent_token_id, revocation_reason, device_name, user_agent, last_used_at
theo CSDL.sql để hỗ trợ tính năng Session Management.
"""
import uuid
from datetime import datetime
from sqlalchemy import String, DateTime, ForeignKey, func, Uuid, Index
from sqlalchemy.orm import Mapped, mapped_column
from app.models.base import Base


class RefreshToken(Base):
    __tablename__ = "refresh_tokens"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"))
    # Hash của token thô — không bao giờ lưu raw token
    token_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    # Nhóm token (để revoke cả chuỗi khi phát hiện tấn công replay)
    family_id: Mapped[uuid.UUID] = mapped_column(Uuid, nullable=False)
    # Token cha — dùng để trace chuỗi rotation
    parent_token_id: Mapped[uuid.UUID | None] = mapped_column(Uuid, nullable=True)

    expires_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    # Lý do bị revoke (logout, reuse_attack, expired, admin_action...)
    revocation_reason: Mapped[str | None] = mapped_column(Unicode(255), nullable=True)

    # Thông tin thiết bị — dùng cho trang "Quản lý phiên đăng nhập"
    device_name: Mapped[str | None] = mapped_column(Unicode(150), nullable=True)
    ip_address: Mapped[str | None] = mapped_column(String(45), nullable=True)
    user_agent: Mapped[str | None] = mapped_column(Unicode(1000), nullable=True)
    # Lần cuối token này được dùng để refresh
    last_used_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.sysutcdatetime())

    __table_args__ = (
        Index("IX_refresh_tokens_user_expiry", "user_id", "expires_at"),
        Index("IX_refresh_tokens_family", "family_id", "created_at"),
        Index("IX_refresh_tokens_active", "user_id", "family_id", "revoked_at", "expires_at"),
    )
