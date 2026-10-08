"""Định nghĩa hợp đồng API theo dõi tác vụ OCR bất đồng bộ.

Vai trò: biểu diễn trạng thái, tiến độ, lỗi và kết quả phân loại của OCR job.
Đầu vào: model OcrJob và payload tạo/retry hợp lệ.
Đầu ra: DTO cho giao diện theo dõi và quản trị OCR.
Ràng buộc: phân biệt trạng thái OCR với trạng thái hàng đợi BackgroundJob.
"""

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
