"""Ánh xạ tài khoản người dùng, vai trò và trạng thái bảo mật.

Vai trò: làm thực thể chủ sở hữu cho dữ liệu tài chính và phiên đăng nhập.
Đầu vào: auth/admin routes cùng dịch vụ phiên đăng nhập.
Đầu ra: thực thể User cho authorization và quan hệ dữ liệu.
Ràng buộc: password hash, trạng thái khóa và phiên đăng nhập phải được bảo vệ nhất quán.
"""

import enum
import uuid
from datetime import datetime
from sqlalchemy import String, Boolean, DateTime, func, Uuid, Unicode, Integer, Index
from sqlalchemy.orm import Mapped, mapped_column
from app.dung_chung.database.nen_tang import Base

class UserRole(str, enum.Enum):
    USER = "USER"
    ADMIN = "ADMIN"

class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    email: Mapped[str] = mapped_column(Unicode(255), nullable=False)
    full_name: Mapped[str] = mapped_column(Unicode(150), nullable=False)
    password_hash: Mapped[str] = mapped_column(Unicode(500), nullable=False)
    role: Mapped[UserRole] = mapped_column(String(20), default=UserRole.USER)
    token_version: Mapped[int] = mapped_column(Integer, default=0, server_default="0", nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    is_system_account: Mapped[bool] = mapped_column(Boolean, default=False, server_default="0", nullable=False)
    support_only: Mapped[bool] = mapped_column(Boolean, default=False, server_default="0", nullable=False)
    must_change_password: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    last_login_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    last_active_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.sysutcdatetime())
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.sysutcdatetime(), onupdate=func.sysutcdatetime())

    __table_args__ = (
        Index(
            "IX_users_role_active",
            "role",
            "is_active",
            mssql_include=["email", "full_name", "last_login_at", "created_at"],
        ),
        Index("UX_users_email", "email", unique=True),
    )
