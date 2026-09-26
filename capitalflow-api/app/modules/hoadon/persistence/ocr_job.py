"""
Model theo dõi quá trình xử lý OCR hóa đơn bằng Gemini AI.
Đồng bộ với schema SQL Server: thêm model_name, attempt_count, progress_percent,
error_code, response_json, processing_ms, updated_at.
"""
import uuid
from datetime import datetime
from sqlalchemy import Unicode, UnicodeText, String, Integer, SmallInteger, DateTime, ForeignKey, func, Uuid, Index
from sqlalchemy.orm import Mapped, mapped_column
from app.shared.database.base import Base


class OcrJob(Base):
    __tablename__ = "ocr_jobs"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"))
    # invoice_id có thể NULL khi job được tạo trước khi có invoice
    invoice_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("invoices.id"), nullable=True)

    status: Mapped[str] = mapped_column(String(30), nullable=False, default="QUEUED")
    # Tên nhà cung cấp AI (VD: "google_gemini")
    provider: Mapped[str | None] = mapped_column(Unicode(100), nullable=True)
    # Tên model cụ thể (VD: "gemini-2.0-flash")
    model_name: Mapped[str | None] = mapped_column(Unicode(150), nullable=True)

    # Số lần thử lại.
    attempt_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    # Tiến độ xử lý 0-100%
    progress_percent: Mapped[int] = mapped_column(SmallInteger, nullable=False, default=0)

    # Thông tin lỗi
    error_code: Mapped[str | None] = mapped_column(Unicode(100), nullable=True)
    error_message: Mapped[str | None] = mapped_column(Unicode(2000), nullable=True)

    # Kết quả OCR đã chuẩn hóa (JSON text). Không lưu request để tránh nhân đôi
    # nội dung hóa đơn nhạy cảm vốn đã nằm trong file nguồn.
    response_json: Mapped[str | None] = mapped_column(UnicodeText, nullable=True)  # đổi từ raw_response

    # Các mốc thời gian của vòng đời OCR.
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
