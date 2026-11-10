"""Phát hành và xác minh JWT truy cập dùng chung.

Vai trò: tạo access token từ định danh/quyền và kiểm tra claim khi nhận request.
Đầu vào: user ID, role, token version hoặc chuỗi JWT từ HTTP boundary.
Đầu ra: JWT đã ký hoặc tập claim đã được xác minh.
Ràng buộc: chỉ chấp nhận access token đủ claim bắt buộc và đúng token version kiểu số.
"""

from datetime import datetime, timedelta, timezone

import jwt

from app.dung_chung.config import settings


def create_access_token(user_id: str, role: str, token_version: int = 0, session_id: str | None = None) -> str:
    """Tạo access token có hạn dùng theo cấu hình runtime."""
    expire = datetime.now(timezone.utc) + timedelta(
        minutes=settings.access_token_expire_minutes
    )
    payload = {
        "sub": user_id,
        "role": role,
        "type": "access",
        "ver": token_version,
        "exp": expire,
    }
    if session_id:
        payload["sid"] = session_id
    return jwt.encode(payload, settings.jwt_secret_key, algorithm=settings.jwt_algorithm)


def create_invoice_upload_grant(user_id: str, token_version: int, session_id: str) -> tuple[str, datetime]:
    expires_at = datetime.now(timezone.utc) + timedelta(hours=24)
    claims = {"sub": user_id, "type": "invoice_upload", "ver": token_version,
              "sid": session_id, "exp": expires_at}
    return jwt.encode(claims, settings.jwt_secret_key, algorithm=settings.jwt_algorithm), expires_at


def decode_token(token: str, *, allowed_types: tuple[str, ...] = ("access",)) -> dict:
    """Xác minh JWT và trả claim hợp lệ cho lớp phân quyền."""
    payload = jwt.decode(
        token,
        settings.jwt_secret_key,
        algorithms=[settings.jwt_algorithm],
        options={"require": ["sub", "exp", "type", "ver"]},
    )
    if payload.get("type") not in allowed_types or type(payload.get("ver")) is not int:
        raise jwt.InvalidTokenError("Claim của access token không hợp lệ")
    return payload
