"""Định nghĩa hợp đồng API cho hóa đơn, dòng hàng và kết quả OCR.

Vai trò: kiểm tra dữ liệu upload, hiệu chỉnh, xác nhận và xử lý hàng loạt hóa đơn.
Đầu vào: payload HTTP, dữ liệu ORM và kết quả bóc tách OCR.
Đầu ra: DTO Pydantic cho danh sách, chi tiết và mutation hóa đơn.
Ràng buộc: giới hạn số lượng/batch và kiểu tiền phải ngăn payload quá lớn hoặc không hợp lệ.
"""

from decimal import Decimal
from datetime import date, datetime
from uuid import UUID
from typing import Literal

from pydantic import BaseModel, Field, field_validator


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


class InvoiceItemEdit(BaseModel):
    """Một dòng mặt hàng do người dùng hiệu chỉnh trước khi xác nhận hóa đơn."""
    name: str = Field(min_length=1, max_length=500)
    sku: str | None = Field(default=None, max_length=100)
    unit: str | None = Field(default=None, max_length=50)
    quantity: Decimal | None = Field(default=None, ge=Decimal("0"), max_digits=18, decimal_places=4)
    unit_price: Decimal | None = Field(default=None, ge=Decimal("0"), max_digits=19, decimal_places=2)
    discount_amount: Decimal | None = Field(default=None, ge=Decimal("0"), max_digits=19, decimal_places=2)
    tax_amount: Decimal | None = Field(default=None, ge=Decimal("0"), max_digits=19, decimal_places=2)
    line_total: Decimal | None = Field(default=None, ge=Decimal("0"), max_digits=19, decimal_places=2)

    @field_validator("name")
    @classmethod
    def normalize_name(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("Tên mặt hàng không được để trống")
        return value


class InvoiceItemsUpdate(BaseModel):
    items: list[InvoiceItemEdit] = Field(max_length=200)


class InvoiceOut(BaseModel):
    id: UUID
    user_id: UUID
    account_id: UUID | None
    category_id: UUID | None
    source: str
    status: str
    merchant_name: str | None
    merchant_address: str | None
    merchant_tax_code: str | None
    invoice_number: str | None
    invoice_symbol: str | None
    invoice_date: date | None
    vat_rate: str | None
    payment_method: str | None
    subtotal_amount: Decimal | None
    tax_amount: Decimal | None
    total_amount: Decimal | None
    currency: str
    original_filename: str | None
    mime_type: str | None
    file_size_bytes: int | None
    ocr_confidence: Decimal | None
    note: str | None
    created_at: datetime
    updated_at: datetime
    confirmed_at: datetime | None
    # Trường phát hiện trùng lặp — backend điền sau khi quét OCR
    is_duplicate: bool = False
    duplicate_reason: str | None = None
    duplicate_check: dict = Field(default_factory=dict)
    revision: int = 1
    deleted_at: datetime | None = None
    invoice_time: str | None = None
    duplicate_of_invoice_id: UUID | None = None
    transaction_id: UUID | None = None
    # Danh sách sản phẩm chi tiết — trả về khi load đầy đủ hóa đơn
    items: list[InvoiceItemOut] = []

    model_config = {"from_attributes": True}


class InvoiceListOut(BaseModel):
    """Dùng cho danh sách hóa đơn — không cần load items để giảm tải."""
    id: UUID
    deleted_at: datetime | None = None
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
    revision: int = 1
    duplicate_of_invoice_id: UUID | None = None
    duplicate_level: Literal["NONE", "SUSPECTED", "EXACT"] = "NONE"
    duplicate_candidate_count: int = 0

    model_config = {"from_attributes": True}


class InvoiceConfirm(BaseModel):
    """
    Xác nhận hóa đơn và liên kết vào tài khoản/danh mục.
    Bổ sung các trường người dùng có thể đã chỉnh sửa trên form OCR
    để lưu lại đúng dữ liệu cuối cùng vào Invoice và tạo giao dịch chính xác.
    """
    account_id: UUID
    expected_revision: int | None = Field(default=None, ge=1)
    accept_distinct: bool = False
    duplicate_review_token: str | None = Field(default=None, min_length=64, max_length=64)
    invoice_time: str | None = Field(default=None, pattern=r"^(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$")
    category_id: UUID | None = None
    note: str | None = Field(default=None, max_length=1000)
    # Các trường chỉnh sửa tùy chọn (người dùng sửa trên form OCR)
    merchant_name: str | None = Field(default=None, max_length=255)
    invoice_date: date | None = None
    invoice_number: str | None = Field(default=None, max_length=100)
    invoice_symbol: str | None = Field(default=None, max_length=100)
    merchant_tax_code: str | None = Field(default=None, max_length=100)
    merchant_address: str | None = Field(default=None, max_length=500)
    vat_rate: str | None = Field(default=None, max_length=50)
    payment_method: str | None = Field(default=None, max_length=50)
    subtotal_amount: Decimal | None = Field(default=None, ge=Decimal("0"), max_digits=19, decimal_places=2)
    tax_amount: Decimal | None = Field(default=None, ge=Decimal("0"), max_digits=19, decimal_places=2)
    total_amount: Decimal | None = Field(default=None, gt=Decimal("0"), max_digits=19, decimal_places=2)
    items: list[InvoiceItemEdit] | None = Field(default=None, max_length=200)


class InvoiceBatchDelete(BaseModel):
    """Xóa tối đa 100 hóa đơn mỗi yêu cầu."""
    invoice_ids: list[UUID] = Field(min_length=1, max_length=100)


class InvoiceBatchOcr(BaseModel):
    """Quét AI hàng loạt — tối đa 5 hóa đơn mỗi lần để tránh spam/lạm dụng."""
    invoice_ids: list[UUID] = Field(min_length=1, max_length=5)


class InvoicePage(BaseModel):
    items: list[InvoiceListOut]
    total: int
    page: int
    page_size: int


class InvoiceDuplicateCheck(BaseModel):
    merchant_name: str | None = Field(default=None, max_length=255)
    merchant_address: str | None = Field(default=None, max_length=500)
    merchant_tax_code: str | None = Field(default=None, max_length=100)
    invoice_number: str | None = Field(default=None, max_length=100)
    invoice_symbol: str | None = Field(default=None, max_length=100)
    invoice_date: date | None = None
    invoice_time: str | None = Field(default=None, pattern=r"^(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$")
    total_amount: Decimal | None = Field(default=None, gt=0, max_digits=19, decimal_places=2)


class InvoiceResolution(BaseModel):
    expected_revision: int = Field(ge=1)
    action: Literal["SAME_INVOICE", "CLEAR"]
    matched_invoice_id: UUID | None = None


class InvoiceRestore(BaseModel):
    expected_revision: int = Field(ge=1)
