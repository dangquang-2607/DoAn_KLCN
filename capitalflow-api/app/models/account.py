import enum
import uuid
from decimal import Decimal
from datetime import datetime
from sqlalchemy import String, Boolean, Numeric, DateTime, ForeignKey, func, Uuid, Index
from sqlalchemy.orm import Mapped, mapped_column
from app.models.base import Base

class AccountType(str, enum.Enum):
    BANK = "BANK"
    CASH = "CASH"
    CRYPTO = "CRYPTO"
    E_WALLET = "E_WALLET"
    CREDIT_CARD = "CREDIT_CARD"
    SAVINGS = "SAVINGS"
    INVESTMENT = "INVESTMENT"
    OTHER = "OTHER"

class Account(Base):
    __tablename__ = "accounts"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), index=True)
    name: Mapped[str] = mapped_column(String(150), nullable=False)
    account_type: Mapped[AccountType] = mapped_column(String(30), nullable=False)
    institution_name: Mapped[str | None] = mapped_column(String(150), nullable=True)
    balance: Mapped[Decimal] = mapped_column(Numeric(19, 2), default=0)
    currency: Mapped[str] = mapped_column(String(3), default="VND")
    icon: Mapped[str | None] = mapped_column(String(100), nullable=True)
    color: Mapped[str | None] = mapped_column(String(20), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.sysutcdatetime())
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.sysutcdatetime(), onupdate=func.sysutcdatetime())

    __table_args__ = (
        Index("IX_accounts_user_type", "user_id", "account_type", "is_active"),
    )
