"""
Các route đăng ký, đăng nhập, làm mới token, đăng xuất, hồ sơ và quên mật khẩu.
"""
import hmac
import secrets
import uuid
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Request, BackgroundTasks
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.shared.http.dependencies import get_current_user, get_db
from app.shared.http.rate_limit import limiter
from app.shared.security.passwords import hash_password, verify_password
from app.shared.security.tokens import create_access_token
from app.modules.dangnhap.persistence.refresh_token import RefreshToken
from app.modules.dangnhap.persistence.user import User, UserRole
from app.modules.dangnhap.persistence.password_reset import PasswordResetOTP
from app.modules.email.service import EmailService
from app.modules.jobs.queue import enqueue_email
from app.modules.dangnhap.application.session_management import locked_user, revoke_sessions
from app.modules.dangnhap.application.password_recovery import otp_digest as _otp_digest
from app.modules.dangnhap.application.password_recovery import select_locked_user as _otp_user
from app.modules.dangnhap.application.tokens import create_refresh_token as _create_refresh_token
from app.modules.dangnhap.application.tokens import hash_refresh_token as _hash_token
from app.modules.dangnhap.schemas.auth import (
    AccessTokenResponse,
    LoginRequest,
    RefreshRequest,
    RegisterRequest,
    TokenResponse,
    ForgotPasswordRequest,
    VerifyOTPRequest,
    ResetPasswordRequest,
    FirstTimePasswordRequest,
    ChangePasswordRequest,
)

router = APIRouter(prefix="/auth", tags=["Auth"])


# ── Các endpoint ─────────────────────────────────────────────────────────────

@router.post(
    "/register",
    status_code=201,
    summary="Đăng ký tài khoản (Register)",
    description="Đăng ký tài khoản người dùng mới và tự động gửi email chào mừng.",
)
@limiter.limit("5/minute;20/hour")
def register(request: Request, payload: RegisterRequest, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    existing = db.scalar(select(User).where(User.email == payload.email))
    if existing:
        raise HTTPException(status_code=400, detail="Email đã được sử dụng")

    user = User(
        email=payload.email,
        password_hash=hash_password(payload.password),
        full_name=payload.full_name,
    )
    db.add(user)
    db.flush()
    db.refresh(user)

    enqueue_email(db,
        EmailService.send_welcome_email,
        user.email,
        user.full_name or "Quý khách",
        owner_user_id=user.id,
    )
    db.commit()

    return {"id": user.id, "email": user.email, "full_name": user.full_name}


@router.post(
    "/login",
    response_model=TokenResponse,
    summary="Đăng nhập (Login)",
    description="Đăng nhập hệ thống, trả về JWT Access Token và Refresh Token.",
)
@limiter.limit("10/minute")
def login(request: Request, payload: LoginRequest, db: Session = Depends(get_db)):
    user = db.scalar(select(User).where(User.email == payload.email))

    if not user:
        raise HTTPException(status_code=401, detail="Email hoặc mật khẩu không đúng")

    if user.is_deleted:
        raise HTTPException(status_code=403, detail="Tài khoản đã bị xóa hoặc đang chờ xóa vĩnh viễn")

    if not user.is_active:
        raise HTTPException(status_code=403, detail="Tài khoản của bạn đã bị khóa bởi Quản trị viên. Vui lòng liên hệ hỗ trợ để được mở khóa.")

    if not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Email hoặc mật khẩu không đúng")

    now = datetime.now(timezone.utc)
    user.last_login_at = now
    user.last_active_at = now

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
    access_token = create_access_token(str(user.id), str(role_val).lower(), user.token_version)

    must_change = bool(getattr(user, "must_change_password", False))
    return TokenResponse(
        access_token=access_token,
        refresh_token=raw_refresh,
        must_change_password=must_change,
    )


@router.post(
    "/forgot-password",
    summary="Yêu cầu OTP Quên Mật Khẩu (Forgot Password OTP)",
    description="Gửi mã OTP 6 số về email để xác thực và đặt lại mật khẩu (hiệu lực 10 phút).",
)
@limiter.limit("5/minute")
def forgot_password(request: Request, payload: ForgotPasswordRequest, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    user = _otp_user(db, payload.email)
    if not user or user.is_deleted or not user.is_active:
        return {"success": True, "message": "Nếu email tồn tại trên hệ thống, mã xác thực OTP sẽ được gửi về hộp thư của bạn."}

    recent = db.scalar(select(PasswordResetOTP).where(PasswordResetOTP.user_id==user.id).order_by(PasswordResetOTP.created_at.desc()))
    if recent and (datetime.now(timezone.utc) - recent.created_at.replace(tzinfo=timezone.utc)).total_seconds()<60:
        return {"success":True,"message":"Nếu email tồn tại trên hệ thống, mã xác thực OTP sẽ được gửi về hộp thư của bạn."}

    # Vô hiệu hóa các OTP cũ
    db.query(PasswordResetOTP).filter(
        PasswordResetOTP.email == payload.email,
        PasswordResetOTP.is_used == False
    ).update({"is_used": True})

    # Sinh mã OTP 6 số
    otp_code = str(secrets.randbelow(900000) + 100000)
    expires = datetime.now(timezone.utc) + timedelta(minutes=10)

    reset_record = PasswordResetOTP(
        id=uuid.uuid4(),
        user_id=user.id,
        email=payload.email,
        otp_code=_otp_digest(payload.email, otp_code),
        expires_at=expires,
        is_used=False,
        created_at=datetime.now(timezone.utc),
    )
    db.add(reset_record)
    db.flush()

    enqueue_email(db,
        EmailService.send_password_reset_otp,
        user.email,
        user.full_name or "Quý khách",
        otp_code,
        user_id=user.id,
        owner_user_id=user.id,
    )
    db.commit()

    return {"success": True, "message": "Nếu email tồn tại trên hệ thống, mã xác thực OTP sẽ được gửi về hộp thư của bạn."}


@router.post(
    "/verify-otp",
    summary="Kiểm tra tính hợp lệ của mã OTP (Verify OTP)",
    description="Kiểm tra mã OTP nhập vào có đúng và còn hiệu lực hay không.",
)
@limiter.limit("5/minute")
def verify_otp(request: Request, payload: VerifyOTPRequest, db: Session = Depends(get_db)):
    user = _otp_user(db, payload.email)
    if not user or not user.is_active:
        raise HTTPException(status_code=400, detail="Mã OTP không hợp lệ")
    now = datetime.now(timezone.utc)

    # Tìm OTP mới nhất chưa sử dụng theo email (không lọc theo otp_code để đếm lần sai)
    latest_otp = db.scalar(
        select(PasswordResetOTP).where(
            PasswordResetOTP.email == payload.email,
            PasswordResetOTP.is_used == False,
        ).order_by(PasswordResetOTP.created_at.desc())
    )

    if not latest_otp:
        raise HTTPException(status_code=400, detail="Mã OTP không chính xác hoặc đã được sử dụng")

    # Kiểm tra hết hạn
    exp = latest_otp.expires_at.replace(tzinfo=timezone.utc) if latest_otp.expires_at.tzinfo is None else latest_otp.expires_at
    if exp < now:
        raise HTTPException(status_code=400, detail="Mã OTP đã hết hạn (chỉ có hiệu lực trong 10 phút). Vui lòng yêu cầu mã mới.")

    # Kiểm tra mã OTP có khớp không
    if not hmac.compare_digest(latest_otp.otp_code, _otp_digest(payload.email, payload.otp_code)):
        latest_otp.failed_attempts += 1
        if latest_otp.failed_attempts >= 5:
            latest_otp.is_used = True  # Vô hiệu hóa OTP sau 5 lần sai
            db.commit()
            raise HTTPException(
                status_code=400,
                detail="Mã OTP đã bị vô hiệu hóa do nhập sai quá 5 lần. Vui lòng yêu cầu gửi lại mã mới."
            )
        db.commit()
        remaining = 5 - latest_otp.failed_attempts
        raise HTTPException(
            status_code=400,
            detail=f"Mã OTP không chính xác. Bạn còn {remaining} lần thử."
        )

    return {"valid": True, "message": "Mã OTP hợp lệ"}


@router.post(
    "/reset-password",
    summary="Đặt lại mật khẩu mới (Reset Password)",
    description="Xác thực OTP và cập nhật mật khẩu mới cho tài khoản người dùng.",
)
@limiter.limit("5/minute")
def reset_password(request: Request, payload: ResetPasswordRequest, db: Session = Depends(get_db)):
    user = _otp_user(db, payload.email)
    if not user or not user.is_active:
        raise HTTPException(status_code=400, detail="Mã OTP không hợp lệ")
    now = datetime.now(timezone.utc)

    # Tìm OTP mới nhất chưa sử dụng theo email (không lọc theo otp_code để đếm lần sai)
    latest_otp = db.scalar(
        select(PasswordResetOTP).where(
            PasswordResetOTP.email == payload.email,
            PasswordResetOTP.is_used == False,
        ).order_by(PasswordResetOTP.created_at.desc())
    )

    if not latest_otp:
        raise HTTPException(status_code=400, detail="Mã OTP không chính xác hoặc đã được sử dụng")

    # Kiểm tra hết hạn
    exp = latest_otp.expires_at.replace(tzinfo=timezone.utc) if latest_otp.expires_at.tzinfo is None else latest_otp.expires_at
    if exp < now:
        raise HTTPException(status_code=400, detail="Mã OTP đã hết hạn. Vui lòng yêu cầu mã mới.")

    # Kiểm tra mã OTP có khớp không
    if not hmac.compare_digest(latest_otp.otp_code, _otp_digest(payload.email, payload.otp_code)):
        latest_otp.failed_attempts += 1
        if latest_otp.failed_attempts >= 5:
            latest_otp.is_used = True  # Vô hiệu hóa OTP sau 5 lần sai
            db.commit()
            raise HTTPException(
                status_code=400,
                detail="Mã OTP đã bị vô hiệu hóa do nhập sai quá 5 lần. Vui lòng yêu cầu gửi lại mã mới."
            )
        db.commit()
        remaining = 5 - latest_otp.failed_attempts
        raise HTTPException(
            status_code=400,
            detail=f"Mã OTP không chính xác. Bạn còn {remaining} lần thử."
        )

    if not user:
        raise HTTPException(status_code=404, detail="Không tìm thấy tài khoản người dùng")

    user.password_hash = hash_password(payload.new_password)
    user.must_change_password = False
    revoke_sessions(db, user, "password_reset")
    latest_otp.is_used = True
    db.commit()

    return {"success": True, "message": "Đặt lại mật khẩu thành công! Bạn có thể đăng nhập ngay bằng mật khẩu mới."}


@router.post(
    "/refresh",
    response_model=AccessTokenResponse,
    summary="Làm mới Access Token (Refresh Token)",
    description="Đổi Refresh Token lấy Access Token mới (cơ chế Family Rotation).",
)
def refresh_token(payload: RefreshRequest, db: Session = Depends(get_db)):
    token_hash = _hash_token(payload.refresh_token)
    now = datetime.now(timezone.utc)

    rt = db.scalar(select(RefreshToken).where(RefreshToken.token_hash == token_hash))

    if not rt:
        raise HTTPException(status_code=401, detail="Refresh token không hợp lệ")

    # Tuần tự hóa refresh với thao tác khóa/mở khóa và refresh đồng thời của cùng user.
    user = db.scalar(select(User).where(User.id == rt.user_id).with_hint(
        User, "WITH (UPDLOCK, ROWLOCK)", dialect_name="mssql"
    ).execution_options(populate_existing=True))
    rt = db.scalar(select(RefreshToken).where(RefreshToken.id == rt.id).with_hint(
        RefreshToken, "WITH (UPDLOCK, ROWLOCK)", dialect_name="mssql"
    ).execution_options(populate_existing=True))
    if rt is None:
        raise HTTPException(status_code=401, detail="Refresh token không hợp lệ")

    if rt.revoked_at is not None:
        db.query(RefreshToken).filter(RefreshToken.family_id == rt.family_id).update(
            {"revoked_at": now, "revocation_reason": "reuse_attack"}
        )
        db.commit()
        raise HTTPException(status_code=401, detail="Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.")

    if rt.expires_at.replace(tzinfo=timezone.utc) < now:
        raise HTTPException(status_code=401, detail="Refresh token đã hết hạn")

    if not user or not user.is_active:
        raise HTTPException(status_code=403, detail="Tài khoản không hợp lệ hoặc đã bị khóa")

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
    new_access = create_access_token(str(user.id), str(role_val).lower(), user.token_version)

    return AccessTokenResponse(access_token=new_access, refresh_token=raw_new)


@router.post(
    "/logout",
    status_code=204,
    summary="Đăng xuất (Logout)",
    description="Đăng xuất tài khoản và thu hồi hiệu lực của Refresh Token hiện tại.",
)
def logout(payload: RefreshRequest, db: Session = Depends(get_db)):
    token_hash = _hash_token(payload.refresh_token)
    now = datetime.now(timezone.utc)

    rt = db.scalar(select(RefreshToken).where(RefreshToken.token_hash == token_hash))
    if rt:
        if rt.revoked_at is None:
            rt.revoked_at = now
            rt.revocation_reason = "logout"
        user = db.get(User, rt.user_id)
        if user:
            user.last_active_at = None
        db.commit()


@router.get(
    "/sessions",
    summary="Danh sách phiên đăng nhập (List Sessions)",
    description="Lấy danh sách các phiên đăng nhập đang hoạt động của người dùng hiện tại.",
)
def list_sessions(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
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


@router.get(
    "/me",
    summary="Thông tin người dùng hiện tại (Get Current User Profile)",
    description="Lấy thông tin tài khoản người dùng đang đăng nhập dựa trên Access Token (JWT).",
)
def me(current_user: User = Depends(get_current_user)):
    def _iso_utc(dt):
        if not dt:
            return None
        s = dt.isoformat()
        return s if s.endswith("Z") or "+" in s else s + "Z"

    return {
        "id": str(current_user.id),
        "email": current_user.email,
        "full_name": current_user.full_name,
        "role": current_user.role.lower() if isinstance(current_user.role, str) else current_user.role.value.lower(),
        "is_active": current_user.is_active,
        "must_change_password": bool(getattr(current_user, "must_change_password", False)),
        "created_at": _iso_utc(current_user.created_at),
        "last_login_at": _iso_utc(current_user.last_login_at),
        "last_active_at": _iso_utc(current_user.last_active_at),
    }


@router.post(
    "/first-time-password",
    summary="Thiết lập mật khẩu lần đầu (First-time Password Setup)",
    description="Dành cho người dùng đăng nhập bằng mật khẩu tạm thời cần đổi sang mật khẩu chính thức.",
)
def set_first_time_password(
    payload: FirstTimePasswordRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    current_user = locked_user(db, current_user.id, current_user.token_version)
    if len(payload.new_password.strip()) < 6:
        raise HTTPException(status_code=400, detail="Mật khẩu mới phải có ít nhất 6 ký tự.")

    if not current_user.must_change_password:
        raise HTTPException(status_code=403, detail="Tài khoản không ở bước thiết lập mật khẩu lần đầu")
    current_user.password_hash = hash_password(payload.new_password)
    current_user.must_change_password = False
    revoke_sessions(db, current_user, "password_changed")
    db.commit()

    return {
        "success": True,
        "message": "Đã thiết lập mật khẩu mới thành công! Bạn có thể bắt đầu sử dụng hệ thống.",
    }


@router.post(
    "/change-password",
    summary="Đổi mật khẩu người dùng (Change Password)",
    description="Người dùng đổi mật khẩu cá nhân bằng cách xác thực mật khẩu hiện tại.",
)
def change_password(
    payload: ChangePasswordRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    current_user = locked_user(db, current_user.id, current_user.token_version)
    if not verify_password(payload.current_password, current_user.password_hash):
        raise HTTPException(status_code=400, detail="Mật khẩu hiện tại không chính xác.")

    if len(payload.new_password.strip()) < 6:
        raise HTTPException(status_code=400, detail="Mật khẩu mới phải có ít nhất 6 ký tự.")

    current_user.password_hash = hash_password(payload.new_password)
    current_user.must_change_password = False
    revoke_sessions(db, current_user, "password_changed")
    db.commit()

    return {
        "success": True,
        "message": "Đổi mật khẩu thành công!",
    }
