from decimal import Decimal
from uuid import UUID
from datetime import datetime

from pydantic import BaseModel, Field, field_validator

from app.models.account import AccountType


class AccountCreate(BaseModel):
    name: str
    account_type: AccountType
    institution_name: str | None = None
    balance: Decimal = Field(default=Decimal("0"), max_digits=19, decimal_places=2)
    currency: str = "VND"
    icon: str | None = None
    color: str | None = None

    @field_validator("currency")
    @classmethod
    def validate_currency_vnd(cls, v: str) -> str:
        if v.upper() != "VND":
            raise ValueError("Hệ thống hiện chỉ hỗ trợ loại tiền tệ VND")
        return "VND"


class AccountUpdate(BaseModel):
    name: str | None = None
    account_type: AccountType | None = None
    institution_name: str | None = None
    balance: Decimal | None = Field(default=None, max_digits=19, decimal_places=2)
    currency: str | None = None
    icon: str | None = None
    color: str | None = None
    is_active: bool | None = None

    @field_validator("currency")
    @classmethod
    def validate_currency_vnd(cls, v: str | None) -> str | None:
        if v is not None and v.upper() != "VND":
            raise ValueError("Hệ thống hiện chỉ hỗ trợ loại tiền tệ VND")
        return "VND" if v is not None else v


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
