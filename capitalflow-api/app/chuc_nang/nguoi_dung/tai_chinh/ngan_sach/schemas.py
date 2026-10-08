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

from pydantic import BaseModel, Field

from app.chuc_nang.nguoi_dung.tai_chinh.ngan_sach.luu_tru.ngan_sach import BudgetPeriod


class BudgetCreate(BaseModel):
    name: str | None = Field(default=None, max_length=150, description="Để trống để tự đặt tên")
    category_id: UUID | None = None
    amount_limit: Decimal = Field(..., gt=Decimal("0"), description="Hạn mức chi tiêu")
    currency: Literal["VND"] = "VND"
    period_type: BudgetPeriod = BudgetPeriod.MONTHLY
    start_date: date
    end_date: date | None = None
    is_recurring: bool = False
    recurrence_end_date: date | None = None
    warning_percent: Decimal = Field(default=Decimal("80.00"), gt=Decimal("0"), le=Decimal("100"), description="% cảnh báo khi gần chạm hạn mức")


class BudgetUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=150)
    amount_limit: Decimal | None = Field(default=None, gt=Decimal("0"))
    currency: Literal["VND"] | None = None
    period_type: BudgetPeriod | None = None
    start_date: date | None = None
    end_date: date | None = None
    warning_percent: Decimal | None = Field(default=None, gt=Decimal("0"), le=Decimal("100"))
    is_active: bool | None = None
    recurrence_end_date: date | None = None
    effective_from: Literal["CURRENT", "NEXT"] = "NEXT"


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

    model_config = {"from_attributes": True}
