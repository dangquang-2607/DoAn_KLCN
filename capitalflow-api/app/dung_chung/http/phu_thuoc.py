"""Cung cấp cơ chế tiêm phụ thuộc cho CSDL và phân quyền API.

Vai trò: tạo DB session, xác định người dùng hiện tại và chặn route yêu cầu quyền admin.
Đầu vào: request, bearer token và SessionLocal.
Đầu ra: Session hoặc User đã xác thực cho route handler.
Ràng buộc: luôn đóng session và ghi request.state tối thiểu cho audit middleware.
"""

import uuid
from datetime import datetime, timezone

import jwt
from fastapi import Depends, HTTPException, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from sqlalchemy import update, or_
from datetime import timedelta

from app.dung_chung.database.session import SessionLocal
from app.dung_chung.security.tokens import decode_token
from app.chuc_nang.nguoi_dung.dang_nhap.luu_tru.nguoi_dung import User, UserRole

security = HTTPBearer()


def get_db(request: Request):
    """Cung cấp phiên CSDL và gắn vào request.state cho middleware kiểm toán."""
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
    """Giải mã JWT, trả về user hiện tại và gắn user_id cho middleware kiểm toán."""
    try:
        token = credentials.credentials
        payload = decode_token(token)
        user_id = uuid.UUID(payload["sub"])
    except Exception:
        raise HTTPException(status_code=401, detail="Token không hợp lệ hoặc đã hết hạn")

    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=401, detail="Tài khoản không tồn tại")
    if user.is_deleted:
        raise HTTPException(status_code=403, detail="Tài khoản đã bị xóa hoặc đang chờ xóa vĩnh viễn")
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
    """Yêu cầu quyền quản trị viên và trả lỗi 403 nếu không đủ quyền."""
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Yêu cầu quyền Admin")
    return current_user
