"""Invoice decisions; transaction IDs are snapshots so deletion can preserve history."""
import uuid
from datetime import datetime
from sqlalchemy import DateTime, ForeignKey, Integer, String, UnicodeText, Uuid, func, Index
from sqlalchemy.orm import Mapped, mapped_column
from app.dung_chung.database.nen_tang import Base


class InvoiceEvent(Base):
    __tablename__ = "invoice_events"
    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"))
    invoice_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("invoices.id"))
    action: Mapped[str] = mapped_column(String(40))
    revision: Mapped[int] = mapped_column(Integer)
    details_json: Mapped[str | None] = mapped_column(UnicodeText, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.sysutcdatetime())
    __table_args__ = (Index("IX_invoice_events_user_invoice", "user_id", "invoice_id", "created_at"),)
