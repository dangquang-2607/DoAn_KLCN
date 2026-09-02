from decimal import Decimal
from datetime import datetime
from uuid import UUID
from pydantic import BaseModel


class OcrJobOut(BaseModel):
    """Chi tiết một OCR Job — dùng để hiển thị tiến độ xử lý hóa đơn."""
    id: UUID
    user_id: UUID
    invoice_id: UUID | None
    status: str
    provider: str | None
    model_name: str | None
    attempt_count: int
    progress_percent: int
    error_code: str | None
    error_message: str | None
    processing_ms: int | None
    started_at: datetime | None
    completed_at: datetime | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class OcrJobCreate(BaseModel):
    """Tạo OCR Job mới khi upload hóa đơn."""
    invoice_id: UUID | None = None
    provider: str | None = None
    model_name: str | None = None
