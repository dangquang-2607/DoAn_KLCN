"""Định nghĩa hợp đồng API cho tài khoản ví/ngân hàng.

Vai trò: kiểm tra dữ liệu tạo, cập nhật và phản hồi tài khoản.
Đầu vào: JSON từ HTTP boundary hoặc dữ liệu ORM.
Đầu ra: DTO Pydantic đã chuẩn hóa kiểu tiền tệ và định danh.
Ràng buộc: validation phải thống nhất với giới hạn trong model và nghiệp vụ số dư.
"""

from decimal import Decimal
from uuid import UUID
from datetime import datetime

from pydantic import BaseModel, Field, field_validator

from app.modules.taichinh.persistence.account import AccountType
from app.shared.text.unicode import normalize_unicode_text


class AccountCreate(BaseModel):
    name: str = Field(min_length=1, max_length=150)
    account_type: AccountType
    institution_name: str | None = Field(default=None, max_length=150)
    balance: Decimal = Field(default=Decimal("0"), max_digits=19, decimal_places=2)
    currency: str = "VND"
    color: str | None = None

    @field_validator("name", mode="before")
    @classmethod
    def validate_name(cls, value: str) -> str:
        value = normalize_unicode_text(value, strip=True)
        if not value:
            raise ValueError("Tên tài khoản không được rỗng")
        return value

    @field_validator("institution_name", mode="before")
    @classmethod
    def normalize_optional_text(cls, value: str | None) -> str | None:
        return normalize_unicode_text(value, strip=True) if value is not None else None

    @field_validator("currency")
    @classmethod
    def validate_currency_vnd(cls, v: str) -> str:
        if v.upper() != "VND":
            raise ValueError("Hệ thống hiện chỉ hỗ trợ loại tiền tệ VND")
        return "VND"


class AccountUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=150)
    account_type: AccountType | None = None
    institution_name: str | None = Field(default=None, max_length=150)
    balance: Decimal | None = Field(default=None, max_digits=19, decimal_places=2)
    currency: str | None = None
    color: str | None = None
    is_active: bool | None = None

    @field_validator("name", mode="before")
    @classmethod
    def validate_name(cls, value: str | None) -> str | None:
        if value is None:
            raise ValueError("Tên tài khoản không được null")
        value = normalize_unicode_text(value, strip=True)
        if not value:
            raise ValueError("Tên tài khoản không được rỗng")
        return value

    @field_validator("institution_name", mode="before")
    @classmethod
    def normalize_optional_text(cls, value: str | None) -> str | None:
        return normalize_unicode_text(value, strip=True) if value is not None else None

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
    color: str | None
    is_active: bool
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
