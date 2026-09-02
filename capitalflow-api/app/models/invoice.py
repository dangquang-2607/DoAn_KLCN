import uuid
from decimal import Decimal
from datetime import datetime, date
from sqlalchemy import String, Numeric, DateTime, Date, BigInteger, ForeignKey, func, Uuid, Index, Text
from sqlalchemy.orm import Mapped, mapped_column
from app.models.base import Base

class Invoice(Base):
    __tablename__ = "invoices"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"))
    parent_id: Mapped[uuid.UUID | None] = mapped_column(Uuid, nullable=True)
    account_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("accounts.id"), nullable=True)
    category_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("categories.id"), nullable=True)
    
    source: Mapped[str] = mapped_column(String(20), default="UPLOAD")
    status: Mapped[str] = mapped_column(String(30), default="UPLOADED")
    
    merchant_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    merchant_address: Mapped[str | None] = mapped_column(String(500), nullable=True)
    merchant_tax_code: Mapped[str | None] = mapped_column(String(100), nullable=True)
    
    invoice_number: Mapped[str | None] = mapped_column(String(100), nullable=True)
    invoice_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    
    subtotal_amount: Mapped[Decimal | None] = mapped_column(Numeric(19, 2), nullable=True)
    tax_amount: Mapped[Decimal | None] = mapped_column(Numeric(19, 2), nullable=True)
    discount_amount: Mapped[Decimal | None] = mapped_column(Numeric(19, 2), nullable=True)
    total_amount: Mapped[Decimal | None] = mapped_column(Numeric(19, 2), nullable=True)
    currency: Mapped[str] = mapped_column(String(3), default="VND")
    
    original_filename: Mapped[str | None] = mapped_column(String(255), nullable=True)
    storage_key: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    mime_type: Mapped[str | None] = mapped_column(String(100), nullable=True)
    file_size_bytes: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    
    ocr_provider: Mapped[str | None] = mapped_column(String(100), nullable=True)
    ocr_model: Mapped[str | None] = mapped_column(String(150), nullable=True)
    ocr_confidence: Mapped[Decimal | None] = mapped_column(Numeric(5, 4), nullable=True)
    ocr_raw_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    extracted_json: Mapped[str | None] = mapped_column(Text, nullable=True)
    
    note: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.sysutcdatetime())
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.sysutcdatetime(), onupdate=func.sysutcdatetime())
    confirmed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    __table_args__ = (
        Index("IX_invoices_user", "user_id", "created_at"),
        Index("IX_invoices_parent", "parent_id", "created_at"),
        Index("IX_invoices_user_status_date", "user_id", "status", "invoice_date", "created_at"),
        Index("IX_invoices_account", "account_id"),
        Index("IX_invoices_category", "category_id"),
    )
