"""Ánh xạ hóa đơn và trạng thái vòng đời nhận diện/duyệt.

Vai trò: lưu metadata hóa đơn, tổng tiền, nhà cung cấp và trạng thái OCR.
Đầu vào: invoice routes, OCR worker và thao tác duyệt của người dùng.
Đầu ra: thực thể Invoice liên kết dòng hàng, transaction và OCR job.
Ràng buộc: chuyển trạng thái phải nhất quán với job và file lưu trữ liên quan.
"""

import uuid
from decimal import Decimal
from datetime import datetime, date
from sqlalchemy import Unicode, UnicodeText, String, Numeric, DateTime, Date, BigInteger, ForeignKey, func, Uuid, Index, text
from sqlalchemy.orm import Mapped, mapped_column
from app.shared.database.base import Base

class Invoice(Base):
    __tablename__ = "invoices"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"))
    account_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("accounts.id"), nullable=True)
    category_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("categories.id"), nullable=True)
    
    source: Mapped[str] = mapped_column(String(20), default="UPLOAD")
    status: Mapped[str] = mapped_column(String(30), default="UPLOADED")
    
    merchant_name: Mapped[str | None] = mapped_column(Unicode(255), nullable=True)
    merchant_address: Mapped[str | None] = mapped_column(Unicode(500), nullable=True)
    merchant_tax_code: Mapped[str | None] = mapped_column(Unicode(100), nullable=True)
    
    invoice_number: Mapped[str | None] = mapped_column(Unicode(100), nullable=True)
    invoice_symbol: Mapped[str | None] = mapped_column(Unicode(100), nullable=True)
    invoice_date: Mapped[date | None] = mapped_column(Date, nullable=True)

    vat_rate: Mapped[str | None] = mapped_column(Unicode(50), nullable=True)
    payment_method: Mapped[str | None] = mapped_column(Unicode(50), nullable=True)
    
    subtotal_amount: Mapped[Decimal | None] = mapped_column(Numeric(19, 2), nullable=True)
    tax_amount: Mapped[Decimal | None] = mapped_column(Numeric(19, 2), nullable=True)
    total_amount: Mapped[Decimal | None] = mapped_column(Numeric(19, 2), nullable=True)
    currency: Mapped[str] = mapped_column(String(3), default="VND")
    
    original_filename: Mapped[str | None] = mapped_column(Unicode(255), nullable=True)
    storage_key: Mapped[str | None] = mapped_column(Unicode(1000), nullable=True)
    mime_type: Mapped[str | None] = mapped_column(Unicode(100), nullable=True)
    file_size_bytes: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    
    ocr_confidence: Mapped[Decimal | None] = mapped_column(Numeric(5, 4), nullable=True)
    extracted_json: Mapped[str | None] = mapped_column(UnicodeText, nullable=True)
    
    note: Mapped[str | None] = mapped_column(Unicode(1000), nullable=True)
    
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.sysutcdatetime())
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.sysutcdatetime(), onupdate=func.sysutcdatetime())
    confirmed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    __table_args__ = (
        Index(
            "IX_invoices_user", "user_id", "created_at",
            mssql_include=["status", "merchant_name", "invoice_date", "total_amount", "currency"],
        ),
        Index(
            "IX_invoices_user_status_date", "user_id", "status", "invoice_date", "created_at",
            mssql_include=["merchant_name", "invoice_number", "total_amount", "currency", "ocr_confidence"],
        ),
        Index(
            "IX_invoices_account", "account_id", "invoice_date",
            mssql_where=text("account_id IS NOT NULL"),
        ),
        Index(
            "IX_invoices_category", "category_id", "invoice_date",
            mssql_where=text("category_id IS NOT NULL"),
        ),
    )
