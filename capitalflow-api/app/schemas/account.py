from decimal import Decimal
from uuid import UUID
from datetime import datetime

from pydantic import BaseModel

from app.models.account import AccountType


class AccountCreate(BaseModel):
    name: str
    account_type: AccountType
    institution_name: str | None = None
    balance: Decimal = Decimal("0")
    currency: str = "VND"
    icon: str | None = None
    color: str | None = None


class AccountUpdate(BaseModel):
    name: str | None = None
    account_type: AccountType | None = None
    institution_name: str | None = None
    balance: Decimal | None = None
    currency: str | None = None
    icon: str | None = None
    color: str | None = None
    is_active: bool | None = None


class AccountOut(BaseModel):
    id: UUID
    user_id: UUID
    name: str
    account_type: AccountType
    institution_name: str | None
    balance: Decimal
    currency: str
    icon: str | None
    color: str | None
    is_active: bool
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
