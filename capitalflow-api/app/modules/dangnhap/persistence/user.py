"""Ánh xạ tài khoản người dùng, vai trò và trạng thái bảo mật.

Vai trò: làm thực thể chủ sở hữu cho dữ liệu tài chính và phiên đăng nhập.
Đầu vào: auth/admin routes cùng các dịch vụ phiên và xóa người dùng.
Đầu ra: thực thể User cho authorization và quan hệ dữ liệu.
Ràng buộc: password hash, trạng thái khóa và vòng đời xóa phải được bảo vệ nhất quán.
"""

import enum
import uuid
from datetime import datetime
from sqlalchemy import String, Boolean, DateTime, func, Uuid, Unicode, UnicodeText, Integer, Index, CheckConstraint
from sqlalchemy.orm import Mapped, mapped_column
from app.shared.database.base import Base

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
    is_deleted: Mapped[bool] = mapped_column(Boolean, default=False, server_default="0", nullable=False)
    deletion_status: Mapped[str] = mapped_column(String(20), default="ACTIVE", server_default="ACTIVE", nullable=False)
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    # Cố ý lưu snapshot bền vững của người thao tác thay vì khóa ngoại. Bản ghi xóa
    # vẫn phải đọc được nếu quản trị viên thực hiện thao tác bị xóa sau đó theo
    # một chính sách lưu giữ dữ liệu độc lập.
    deleted_by: Mapped[uuid.UUID | None] = mapped_column(Uuid, nullable=True)
    email_before_delete_sealed: Mapped[str | None] = mapped_column(UnicodeText, nullable=True)
    pre_delete_is_active: Mapped[bool | None] = mapped_column(Boolean, nullable=True)
    is_system_account: Mapped[bool] = mapped_column(Boolean, default=False, server_default="0", nullable=False)
    must_change_password: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    last_login_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    last_active_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.sysutcdatetime())
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.sysutcdatetime(), onupdate=func.sysutcdatetime())

    __table_args__ = (
        CheckConstraint(
            "deletion_status IN ('ACTIVE', 'SOFT_DELETED', 'PURGE_PENDING')",
            name="CK_users_deletion_status",
        ),
        Index("IX_users_deletion_status", "is_deleted", "deletion_status", "created_at"),
        Index(
            "IX_users_role_active",
            "role",
            "is_active",
            mssql_include=["email", "full_name", "last_login_at", "created_at"],
        ),
        Index("UX_users_email", "email", unique=True),
    )
