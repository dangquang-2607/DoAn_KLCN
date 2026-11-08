from datetime import datetime, date
from uuid import UUID

from sqlalchemy import BigInteger, Boolean, CheckConstraint, Date, DateTime, ForeignKey, Index, Integer, String, Unicode, UnicodeText, Uuid, func, text
from sqlalchemy.orm import Mapped, mapped_column

from app.dung_chung.database.nen_tang import Base


class Subscription(Base):
    __tablename__ = "user_subscriptions"
    user_id: Mapped[UUID] = mapped_column(ForeignKey("users.id"), primary_key=True)
    premium_until: Mapped[datetime] = mapped_column(DateTime)
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.sysutcdatetime(), onupdate=func.sysutcdatetime())


class PaymentOrder(Base):
    __tablename__ = "premium_payment_orders"
    id: Mapped[UUID] = mapped_column(Uuid, primary_key=True)
    user_id: Mapped[UUID] = mapped_column(ForeignKey("users.id"))
    order_code: Mapped[int] = mapped_column(BigInteger, unique=True)
    amount: Mapped[int] = mapped_column(Integer)
    days: Mapped[int] = mapped_column(Integer)
    status: Mapped[str] = mapped_column(String(20), default="CREATING")
    payment_link_id: Mapped[str | None] = mapped_column(String(100))
    checkout_url: Mapped[str | None] = mapped_column(Unicode(500))
    checkout_data: Mapped[str | None] = mapped_column(UnicodeText, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.sysutcdatetime())
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.sysutcdatetime(), onupdate=func.sysutcdatetime())
    expires_at: Mapped[datetime] = mapped_column(DateTime)
    paid_at: Mapped[datetime | None] = mapped_column(DateTime)
    premium_from: Mapped[datetime | None] = mapped_column(DateTime)
    premium_until: Mapped[datetime | None] = mapped_column(DateTime)
    __table_args__ = (
        Index("IX_premium_orders_user_created", "user_id", "created_at"),
        CheckConstraint("amount > 0 AND days > 0", name="CK_premium_order_price"),
    )


class AiUsage(Base):
    """Giữ lượt đã dùng kể cả khi người dùng xóa hóa đơn hoặc tác vụ OCR."""
    __tablename__ = "ai_monthly_usage"
    job_id: Mapped[UUID] = mapped_column(Uuid, primary_key=True)
    user_id: Mapped[UUID] = mapped_column(ForeignKey("users.id"))
    month: Mapped[date] = mapped_column(Date)
    consumed: Mapped[bool] = mapped_column(Boolean, default=False, server_default=text("0"))
    __table_args__ = (Index("IX_ai_usage_user_month", "user_id", "month"),)
