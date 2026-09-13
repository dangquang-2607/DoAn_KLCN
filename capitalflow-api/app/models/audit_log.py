from sqlalchemy import Unicode, UnicodeText
"""
AuditLog model — ghi lại mọi thao tác thay đổi dữ liệu.
id là BIGINT IDENTITY (auto-increment) như trong CSDL.sql.
"""
import uuid
from datetime import datetime
from sqlalchemy import BigInteger, Integer, String, SmallInteger, DateTime, ForeignKey, func, Uuid, Index, Text
from sqlalchemy.orm import Mapped, mapped_column
from app.models.base import Base


class AuditLog(Base):
    __tablename__ = "audit_logs"

    # id là BIGINT IDENTITY — khớp với CSDL.sql
    id: Mapped[int] = mapped_column(BigInteger().with_variant(Integer, "sqlite"), primary_key=True, autoincrement=True)
    user_id: Mapped[uuid.UUID | None] = mapped_column(Uuid, ForeignKey("users.id"), nullable=True)

    # Hành động & đối tượng bị tác động
    action: Mapped[str] = mapped_column(Unicode(100), nullable=False)
    entity_type: Mapped[str | None] = mapped_column(Unicode(100), nullable=True)
    entity_id: Mapped[uuid.UUID | None] = mapped_column(Uuid, nullable=True)

    # Thông tin HTTP Request
    request_id: Mapped[uuid.UUID | None] = mapped_column(Uuid, nullable=True)
    route: Mapped[str | None] = mapped_column(Unicode(500), nullable=True)
    http_method: Mapped[str | None] = mapped_column(String(10), nullable=True)
    status_code: Mapped[int | None] = mapped_column(SmallInteger, nullable=True)
    ip_address: Mapped[str | None] = mapped_column(String(45), nullable=True)
    user_agent: Mapped[str | None] = mapped_column(Unicode(1000), nullable=True)

    # Dữ liệu trước & sau khi thay đổi (JSON)
    old_values_json: Mapped[str | None] = mapped_column(UnicodeText, nullable=True)
    new_values_json: Mapped[str | None] = mapped_column(UnicodeText, nullable=True)
    metadata_json: Mapped[str | None] = mapped_column(UnicodeText, nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.sysutcdatetime())

    __table_args__ = (
        Index("IX_audit_logs_user", "user_id", "created_at"),
        Index("IX_audit_logs_created_at", "created_at"),
        Index("IX_audit_logs_entity", "entity_type", "entity_id", "created_at"),
        Index("IX_audit_logs_request", "request_id"),
    )
