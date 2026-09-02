"""
Auth routes — đăng ký, đăng nhập, refresh token, logout, me.
Refresh Token dùng family rotation: mỗi lần refresh tạo token mới + revoke token cũ.
"""
import hashlib
import uuid
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.dependencies import get_current_user, get_db
from app.core.config import settings
from app.core.limiter import limiter
from app.core.security import create_access_token, hash_password, verify_password
from app.models.refresh_token import RefreshToken
from app.models.user import User, UserRole
from app.schemas.auth import (
    AccessTokenResponse,
    LoginRequest,
    RefreshRequest,
    RegisterRequest,
    TokenResponse,
)

router = APIRouter(prefix="/auth", tags=["Auth"])


# ── Helpers ──────────────────────────────────────────────────────────────────

def _hash_token(raw: str) -> str:
    """SHA-256 hash của refresh token trước khi lưu DB."""
    return hashlib.sha256(raw.encode()).hexdigest()


def _create_refresh_token(
    db: Session,
    user_id: uuid.UUID,
    family_id: uuid.UUID,
    parent_token_id: uuid.UUID | None = None,
    device_name: str | None = None,
    ip_address: str | None = None,
    user_agent: str | None = None,
) -> tuple[str, uuid.UUID]:
    """Tạo refresh token, lưu vào DB, trả về (raw_token, token_id)."""
    raw = str(uuid.uuid4())
    token_id = uuid.uuid4()
    expires = datetime.now(timezone.utc) + timedelta(days=settings.refresh_token_expire_days)
    rt = RefreshToken(
        id=token_id,
        user_id=user_id,
        token_hash=_hash_token(raw),
        family_id=family_id,
        parent_token_id=parent_token_id,
        expires_at=expires,
        device_name=(device_name or "")[:150] or None,
        ip_address=(ip_address or "")[:45] or None,
        user_agent=(user_agent or "")[:1000] or None,
    )
    db.add(rt)
    return raw, token_id


# ── Endpoints ────────────────────────────────────────────────────────────────

@router.post("/register", status_code=201)
def register(payload: RegisterRequest, db: Session = Depends(get_db)):
    """Đăng ký tài khoản mới."""
    existing = db.scalar(select(User).where(User.email == payload.email))
    if existing:
        raise HTTPException(status_code=400, detail="Email đã được sử dụng")

    user = User(
        email=payload.email,
        password_hash=hash_password(payload.password),
        full_name=payload.full_name,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return {"id": user.id, "email": user.email, "full_name": user.full_name}


@router.post("/login", response_model=TokenResponse)
@limiter.limit("10/minute")  # Rate limit: tối đa 10 lần đăng nhập/phút/IP
def login(request: Request, payload: LoginRequest, db: Session = Depends(get_db)):
    """Đăng nhập → trả JWT access token + refresh token. Tự động tracking thiết bị."""
    user = db.scalar(select(User).where(User.email == payload.email))

    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Email hoặc mật khẩu không đúng")

    if not user.is_active:
        raise HTTPException(status_code=403, detail="Tài khoản đã bị khóa")

    user.last_login_at = datetime.now(timezone.utc)

    family_id = uuid.uuid4()
    device_name = request.headers.get("x-device-name") or request.headers.get("user-agent", "")[:50]
    ip_address = (request.headers.get("x-forwarded-for") or (request.client.host if request.client else ""))
    raw_refresh, _ = _create_refresh_token(
        db, user.id, family_id,
        device_name=device_name,
        ip_address=ip_address,
        user_agent=request.headers.get("user-agent"),
    )
    db.commit()

    role_val = user.role.value if hasattr(user.role, "value") else user.role
    access_token = create_access_token(str(user.id), str(role_val).lower())

    return TokenResponse(access_token=access_token, refresh_token=raw_refresh)


@router.post("/refresh", response_model=AccessTokenResponse)
def refresh_token(payload: RefreshRequest, db: Session = Depends(get_db)):
    """
    Đổi refresh token → access token mới + refresh token mới (Family Rotation).
    Nếu token đã bị revoke → revoke toàn bộ family (chống Replay Attack).
    """
    token_hash = _hash_token(payload.refresh_token)
    now = datetime.now(timezone.utc)

    rt = db.scalar(select(RefreshToken).where(RefreshToken.token_hash == token_hash))

    if not rt:
        raise HTTPException(status_code=401, detail="Refresh token không hợp lệ")

    if rt.revoked_at is not None:
        # Phát hiện Replay Attack → revoke toàn bộ family
        db.query(RefreshToken).filter(RefreshToken.family_id == rt.family_id).update(
            {"revoked_at": now, "revocation_reason": "reuse_attack"}
        )
        db.commit()
        raise HTTPException(status_code=401, detail="Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.")

    if rt.expires_at.replace(tzinfo=timezone.utc) < now:
        raise HTTPException(status_code=401, detail="Refresh token đã hết hạn")

    user = db.get(User, rt.user_id)
    if not user or not user.is_active:
        raise HTTPException(status_code=403, detail="Tài khoản không hợp lệ hoặc đã bị khóa")

    # Revoke token cũ, kế thừa thông tin thiết bị
    rt.revoked_at = now
    rt.revocation_reason = "rotated"
    rt.last_used_at = now

    raw_new, _ = _create_refresh_token(
        db, user.id, rt.family_id,
        parent_token_id=rt.id,
        device_name=rt.device_name,
        ip_address=rt.ip_address,
        user_agent=rt.user_agent,
    )
    db.commit()

    role_val = user.role.value if hasattr(user.role, "value") else user.role
    new_access = create_access_token(str(user.id), str(role_val).lower())

    return AccessTokenResponse(access_token=new_access)


@router.post("/logout", status_code=204)
def logout(payload: RefreshRequest, db: Session = Depends(get_db)):
    """Đăng xuất: revoke refresh token. Idempotent — không lỗi nếu token không tồn tại."""
    token_hash = _hash_token(payload.refresh_token)
    now = datetime.now(timezone.utc)

    rt = db.scalar(select(RefreshToken).where(RefreshToken.token_hash == token_hash))
    if rt and rt.revoked_at is None:
        rt.revoked_at = now
        rt.revocation_reason = "logout"
        db.commit()


@router.get("/sessions")
def list_sessions(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Lấy danh sách phiên đăng nhập đang hoạt động của user (chưa bị revoke và chưa hết hạn)."""
    from datetime import timezone as tz
    now = datetime.now(timezone.utc)
    sessions = db.scalars(
        select(RefreshToken).where(
            RefreshToken.user_id == current_user.id,
            RefreshToken.revoked_at.is_(None),
            RefreshToken.expires_at > now,
        ).order_by(RefreshToken.created_at.desc())
    ).all()
    return [
        {
            "id": str(s.id),
            "device_name": s.device_name,
            "ip_address": s.ip_address,
            "created_at": s.created_at,
            "expires_at": s.expires_at,
            "last_used_at": s.last_used_at,
        }
        for s in sessions
    ]


@router.get("/me")
def me(current_user: User = Depends(get_current_user)):
    """Trả thông tin user đang đăng nhập từ JWT. Frontend không cần đoán user_id."""
    return {
        "id": current_user.id,
        "email": current_user.email,
        "full_name": current_user.full_name,
        "role": current_user.role.lower() if isinstance(current_user.role, str) else current_user.role.value.lower(),
        "is_active": current_user.is_active,
        "created_at": current_user.created_at,
        "last_login_at": current_user.last_login_at,
    }
