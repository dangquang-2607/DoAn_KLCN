import uuid
from datetime import datetime
from sqlalchemy import String, Integer, DateTime, UnicodeText, Uuid, Index, func
from sqlalchemy.orm import Mapped, mapped_column
from app.models.base import Base

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
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.sysutcdatetime())
    __table_args__ = (Index("IX_background_jobs_poll", "status", "available_at", "lease_until"),)
