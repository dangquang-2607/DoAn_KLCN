from typing import Literal
from decimal import Decimal
from datetime import date, datetime
from uuid import UUID

from pydantic import BaseModel, Field

from app.models.budget import BudgetPeriod


class BudgetCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=150, description="Tên ngân sách")
    category_id: UUID | None = None
    amount_limit: Decimal = Field(..., gt=0, description="Hạn mức chi tiêu")
    currency: Literal["VND"] = "VND"
    period_type: BudgetPeriod = BudgetPeriod.MONTHLY
    start_date: date
    end_date: date
    warning_percent: Decimal = Field(default=Decimal("80.00"), gt=0, le=100, description="% cảnh báo khi gần chạm hạn mức")


class BudgetUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=150)
    amount_limit: Decimal | None = Field(default=None, gt=0)
    currency: Literal["VND"] | None = None
    period_type: BudgetPeriod | None = None
    start_date: date | None = None
    end_date: date | None = None
    warning_percent: Decimal | None = Field(default=None, gt=0, le=100)
    is_active: bool | None = None


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
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class BudgetProgressOut(BaseModel):
    """Kết quả từ view vw_budget_progress — tiến độ thực tế của ngân sách."""
    budget_id: UUID
    user_id: UUID
    category_id: UUID | None
    budget_name: str
    amount_limit: Decimal
    currency: str
    period_type: str
    start_date: date
    end_date: date
    warning_percent: Decimal
    is_active: bool
    spent_amount: Decimal
    remaining_amount: Decimal
    usage_percent: Decimal
    # SAFE | WARNING | EXCEEDED — khớp với view vw_budget_progress
    progress_status: str

    model_config = {"from_attributes": True}
