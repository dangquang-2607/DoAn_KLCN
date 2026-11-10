"""Tạo và băm refresh token phục vụ xoay vòng phiên đăng nhập.

Vai trò: tạo token ngẫu nhiên, lưu duy nhất bản băm và metadata thiết bị.
Đầu vào: Session, user/family/parent ID cùng thông tin client.
Đầu ra: raw token trả một lần cho client và ID bản ghi.
Ràng buộc: raw token không được ghi vào CSDL hoặc log.
"""

import hashlib
import uuid
from datetime import datetime, timedelta, timezone

from sqlalchemy.orm import Session

from app.dung_chung.config import settings
from app.chuc_nang.nguoi_dung.dang_nhap.luu_tru.refresh_token import RefreshToken


def hash_refresh_token(raw: str) -> str:
    """Băm refresh token bằng SHA-256 trước khi truy vấn hoặc lưu."""

    return hashlib.sha256(raw.encode()).hexdigest()


def create_refresh_token(
    db: Session,
    user_id: uuid.UUID,
    family_id: uuid.UUID,
    parent_token_id: uuid.UUID | None = None,
    device_name: str | None = None,
    ip_address: str | None = None,
    user_agent: str | None = None,
) -> tuple[str, uuid.UUID]:
    """Tạo refresh token mới trong cùng transaction với nghiệp vụ caller."""

    raw_token = str(uuid.uuid4())
    token_id = uuid.uuid4()
    expires_at = datetime.now(timezone.utc) + timedelta(days=settings.refresh_token_expire_days)
    db.add(
        RefreshToken(
            id=token_id,
            user_id=user_id,
            token_hash=hash_refresh_token(raw_token),
            family_id=family_id,
            parent_token_id=parent_token_id,
            expires_at=expires_at,
            device_name=(device_name or "")[:150] or None,
            ip_address=(ip_address or "")[:45] or None,
            user_agent=(user_agent or "")[:1000] or None,
        )
    )
    return raw_token, token_id
