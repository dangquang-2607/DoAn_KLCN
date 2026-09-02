import uuid

import jwt
from fastapi import Depends, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session

from app.core.database import SessionLocal
from app.core.security import decode_token
from app.models.user import User, UserRole

security = HTTPBearer()


def get_db():
    """Dependency: cung cấp DB session, đảm bảo đóng sau mỗi request."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db),
) -> User:
    """Dependency: decode JWT → trả về User hiện tại. Raise 401 nếu invalid."""
    try:
        token = credentials.credentials
        payload = decode_token(token)
        user_id = uuid.UUID(payload["sub"])
    except Exception:
        raise HTTPException(status_code=401, detail="Token không hợp lệ hoặc đã hết hạn")

    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=401, detail="Tài khoản không tồn tại")
    if not user.is_active:
        raise HTTPException(status_code=403, detail="Tài khoản đã bị khóa")

    return user


def require_admin(current_user: User = Depends(get_current_user)) -> User:
    """Dependency: yêu cầu quyền Admin. Raise 403 nếu không đủ quyền."""
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Yêu cầu quyền Admin")
    return current_user
