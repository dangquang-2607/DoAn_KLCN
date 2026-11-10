"""
Model refresh token quản lý phiên đăng nhập theo chuỗi xoay vòng.
Thêm parent_token_id, revocation_reason, device_name, user_agent, last_used_at
theo schema SQL Server để hỗ trợ tính năng Session Management.
"""
import uuid
from datetime import datetime
from sqlalchemy import Unicode, String, DateTime, ForeignKey, func, Uuid, Index, text
from sqlalchemy.orm import Mapped, mapped_column
from app.dung_chung.database.nen_tang import Base


class RefreshToken(Base):
    __tablename__ = "refresh_tokens"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", name="FK_refresh_tokens_user", ondelete="CASCADE")
    )
    # Hash của token thô — không bao giờ lưu raw token
    token_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    # Nhóm token (để revoke cả chuỗi khi phát hiện tấn công replay)
    family_id: Mapped[uuid.UUID] = mapped_column(Uuid, nullable=False)
    # Token cha — dùng để trace chuỗi rotation
    parent_token_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid,
        ForeignKey("refresh_tokens.id", name="FK_refresh_tokens_parent"),
        nullable=True,
    )

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
        Index(
            "IX_refresh_tokens_user_expiry", "user_id", "expires_at",
            mssql_include=["revoked_at", "family_id", "device_name", "last_used_at"],
        ),
        Index(
            "IX_refresh_tokens_family", "family_id", "created_at",
            mssql_include=["user_id", "expires_at", "revoked_at"],
        ),
        Index(
            "IX_refresh_tokens_active", "user_id", "expires_at",
            mssql_where=text("revoked_at IS NULL"),
        ),
    )
