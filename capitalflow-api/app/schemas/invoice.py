from decimal import Decimal
from datetime import date, datetime
from uuid import UUID

from pydantic import BaseModel


class InvoiceItemOut(BaseModel):
    """Dòng sản phẩm chi tiết trong hóa đơn — đồng bộ với model InvoiceItem."""
    id: UUID
    invoice_id: UUID
    line_no: int
    name: str
    sku: str | None
    unit: str | None
    quantity: Decimal | None
    unit_price: Decimal | None
    discount_amount: Decimal | None
    tax_amount: Decimal | None
    line_total: Decimal | None
    confidence: Decimal | None
    raw_text: str | None

    model_config = {"from_attributes": True}


class InvoiceOut(BaseModel):
    id: UUID
    user_id: UUID
    parent_id: UUID | None
    account_id: UUID | None
    category_id: UUID | None
    source: str
    status: str
    merchant_name: str | None
    merchant_address: str | None
    merchant_tax_code: str | None
    invoice_number: str | None
    invoice_date: date | None
    subtotal_amount: Decimal | None
    tax_amount: Decimal | None
    discount_amount: Decimal | None
    total_amount: Decimal | None
    currency: str
    original_filename: str | None
    mime_type: str | None
    file_size_bytes: int | None
    ocr_provider: str | None
    ocr_model: str | None
    ocr_confidence: Decimal | None
    note: str | None
    created_at: datetime
    updated_at: datetime
    confirmed_at: datetime | None
    # Danh sách sản phẩm chi tiết — trả về khi load đầy đủ hóa đơn
    items: list[InvoiceItemOut] = []

    model_config = {"from_attributes": True}


class InvoiceListOut(BaseModel):
    """Dùng cho danh sách hóa đơn — không cần load items để giảm tải."""
    id: UUID
    user_id: UUID
    source: str
    status: str
    merchant_name: str | None
    invoice_date: date | None
    total_amount: Decimal | None
    currency: str
    original_filename: str | None
    mime_type: str | None
    ocr_confidence: Decimal | None
    created_at: datetime
    confirmed_at: datetime | None

    model_config = {"from_attributes": True}


class InvoiceConfirm(BaseModel):
    """Xác nhận hóa đơn và liên kết với tài khoản/danh mục."""
    account_id: UUID
    category_id: UUID | None = None
    note: str | None = None


class InvoicePage(BaseModel):
    items: list[InvoiceListOut]
    total: int
    page: int
    page_size: int
