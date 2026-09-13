import uuid
from datetime import datetime, timezone

import jwt
from fastapi import Depends, HTTPException, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from sqlalchemy import update, or_
from datetime import timedelta

from app.core.database import SessionLocal
from app.core.security import decode_token
from app.models.user import User, UserRole

security = HTTPBearer()


def get_db(request: Request):
    """Dependency: cung cấp DB session, gán vào request.state để Audit Middleware truy cập."""
    db = SessionLocal()
    request.state.db = db
    db.info["request"] = request
    try:
        yield db
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


def get_current_user(
    request: Request,
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db),
) -> User:
    """Dependency: decode JWT → trả về User hiện tại. Gán user_id vào request.state cho Audit Middleware."""
    try:
        token = credentials.credentials
        payload = decode_token(token)
        user_id = uuid.UUID(payload["sub"])
    except Exception:
        raise HTTPException(status_code=401, detail="Token không hợp lệ hoặc đã hết hạn")

    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=401, detail="Tài khoản không tồn tại")
    if payload["ver"] != user.token_version:
        raise HTTPException(status_code=401, detail="Phiên đăng nhập đã bị thu hồi")
    if not user.is_active:
        raise HTTPException(status_code=403, detail="Tài khoản đã bị khóa")

    if user.must_change_password and request.url.path not in {
        "/api/v1/auth/me", "/api/v1/auth/first-time-password", "/api/v1/auth/logout"
    }:
        raise HTTPException(status_code=403, detail="Vui lòng thiết lập mật khẩu trước khi sử dụng hệ thống")

    # Gán user_id vào request.state để AuditMiddleware ghi nhật ký chính xác
    request.state.user_id = user.id

    now = datetime.now(timezone.utc)
    last=user.last_active_at
    if last is None or (now-last.replace(tzinfo=timezone.utc)).total_seconds()>60:
        db.execute(update(User).where(User.id==user.id,or_(User.last_active_at.is_(None),User.last_active_at<now-timedelta(seconds=60))).values(last_active_at=now).execution_options(synchronize_session=False))
        db.commit()

    return user


def require_admin(current_user: User = Depends(get_current_user)) -> User:
    """Dependency: yêu cầu quyền Admin. Raise 403 nếu không đủ quyền."""
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Yêu cầu quyền Admin")
    return current_user
