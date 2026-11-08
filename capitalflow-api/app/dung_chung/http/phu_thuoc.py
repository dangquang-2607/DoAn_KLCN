"""Cung cấp cơ chế tiêm phụ thuộc cho CSDL và phân quyền API.

Vai trò: tạo DB session, xác định người dùng hiện tại và chặn route yêu cầu quyền admin.
Đầu vào: request, bearer token và SessionLocal.
Đầu ra: Session hoặc User đã xác thực cho route handler.
Ràng buộc: luôn đóng session và ghi request.state tối thiểu cho audit middleware.
"""

import uuid
from datetime import datetime, timezone

from fastapi import Depends, HTTPException, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from sqlalchemy import update, or_, select, text
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
    if payload["ver"] != user.token_version:
        raise HTTPException(status_code=401, detail="Phiên đăng nhập đã bị thu hồi")
    if not user.is_active:
        raise HTTPException(status_code=403, detail="Tài khoản đã bị khóa")

    session_id = payload.get("sid")
    if not session_id:
        raise HTTPException(401, "Vui lòng làm mới phiên đăng nhập")
    from app.chuc_nang.nguoi_dung.dang_nhap.luu_tru.refresh_token import RefreshToken
    try:
        family = uuid.UUID(session_id)
    except (ValueError, TypeError):
        raise HTTPException(401, "Phiên đăng nhập không hợp lệ") from None
    active_session = db.scalar(select(RefreshToken).where(
        RefreshToken.user_id == user.id, RefreshToken.family_id == family,
        RefreshToken.revoked_at.is_(None), RefreshToken.expires_at > datetime.now(timezone.utc)))
    if active_session is None:
        raise HTTPException(401, "Phiên đăng nhập đã bị thu hồi")
    request.state.session_family_id = family

    if user.must_change_password and request.url.path not in {
        "/api/v1/auth/me", "/api/v1/auth/first-time-password", "/api/v1/auth/logout"
    }:
        raise HTTPException(status_code=403, detail="Vui lòng thiết lập mật khẩu trước khi sử dụng hệ thống")

    # Gán user_id vào request.state để AuditMiddleware ghi nhật ký chính xác
    request.state.user_id = user.id

    now = datetime.now(timezone.utc)
    db.execute(update(RefreshToken).where(RefreshToken.id == active_session.id,
        or_(RefreshToken.last_used_at.is_(None), RefreshToken.last_used_at < now-timedelta(seconds=60)))
        .values(last_used_at=now).execution_options(synchronize_session=False))
    last=user.last_active_at
    if last is None or (now-last.replace(tzinfo=timezone.utc)).total_seconds()>60:
        db.execute(update(User).where(User.id==user.id,or_(User.last_active_at.is_(None),User.last_active_at<now-timedelta(seconds=60))).values(last_active_at=now).execution_options(synchronize_session=False))
    db.commit()

    return user


def lock_admin_write(request: Request, db: Session, current_user: User) -> User:
    """Revalidate a writer and retain authorization until its transaction ends.

    A short transaction-scoped gate serializes admin writes before actor/target
    row locks, avoiding reversed actor/target lock order between administrators.
    Read requests do not acquire this gate. No external service runs under it.
    """
    if request.method in {"GET", "HEAD", "OPTIONS"}:
        return current_user
    if db.get_bind().dialect.name == "mssql":
        result = db.execute(text(
            "DECLARE @r INT; EXEC @r=sys.sp_getapplock "
            "@Resource='capitalflow_admin_write', @LockMode='Exclusive', "
            "@LockOwner='Transaction', @LockTimeout=5000; SELECT @r;"
        )).scalar_one()
        if result < 0:
            raise HTTPException(503, "Thao tác quản trị đang bận. Vui lòng thử lại.")
    from app.chuc_nang.nguoi_dung.dang_nhap.nghiep_vu.session_management import locked_user
    if not getattr(request.state, "session_family_id", None):
        raise HTTPException(401, "Phiên đăng nhập đã bị thu hồi")
    return locked_user(db, current_user.id, current_user.token_version)


def require_admin(request: Request, current_user: User = Depends(get_current_user),
                  db: Session = Depends(get_db)) -> User:
    """Yêu cầu quyền quản trị viên và trả lỗi 403 nếu không đủ quyền."""
    current_user = lock_admin_write(request, db, current_user)
    if current_user.role != UserRole.ADMIN or current_user.support_only:
        raise HTTPException(status_code=403, detail="Yêu cầu quyền Admin")
    return current_user
