from sqlalchemy import Unicode, UnicodeText
"""
Budget model — ngân sách cá nhân.
Đồng bộ 100% với CSDL.sql: amount_limit, period_type, name, currency, warning_percent, is_active, WEEKLY.
"""
import enum
import uuid
from decimal import Decimal
from datetime import datetime, date
from sqlalchemy import String, Boolean, Numeric, DateTime, Date, ForeignKey, func, Uuid, Index, text, CheckConstraint
from sqlalchemy.orm import Mapped, mapped_column
from app.models.base import Base


class BudgetPeriod(str, enum.Enum):
    WEEKLY = "WEEKLY"
    MONTHLY = "MONTHLY"
    YEARLY = "YEARLY"
    CUSTOM = "CUSTOM"


class Budget(Base):
    __tablename__ = "budgets"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"))
    category_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("categories.id"), nullable=True)

    # Tên ngân sách (VD: "Chi tiêu tháng 9", "Ăn uống hàng tuần")
    name: Mapped[str] = mapped_column(Unicode(150), nullable=False)
    # Hạn mức — đúng tên cột trong DB
    amount_limit: Mapped[Decimal] = mapped_column(Numeric(19, 2), nullable=False)
    currency: Mapped[str] = mapped_column(String(3), default="VND")
    # Loại kỳ hạn — đúng tên cột trong DB
    period_type: Mapped[BudgetPeriod] = mapped_column(String(20), default=BudgetPeriod.MONTHLY)

    start_date: Mapped[date] = mapped_column(Date, nullable=False)
    end_date: Mapped[date] = mapped_column(Date, nullable=False)

    # % cảnh báo (VD: 80 → cảnh báo khi đã dùng 80% ngân sách)
    warning_percent: Mapped[Decimal] = mapped_column(Numeric(5, 2), default=Decimal("80.00"))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.sysutcdatetime())
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.sysutcdatetime(), onupdate=func.sysutcdatetime())

    __table_args__ = (
        CheckConstraint("currency = 'VND'", name="CK_budgets_currency_vnd"),
        CheckConstraint("amount_limit > 0", name="CK_budgets_amount_limit"),
        CheckConstraint("end_date >= start_date", name="CK_budgets_dates"),
        Index("UX_budgets_user_category_period", "user_id", "category_id", "start_date", "end_date", unique=True,
              mssql_where=text("category_id IS NOT NULL"), sqlite_where=text("category_id IS NOT NULL"), postgresql_where=text("category_id IS NOT NULL")),
        Index("UX_budgets_user_overall_period", "user_id", "start_date", "end_date", unique=True,
              mssql_where=text("category_id IS NULL"), sqlite_where=text("category_id IS NULL"), postgresql_where=text("category_id IS NULL")),
        Index("IX_budgets_user", "user_id", "start_date", "end_date"),
        Index("IX_budgets_user_category_period", "user_id", "category_id", "period_type", "start_date"),
    )
