from decimal import Decimal
from datetime import date, datetime
from uuid import UUID

from pydantic import BaseModel, Field, field_validator, model_validator

from app.models.transaction import TransactionType, TransactionSource


class TransactionCreate(BaseModel):
    account_id: UUID
    category_id: UUID | None = None
    invoice_id: UUID | None = None
    amount: Decimal = Field(gt=0, max_digits=19, decimal_places=2)
    type: TransactionType
    source: TransactionSource = TransactionSource.MANUAL
    transaction_date: date
    description: str = Field(default="", max_length=255)
    note: str | None = Field(default=None, max_length=1000)


class TransactionUpdate(BaseModel):
    @model_validator(mode="before")
    @classmethod
    def reject_null_required_fields(cls, values):
        if not isinstance(values, dict):
            return values
        for key in ("account_id", "amount", "type", "transaction_date", "description"):
            if key in values and values[key] is None:
                raise ValueError(f"{key} không được null")
        return values

    account_id: UUID | None = None
    category_id: UUID | None = None
    amount: Decimal | None = Field(default=None, gt=0, max_digits=19, decimal_places=2)
    type: TransactionType | None = None
    transaction_date: date | None = None
    description: str | None = Field(default=None, max_length=255)
    note: str | None = Field(default=None, max_length=1000)


class TransactionTransfer(BaseModel):
    """Schema cho tính năng chuyển tiền giữa 2 ví (Atomic Transfer)."""
    from_account_id: UUID
    to_account_id: UUID
    amount: Decimal = Field(gt=0, max_digits=19, decimal_places=2)
    transaction_date: date | None = None
    note: str | None = Field(default=None, max_length=1000)

    @field_validator("amount")
    @classmethod
    def amount_must_be_positive(cls, v: Decimal) -> Decimal:
        if v <= 0:
            raise ValueError("Số tiền chuyển phải lớn hơn 0")
        return v


class TransactionOut(BaseModel):
    id: UUID
    user_id: UUID
    account_id: UUID
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
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class TransactionPage(BaseModel):
    items: list[TransactionOut]
    total: int
    page: int
    page_size: int
