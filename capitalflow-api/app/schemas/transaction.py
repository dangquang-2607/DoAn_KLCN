from decimal import Decimal
from datetime import date, datetime
from uuid import UUID

from pydantic import BaseModel

from app.models.transaction import TransactionType, TransactionSource


class TransactionCreate(BaseModel):
    account_id: UUID
    category_id: UUID | None = None
    invoice_id: UUID | None = None
    amount: Decimal
    type: TransactionType
    source: TransactionSource = TransactionSource.MANUAL
    transaction_date: date
    description: str = ""
    note: str | None = None


class TransactionUpdate(BaseModel):
    account_id: UUID | None = None
    category_id: UUID | None = None
    amount: Decimal | None = None
    type: TransactionType | None = None
    transaction_date: date | None = None
    description: str | None = None
    note: str | None = None


class TransactionOut(BaseModel):
    id: UUID
    user_id: UUID
    account_id: UUID
    category_id: UUID | None
    invoice_id: UUID | None
    amount: Decimal
    type: TransactionType
    source: TransactionSource
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
