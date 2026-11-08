"""Định nghĩa hợp đồng API cho ngân sách và tiến độ chi tiêu.

Vai trò: kiểm tra hạn mức, khoảng thời gian và dữ liệu phản hồi ngân sách.
Đầu vào: payload HTTP và kết quả tổng hợp từ CSDL.
Đầu ra: DTO Pydantic cho routes ngân sách/dashboard.
Ràng buộc: tiền tệ và mốc thời gian phải khớp quy tắc nghiệp vụ.
"""

from typing import Literal
from decimal import Decimal
from datetime import date, datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.dung_chung.text.unicode import validate_utf16_length

from app.chuc_nang.nguoi_dung.tai_chinh.ngan_sach.luu_tru.ngan_sach import BudgetPeriod


class BudgetCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str | None = Field(default=None, max_length=150, description="Để trống để tự đặt tên")
    category_id: UUID | None = None
    amount_limit: Decimal = Field(..., gt=Decimal("0"), max_digits=19, decimal_places=2, description="Hạn mức chi tiêu")
    currency: Literal["VND"] = "VND"
    period_type: BudgetPeriod = BudgetPeriod.MONTHLY
    start_date: date
    end_date: date | None = None
    is_recurring: bool = False
    warning_percent: Decimal = Field(default=Decimal("80.00"), gt=Decimal("0"), le=Decimal("100"), max_digits=5, decimal_places=2, description="% cảnh báo khi gần chạm hạn mức")

    @field_validator("name")
    @classmethod
    def validate_name(cls, value: str | None) -> str | None:
        value = value.strip() if value is not None else None
        return validate_utf16_length(value, 150, "Tên ngân sách")


class BudgetUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str | None = Field(default=None, min_length=1, max_length=150)
    amount_limit: Decimal | None = Field(default=None, gt=Decimal("0"), max_digits=19, decimal_places=2)
    currency: Literal["VND"] | None = None
    period_type: BudgetPeriod | None = None
    start_date: date | None = None
    end_date: date | None = None
    warning_percent: Decimal | None = Field(default=None, gt=Decimal("0"), le=Decimal("100"), max_digits=5, decimal_places=2)
    effective_from: Literal["CURRENT", "NEXT"] = "NEXT"

    @field_validator("name")
    @classmethod
    def validate_name(cls, value: str | None) -> str | None:
        if value is not None:
            value = value.strip()
            if not value:
                raise ValueError("Tên ngân sách không được chỉ có khoảng trắng")
        return validate_utf16_length(value, 150, "Tên ngân sách")


class BudgetOut(BaseModel):
    id: UUID
    user_id: UUID
    category_id: UUID | None
    name: str
    amount_limit: Decimal
    currency: str
    period_type: BudgetPeriod
    start_date: date
    end_date: date
    warning_percent: Decimal
    is_active: bool
    is_recurring: bool
    recurrence_end_date: date | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class BudgetProgressOut(BaseModel):
    """Tiến độ của một kỳ, tính từ giao dịch và lịch thay đổi cấu hình."""
    budget_id: UUID
    user_id: UUID
    category_id: UUID | None
    budget_name: str
    amount_limit: Decimal
    currency: str
    period_type: str
    start_date: date
    end_date: date
    applies_from: date
    warning_percent: Decimal
    is_active: bool
    is_recurring: bool
    recurrence_end_date: date | None
    period_state: Literal["CURRENT", "PAUSED", "UPCOMING", "COMPLETED"]
    configured_name: str
    configured_amount_limit: Decimal
    configured_warning_percent: Decimal
    configured_is_active: bool
    next_effective_date: date | None
    next_state_date: date | None
    spent_amount: Decimal
    remaining_amount: Decimal
    usage_percent: Decimal
    # SAFE | WARNING | EXCEEDED
    progress_status: str
    period_days: int
    elapsed_days: int
    remaining_days: int
    active_elapsed_days: int
    daily_allowance: Decimal | None
    average_daily_spent: Decimal | None

    model_config = {"from_attributes": True}
