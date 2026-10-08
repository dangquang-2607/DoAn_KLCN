"""Quản lý phiên đăng nhập và vòng đời refresh token.

Vai trò: khóa user khi cần, xoay vòng token và thu hồi phiên khi phát hiện tái sử dụng.
Đầu vào: DB session, user/token identifiers và token metadata.
Đầu ra: phiên hợp lệ, token mới hoặc trạng thái thu hồi.
Ràng buộc: rotation và revocation phải nằm trong transaction nhất quán để ngăn replay.
"""

from datetime import datetime, timezone
from fastapi import HTTPException
from sqlalchemy import select
from app.chuc_nang.nguoi_dung.dang_nhap.luu_tru.nguoi_dung import User
from app.chuc_nang.nguoi_dung.dang_nhap.luu_tru.refresh_token import RefreshToken


def locked_user(db, user_id, expected_version=None):
    user = db.scalar(select(User).where(User.id == user_id).with_hint(
        User, "WITH (UPDLOCK, ROWLOCK)", dialect_name="mssql"
    ).execution_options(populate_existing=True))
    if not user or not user.is_active or (expected_version is not None and user.token_version != expected_version):
        raise HTTPException(status_code=401, detail="Phiên đăng nhập không còn hợp lệ")
    return user


def revoke_sessions(db, user, reason):
    user.token_version += 1
    db.query(RefreshToken).filter(RefreshToken.user_id == user.id, RefreshToken.revoked_at.is_(None)).update(
        {"revoked_at": datetime.now(timezone.utc), "revocation_reason": reason}, synchronize_session="fetch")
