from sqlalchemy import Unicode, UnicodeText
import enum
import uuid
from datetime import datetime
from sqlalchemy import String, Boolean, DateTime, func, Uuid, Unicode, Integer
from sqlalchemy.orm import Mapped, mapped_column
from app.models.base import Base

class UserRole(str, enum.Enum):
    USER = "USER"
    ADMIN = "ADMIN"

class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    email: Mapped[str] = mapped_column(Unicode(255), unique=True, index=True, nullable=False)
    full_name: Mapped[str] = mapped_column(Unicode(150), nullable=False)
    password_hash: Mapped[str] = mapped_column(Unicode(500), nullable=False)
    role: Mapped[UserRole] = mapped_column(String(20), default=UserRole.USER)
    token_version: Mapped[int] = mapped_column(Integer, default=0, server_default="0", nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    must_change_password: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    last_login_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    last_active_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.sysutcdatetime())
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.sysutcdatetime(), onupdate=func.sysutcdatetime())
