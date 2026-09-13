from datetime import datetime
from sqlalchemy import String, UnicodeText, DateTime, ForeignKey, Uuid, func
from sqlalchemy.orm import Mapped, mapped_column
from uuid import UUID
from app.models.base import Base

class IdempotencyRecord(Base):
    __tablename__ = "idempotency_records"
    user_id: Mapped[UUID] = mapped_column(Uuid, ForeignKey("users.id"), primary_key=True)
    request_key: Mapped[str] = mapped_column(String(128), primary_key=True)
    payload_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    response_json: Mapped[str] = mapped_column(UnicodeText, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.sysutcdatetime())
