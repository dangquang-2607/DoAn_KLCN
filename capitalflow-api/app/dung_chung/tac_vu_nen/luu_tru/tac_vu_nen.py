"""Ánh xạ hàng đợi công việc nền bền vững trong CSDL.

Vai trò: lưu loại job, payload mã hóa, lease, số lần thử và trạng thái xử lý.
Đầu vào: jobs service và worker.
Đầu ra: thực thể BackgroundJob cho cơ chế giao nhận at-least-once.
Ràng buộc: lease token bảo vệ quyền sở hữu; trạng thái cuối của job lỗi là DEAD.
"""

import uuid
from datetime import datetime
from sqlalchemy import String, Integer, DateTime, UnicodeText, Uuid, Index, func
from sqlalchemy.orm import Mapped, mapped_column
from app.dung_chung.database.nen_tang import Base

class BackgroundJob(Base):
    __tablename__ = "background_jobs"
    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    kind: Mapped[str] = mapped_column(String(30), nullable=False)
    payload: Mapped[str] = mapped_column(UnicodeText, nullable=False)
    dedupe_key: Mapped[str] = mapped_column(String(200), unique=True, nullable=False)
    status: Mapped[str] = mapped_column(String(20), default="PENDING", nullable=False)
    attempts: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    available_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    lease_until: Mapped[datetime | None] = mapped_column(DateTime)
    lease_token: Mapped[uuid.UUID | None] = mapped_column(Uuid)
    error_code: Mapped[str | None] = mapped_column(String(100))
    # Lưu owner ở dạng phi chuẩn hóa để hủy job khi xóa tài khoản trong thời gian hữu hạn,
    # đồng thời tránh phải giải mã toàn bộ payload đang nằm trong hàng đợi.
    owner_user_id: Mapped[uuid.UUID | None] = mapped_column(Uuid, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.sysutcdatetime())
    __table_args__ = (
        Index("IX_background_jobs_poll", "status", "available_at", "lease_until"),
        Index("IX_background_jobs_kind_poll", "kind", "status", "available_at", "lease_until"),
        Index("IX_background_jobs_owner", "owner_user_id", "status"),
    )
