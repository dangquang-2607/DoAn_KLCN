import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Index, Integer, String, UnicodeText, Uuid
from sqlalchemy.orm import Mapped, mapped_column

from app.dung_chung.database.nen_tang import Base


class PushRegistration(Base):
    __tablename__ = "push_registrations"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    session_id: Mapped[uuid.UUID] = mapped_column(Uuid, nullable=False)
    token_version: Mapped[int] = mapped_column(Integer, nullable=False)
    provider: Mapped[str] = mapped_column(String(8), nullable=False)
    target_hash: Mapped[str] = mapped_column(String(64), nullable=False, unique=True)
    destination: Mapped[str] = mapped_column(UnicodeText, nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)

    __table_args__ = (Index("IX_push_registrations_user_expiry", "user_id", "expires_at"),)
