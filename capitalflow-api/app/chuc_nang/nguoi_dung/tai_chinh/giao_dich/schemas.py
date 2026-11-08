"""Định nghĩa trường phản hồi và danh sách xóa của sổ thu chi.

Vai trò: kiểm tra dữ liệu giao dịch trước khi đi vào dịch vụ sổ cái.
Đầu vào: payload HTTP và dữ liệu ORM/reporting.
Đầu ra: DTO Pydantic với số tiền, ngày, tài khoản và danh mục đã định kiểu.
Ràng buộc: validation chỉ là lớp đầu; service vẫn phải khóa dòng và kiểm tra quyền sở hữu.
"""

from decimal import Decimal
from datetime import date, datetime
from uuid import UUID

from pydantic import BaseModel, Field, field_validator

from app.chuc_nang.nguoi_dung.tai_chinh.giao_dich.luu_tru.giao_dich import TransactionType, TransactionSource


class TransactionBatchDelete(BaseModel):
    """Danh sách hữu hạn, không lặp để xóa nguyên tử nhiều giao dịch."""
    transaction_ids: list[UUID] = Field(min_length=1, max_length=100)

    @field_validator("transaction_ids")
    @classmethod
    def unique_ids(cls, values: list[UUID]) -> list[UUID]:
        if len(values) != len(set(values)):
            raise ValueError("Danh sách giao dịch chứa ID trùng lặp")
        return values


class TransactionOutFields(BaseModel):
    """Shared output fields; each flow defines its own account relationship."""
    bank_reference: str | None = None
    id: UUID
    user_id: UUID
    category_id: UUID | None
    invoice_id: UUID | None
    amount: Decimal
    type: TransactionType
    source: TransactionSource
    kind: str = "NORMAL"
    transfer_id: UUID | None = None
    transaction_date: date
    description: str
    note: str | None
    category_confidence: Decimal | None = None
    category_source: str | None = None
    category_was_auto: bool = False
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
