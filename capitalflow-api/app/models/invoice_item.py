"""
InvoiceItem model — từng dòng sản phẩm trong hóa đơn.
Đồng bộ 100% với CSDL.sql: đổi tên item_name→name, sku_code→sku, total_price→line_total;
thêm line_no, unit, discount_amount, tax_amount, confidence, raw_text, updated_at.
"""
import uuid
from decimal import Decimal
from datetime import datetime
from sqlalchemy import String, Integer, Numeric, DateTime, ForeignKey, func, Uuid, Index
from sqlalchemy.orm import Mapped, mapped_column
from app.models.base import Base


class InvoiceItem(Base):
    __tablename__ = "invoice_items"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    invoice_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("invoices.id"))

    # Số thứ tự dòng trong hóa đơn (bắt đầu từ 1)
    line_no: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    # Tên hàng hóa/dịch vụ — đúng tên cột trong DB
    name: Mapped[str] = mapped_column(String(500), nullable=False)
    # Mã SKU hàng hóa
    sku: Mapped[str | None] = mapped_column(String(100), nullable=True)
    # Đơn vị tính (cái, kg, lít, chiếc...)
    unit: Mapped[str | None] = mapped_column(String(50), nullable=True)

    quantity: Mapped[Decimal | None] = mapped_column(Numeric(18, 4), nullable=True)
    unit_price: Mapped[Decimal | None] = mapped_column(Numeric(19, 2), nullable=True)
    discount_amount: Mapped[Decimal | None] = mapped_column(Numeric(19, 2), nullable=True)
    tax_amount: Mapped[Decimal | None] = mapped_column(Numeric(19, 2), nullable=True)
    # Thành tiền — đúng tên cột trong DB
    line_total: Mapped[Decimal | None] = mapped_column(Numeric(19, 2), nullable=True)

    # Độ tin cậy của OCR cho dòng này (0.0 – 1.0)
    confidence: Mapped[Decimal | None] = mapped_column(Numeric(5, 4), nullable=True)
    # Văn bản thô OCR đọc được trước khi xử lý
    raw_text: Mapped[str | None] = mapped_column(String(1000), nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.sysutcdatetime())
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.sysutcdatetime(), onupdate=func.sysutcdatetime())

    __table_args__ = (
        Index("IX_invoice_items_invoice", "invoice_id"),
    )
