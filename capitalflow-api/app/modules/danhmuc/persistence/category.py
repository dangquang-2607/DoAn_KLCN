"""Ánh xạ danh mục thu/chi cá nhân và danh mục hệ thống.

Vai trò: lưu tên, loại, quyền sở hữu, trạng thái và thứ tự danh mục.
Đầu vào: routes danh mục, admin routes và bộ phân loại tự động.
Đầu ra: thực thể Category cho giao dịch, ngân sách và báo cáo.
Ràng buộc: danh mục hệ thống và cá nhân có phạm vi quyền sửa khác nhau.
"""

import enum
import uuid
from datetime import datetime
from sqlalchemy import Unicode, String, Boolean, Integer, DateTime, ForeignKey, func, Uuid, Index, text
from sqlalchemy.orm import Mapped, mapped_column
from app.shared.database.base import Base

class CategoryType(str, enum.Enum):
    INCOME = "INCOME"
    EXPENSE = "EXPENSE"

class Category(Base):
    __tablename__ = "categories"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    owner_user_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    name: Mapped[str] = mapped_column(Unicode(100), nullable=False)
    type: Mapped[CategoryType] = mapped_column(String(20), nullable=False)
    icon: Mapped[str | None] = mapped_column(Unicode(100), nullable=True)
    color: Mapped[str | None] = mapped_column(String(20), nullable=True)
    keywords: Mapped[str | None] = mapped_column(Unicode(1000), nullable=True)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.sysutcdatetime())
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.sysutcdatetime(), onupdate=func.sysutcdatetime())

    __table_args__ = (
        Index("IX_categories_owner_user", "owner_user_id", "is_active", "type", "sort_order"),
        Index("UX_categories_global_name_type", "name", "type", unique=True,
              mssql_where=text("owner_user_id IS NULL"), sqlite_where=text("owner_user_id IS NULL"), postgresql_where=text("owner_user_id IS NULL")),
        Index("UX_categories_user_name_type", "owner_user_id", "name", "type", unique=True,
              mssql_where=text("owner_user_id IS NOT NULL"), sqlite_where=text("owner_user_id IS NOT NULL"), postgresql_where=text("owner_user_id IS NOT NULL")),
    )
