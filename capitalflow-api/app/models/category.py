from sqlalchemy import Unicode, UnicodeText
import enum
import uuid
from datetime import datetime
from sqlalchemy import Unicode, String, Boolean, Integer, DateTime, ForeignKey, func, Uuid, Index, text, text
from sqlalchemy.orm import Mapped, mapped_column
from app.models.base import Base

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
