"""Minimal receipt identity survives source deletion only while its posting exists."""
import uuid
from datetime import date, datetime
from sqlalchemy import Uuid, ForeignKey, String, Unicode, UnicodeText, Date, DateTime, Index, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column
from app.dung_chung.database.nen_tang import Base


class InvoicePostingEvidence(Base):
    __tablename__ = 'invoice_posting_evidence'
    transaction_id: Mapped[uuid.UUID] = mapped_column(ForeignKey('transactions.id', ondelete='CASCADE'), primary_key=True)
    invoice_id: Mapped[uuid.UUID] = mapped_column(Uuid, nullable=False)
    user_id: Mapped[uuid.UUID] = mapped_column(Uuid, nullable=False)
    file_sha256: Mapped[str | None] = mapped_column(String(64))
    strong_identity_key: Mapped[str | None] = mapped_column(String(64))
    invoice_date: Mapped[date | None] = mapped_column(Date)
    invoice_number: Mapped[str | None] = mapped_column(Unicode(100))
    snapshot_json: Mapped[str] = mapped_column(UnicodeText, nullable=False)
    basket_hash: Mapped[str | None] = mapped_column(String(64))
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    purged_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    __table_args__ = (
        UniqueConstraint('invoice_id', name='UQ_invoice_evidence_invoice'),
        Index('IX_invoice_evidence_file', 'user_id', 'file_sha256'),
        Index('IX_invoice_evidence_identity', 'user_id', 'strong_identity_key'),
        Index('IX_invoice_evidence_date', 'user_id', 'invoice_date'),
        Index('IX_invoice_evidence_number', 'user_id', 'invoice_number'),
    )
