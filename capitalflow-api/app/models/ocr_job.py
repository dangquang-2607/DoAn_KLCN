"""
OcrJob model — theo dõi quá trình xử lý OCR hóa đơn bằng Gemini AI.
Đồng bộ 100% với CSDL.sql: thêm model_name, attempt_count, progress_percent,
error_code, request_json, response_json, processing_ms, updated_at.
"""
import uuid
from datetime import datetime
from sqlalchemy import String, Integer, SmallInteger, DateTime, ForeignKey, func, Uuid, Index, Text
from sqlalchemy.orm import Mapped, mapped_column
from app.models.base import Base


class OcrJob(Base):
    __tablename__ = "ocr_jobs"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"))
    # invoice_id có thể NULL khi job được tạo trước khi có invoice
    invoice_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("invoices.id"), nullable=True)

    status: Mapped[str] = mapped_column(String(30), nullable=False, default="QUEUED")
    # Tên nhà cung cấp AI (VD: "google_gemini")
    provider: Mapped[str | None] = mapped_column(String(100), nullable=True)
    # Tên model cụ thể (VD: "gemini-2.0-flash")
    model_name: Mapped[str | None] = mapped_column(String(150), nullable=True)

    # Số lần thử lại (retry count)
    attempt_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    # Tiến độ xử lý 0-100%
    progress_percent: Mapped[int] = mapped_column(SmallInteger, nullable=False, default=0)

    # Thông tin lỗi
    error_code: Mapped[str | None] = mapped_column(String(100), nullable=True)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Payload gửi đi và nhận về (JSON text)
    request_json: Mapped[str | None] = mapped_column(Text, nullable=True)
    response_json: Mapped[str | None] = mapped_column(Text, nullable=True)  # đổi từ raw_response

    # Timestamps
    started_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    # Thời gian xử lý tính bằng milliseconds
    processing_ms: Mapped[int | None] = mapped_column(Integer, nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.sysutcdatetime())
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.sysutcdatetime(), onupdate=func.sysutcdatetime())

    __table_args__ = (
        Index("IX_ocr_jobs_user_created", "user_id", "created_at"),
        Index("IX_ocr_jobs_status_created", "status", "created_at"),
        Index("IX_ocr_jobs_invoice", "invoice_id", "created_at"),
    )
