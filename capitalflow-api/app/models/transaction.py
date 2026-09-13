from sqlalchemy import Unicode, UnicodeText
"""
Transaction model — giao dịch tài chính.
Thêm `source` và `TransactionSource` enum theo CSDL.sql.
"""
import enum
import uuid
from decimal import Decimal
from datetime import datetime, date
from sqlalchemy import Unicode, UnicodeText, String, Numeric, DateTime, Date, ForeignKey, func, Uuid, Index, Text, text, CheckConstraint
from sqlalchemy.orm import Mapped, mapped_column
from app.models.base import Base


class TransactionType(str, enum.Enum):
    INCOME = "INCOME"
    EXPENSE = "EXPENSE"


class TransactionSource(str, enum.Enum):
    """Nguồn gốc của giao dịch — giúp phân biệt giao dịch nhập tay vs từ hóa đơn OCR."""
    MANUAL = "MANUAL"    # Người dùng nhập tay
    OCR = "OCR"          # Tự động tạo từ quét hóa đơn
    IMPORT = "IMPORT"    # Import từ file CSV/Excel
    SYSTEM = "SYSTEM"    # Hệ thống tự sinh (VD: định kỳ)


class Transaction(Base):
    __tablename__ = "transactions"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"))
    account_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("accounts.id"))
    category_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("categories.id"), nullable=True)
    invoice_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("invoices.id"), nullable=True)

    description: Mapped[str] = mapped_column(Unicode(255), nullable=False, default="")
    amount: Mapped[Decimal] = mapped_column(Numeric(19, 2), nullable=False)
    type: Mapped[TransactionType] = mapped_column(String(20), nullable=False)
    # CSDL.sql: source VARCHAR(20) NOT NULL, default 'MANUAL'
    source: Mapped[TransactionSource] = mapped_column(String(20), nullable=False, default=TransactionSource.MANUAL)
    transaction_date: Mapped[date] = mapped_column(Date, nullable=False)

    kind: Mapped[str] = mapped_column(String(20), default="NORMAL", server_default="NORMAL", nullable=False)
    transfer_id: Mapped[uuid.UUID | None] = mapped_column(Uuid, nullable=True)

    note: Mapped[str | None] = mapped_column(Unicode(1000), nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.sysutcdatetime())
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.sysutcdatetime(), onupdate=func.sysutcdatetime())

    __table_args__ = (
        CheckConstraint("(type = 'INCOME' AND amount > 0) OR (type = 'EXPENSE' AND amount < 0)", name="CK_transactions_amount_sign"),
        CheckConstraint("kind IN ('NORMAL', 'TRANSFER', 'ADJUSTMENT')", name="CK_transactions_kind"),
        CheckConstraint("(kind = 'TRANSFER' AND transfer_id IS NOT NULL) OR (kind <> 'TRANSFER' AND transfer_id IS NULL)", name="CK_transactions_transfer_link"),
        Index("UX_transactions_transfer_leg", "transfer_id", "type", unique=True,
              mssql_where=text("transfer_id IS NOT NULL"), sqlite_where=text("transfer_id IS NOT NULL")),
        Index("UX_transactions_invoice", "invoice_id", unique=True, mssql_where=text("invoice_id IS NOT NULL"), sqlite_where=text("invoice_id IS NOT NULL")),
        Index("IX_transactions_user_date", "user_id", "transaction_date", "created_at"),
        Index("IX_transactions_reporting", "user_id", "kind", "transaction_date", mssql_include=["type", "amount", "category_id"]),
        Index("IX_transactions_date", "transaction_date"),
        Index("IX_transactions_user_account_date", "user_id", "account_id", "transaction_date"),
        Index("IX_transactions_user_category_date", "user_id", "category_id", "transaction_date"),
        Index("IX_transactions_user_type_date", "user_id", "type", "transaction_date"),
    )
