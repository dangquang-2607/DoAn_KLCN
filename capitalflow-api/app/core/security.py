from datetime import datetime, timedelta, timezone

import jwt
from pwdlib import PasswordHash

from app.core.config import settings

# Argon2 là thuật toán hash password hiện đại nhất, thay thế bcrypt
password_hash = PasswordHash.recommended()


def hash_password(password: str) -> str:
    """Hash mật khẩu bằng Argon2."""
    return password_hash.hash(password)


def verify_password(password: str, hashed_password: str) -> bool:
    """Kiểm tra mật khẩu với hash đã lưu."""
    return password_hash.verify(password, hashed_password)


def create_access_token(user_id: str, role: str, token_version: int = 0) -> str:
    """Tạo JWT access token với thời hạn theo config."""
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
    return jwt.encode(
        payload,
        settings.jwt_secret_key,
        algorithm=settings.jwt_algorithm,
    )


def decode_token(token: str) -> dict:
    """Decode và validate JWT. Raise jwt.InvalidTokenError nếu lỗi."""
    payload = jwt.decode(
        token,
        settings.jwt_secret_key,
        algorithms=[settings.jwt_algorithm],
        options={"require": ["sub", "exp", "type", "ver"]},
    )

    if payload.get("type") != "access" or type(payload.get("ver")) is not int:
        raise jwt.InvalidTokenError("Invalid access token claims")
    return payload
