"""
Các route đăng ký, đăng nhập, làm mới token, đăng xuất, hồ sơ và quên mật khẩu.
"""
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Request, BackgroundTasks
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.dung_chung.http.phu_thuoc import get_current_user, get_db
from app.dung_chung.http.gioi_han_tan_suat import limiter
from app.dung_chung.security.passwords import hash_password, verify_password
from app.dung_chung.security.tokens import create_access_token
from app.chuc_nang.nguoi_dung.dang_nhap.luu_tru.refresh_token import RefreshToken
from app.chuc_nang.nguoi_dung.dang_nhap.luu_tru.nguoi_dung import User
from app.dung_chung.email.dich_vu import EmailService
from app.dung_chung.tac_vu_nen.hang_doi import enqueue_email
from app.chuc_nang.nguoi_dung.dang_nhap.nghiep_vu.session_management import locked_user, revoke_sessions
from app.chuc_nang.nguoi_dung.dang_nhap.nghiep_vu.khoi_phuc_mat_khau import (
    deliver_reset_otp, issue_reset_otp, latest_reset_otp, reset_issue_block,
    select_locked_user as _otp_user, validate_reset_otp,
)
from app.chuc_nang.nguoi_dung.dang_nhap.nghiep_vu.tokens import create_refresh_token as _create_refresh_token
from app.chuc_nang.nguoi_dung.dang_nhap.nghiep_vu.tokens import hash_refresh_token as _hash_token
from app.chuc_nang.nguoi_dung.tai_chinh.thong_bao.dich_vu import emit_notification
from app.chuc_nang.nguoi_dung.tai_chinh.vi_tai_khoan.receiving import ensure_default_wallet
from app.chuc_nang.nguoi_dung.dang_nhap.schemas.auth import (
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
        raise HTTPException(status_code=409, detail="Email đã được sử dụng")

    user = User(
        email=payload.email,
        password_hash=hash_password(payload.password),
        full_name=payload.full_name,
    )
    try:
        with db.begin_nested():
            db.add(user)
            db.flush()
    except IntegrityError as exc:
        # The unique indexes arbitrate concurrent registrations, after the friendly precheck.
        if 'UX_users_email' not in str(exc.orig):
            raise
        raise HTTPException(status_code=409, detail="Email đã được sử dụng") from None
    db.refresh(user)
    ensure_default_wallet(db, user)

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

    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Email hoặc mật khẩu không đúng")

    if not user.is_active:
        raise HTTPException(status_code=403, detail="Tài khoản của bạn đã bị khóa bởi Quản trị viên. Vui lòng liên hệ hỗ trợ để được mở khóa.")

    ensure_default_wallet(db, user)
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
    access_token = create_access_token(str(user.id), str(role_val).lower(), user.token_version, str(family_id))

    must_change = bool(getattr(user, "must_change_password", False))
    # Login bypasses get_current_user; attach the authenticated actor for audit.
    request.state.user_id = user.id
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
def forgot_password(request: Request, payload: ForgotPasswordRequest, db: Session = Depends(get_db)):
    user = _otp_user(db, payload.email)
    if not user:
        raise HTTPException(status_code=404, detail="Email không tồn tại")
    if not user.is_active:
        return {"success": True, "message": "Nếu email tồn tại trên hệ thống, mã xác thực OTP sẽ được gửi về hộp thư của bạn."}

    now = datetime.now(timezone.utc)
    latest = latest_reset_otp(db, user.id)
    if not reset_issue_block(db, user.id, latest, now):
        email, name, user_id = user.email, user.full_name, user.id
        code = issue_reset_otp(db, user, latest, now)
        db.commit()
        deliver_reset_otp(email, name, user_id, code)

    return {"success": True, "message": "Nếu email tồn tại trên hệ thống, mã xác thực OTP sẽ được gửi về hộp thư của bạn."}


@router.post(
    "/verify-otp",
    summary="Kiểm tra tính hợp lệ của mã OTP (Verify OTP)",
    description="Kiểm tra mã OTP nhập vào có đúng và còn hiệu lực hay không.",
)
@limiter.limit("5/minute")
def verify_otp(request: Request, payload: VerifyOTPRequest, db: Session = Depends(get_db)):
    validate_reset_otp(db, payload.email, payload.otp_code, "Mã OTP đã hết hạn (chỉ có hiệu lực trong 10 phút). Vui lòng yêu cầu mã mới.")
    return {"valid": True, "message": "Mã OTP hợp lệ"}


@router.post(
    "/reset-password",
    summary="Đặt lại mật khẩu mới (Reset Password)",
    description="Xác thực OTP và cập nhật mật khẩu mới cho tài khoản người dùng.",
)
@limiter.limit("5/minute")
def reset_password(request: Request, payload: ResetPasswordRequest, db: Session = Depends(get_db)):
    user, latest_otp = validate_reset_otp(db, payload.email, payload.otp_code, "Mã OTP đã hết hạn. Vui lòng yêu cầu mã mới.")

    user.password_hash = hash_password(payload.new_password)
    user.must_change_password = False
    revoke_sessions(db, user, "password_reset")
    latest_otp.is_used = True
    emit_notification(db, user_id=user.id, kind="SECURITY", title="Mật khẩu đã được đặt lại",
                      message="Mật khẩu tài khoản vừa được đặt lại bằng mã xác thực. Nếu không phải bạn, hãy liên hệ hỗ trợ.",
                      severity="WARNING", source_type="USER", source_id=user.id, action_url="/settings")
    db.commit()

    return {"success": True, "message": "Đặt lại mật khẩu thành công! Bạn có thể đăng nhập ngay bằng mật khẩu mới."}


@router.post(
    "/refresh",
    response_model=AccessTokenResponse,
    summary="Làm mới Access Token (Refresh Token)",
    description="Đổi Refresh Token lấy Access Token mới (cơ chế Family Rotation).",
)
def refresh_token(request: Request, payload: RefreshRequest, db: Session = Depends(get_db)):
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
    new_access = create_access_token(str(user.id), str(role_val).lower(), user.token_version, str(rt.family_id))

    # Attribute only a successful rotation, never an unverified token payload.
    request.state.user_id = user.id
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
        # Same lock/order as refresh: whichever commits first, the whole session
        # family is closed, including a successor of the token sent by the client.
        user = db.scalar(select(User).where(User.id == rt.user_id).with_hint(
            User, "WITH (UPDLOCK, ROWLOCK)", dialect_name="mssql"
        ).execution_options(populate_existing=True))
        db.query(RefreshToken).filter(
            RefreshToken.user_id == rt.user_id,
            RefreshToken.family_id == rt.family_id,
            RefreshToken.revoked_at.is_(None),
        ).update({"revoked_at": now, "revocation_reason": "logout"})
        if user:
            user.last_active_at = None
        db.commit()


@router.get(
    "/sessions",
    summary="Danh sách phiên đăng nhập (List Sessions)",
    description="Lấy danh sách các phiên đăng nhập đang hoạt động của người dùng hiện tại.",
)
def list_sessions(
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    now = datetime.now(timezone.utc)
    sessions = db.scalars(select(RefreshToken).where(
        RefreshToken.user_id == current_user.id, RefreshToken.revoked_at.is_(None),
        RefreshToken.expires_at > now).order_by(RefreshToken.created_at.desc())).all()
    from sqlalchemy import func
    starts = {family_id: created_at for family_id, created_at in db.execute(
        select(RefreshToken.family_id, func.min(RefreshToken.created_at))
        .where(RefreshToken.user_id == current_user.id).group_by(RefreshToken.family_id)).all()}
    family = getattr(request.state, "session_family_id", None)
    def utc(value):
        return value.replace(tzinfo=timezone.utc) if value and value.tzinfo is None else value
    def device(s):
        raw = s.user_agent or s.device_name or ""
        browser = next((name for pattern, name in [("Edg/", "Edge"), ("OPR/", "Opera"),
            ("Firefox/", "Firefox"), ("Chrome/", "Chrome"), ("Safari/", "Safari")] if pattern in raw), "Trình duyệt")
        system = next((name for pattern, name in [("Android", "Android"), ("iPhone", "iOS"),
            ("iPad", "iPadOS"), ("Windows", "Windows"), ("Mac", "macOS"), ("Linux", "Linux")] if pattern in raw), "Thiết bị chưa xác định")
        return f"{browser} · {system}" if s.user_agent else s.device_name or system
    return [{"id": str(s.family_id), "is_current": s.family_id == family,
        "device_name": device(s), "ip_address": s.ip_address,
        "created_at": utc(starts.get(s.family_id, s.created_at)), "expires_at": utc(s.expires_at),
        "last_used_at": utc(s.last_used_at or s.created_at)} for s in sessions]


@router.delete("/sessions/others", summary="Thu hồi các phiên khác")
def revoke_other_sessions(request: Request, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    locked_user(db, user.id, user.token_version)
    family = getattr(request.state, "session_family_id", None)
    if not family:
        raise HTTPException(409, "Hãy đăng nhập lại để xác định phiên hiện tại")
    db.query(RefreshToken).filter(RefreshToken.user_id == user.id, RefreshToken.family_id != family,
        RefreshToken.revoked_at.is_(None)).update({"revoked_at": datetime.now(timezone.utc), "revocation_reason": "user_revoked"})
    db.commit()
    return {"success": True}


@router.delete("/sessions/{family_id}", summary="Thu hồi một phiên khác")
def revoke_session(family_id: uuid.UUID, request: Request, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    locked_user(db, user.id, user.token_version)
    if family_id == getattr(request.state, "session_family_id", None):
        raise HTTPException(409, "Dùng nút Đăng xuất để kết thúc phiên hiện tại")
    target = db.scalar(select(RefreshToken).where(RefreshToken.user_id == user.id,
        RefreshToken.family_id == family_id))
    if target is None:
        raise HTTPException(404, "Không tìm thấy phiên của bạn")
    db.query(RefreshToken).filter(RefreshToken.user_id == user.id, RefreshToken.family_id == family_id,
        RefreshToken.revoked_at.is_(None)).update({"revoked_at": datetime.now(timezone.utc), "revocation_reason": "user_revoked"})
    db.commit()
    return {"success": True}


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
        "is_system_account": current_user.is_system_account,
        "support_only": current_user.support_only,
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
    if not current_user.must_change_password:
        raise HTTPException(status_code=403, detail="Tài khoản không ở bước thiết lập mật khẩu lần đầu")
    current_user.password_hash = hash_password(payload.new_password)
    current_user.must_change_password = False
    revoke_sessions(db, current_user, "password_changed")
    emit_notification(db, user_id=current_user.id, kind="SECURITY", title="Đã thiết lập mật khẩu",
                      message="Mật khẩu cá nhân đã được thiết lập thành công.",
                      source_type="USER", source_id=current_user.id, action_url="/settings")
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

    current_user.password_hash = hash_password(payload.new_password)
    current_user.must_change_password = False
    revoke_sessions(db, current_user, "password_changed")
    emit_notification(db, user_id=current_user.id, kind="SECURITY", title="Mật khẩu đã thay đổi",
                      message="Mật khẩu tài khoản vừa được thay đổi. Nếu không phải bạn, hãy liên hệ hỗ trợ.",
                      severity="WARNING", source_type="USER", source_id=current_user.id, action_url="/settings")
    db.commit()

    return {
        "success": True,
        "message": "Đổi mật khẩu thành công!",
    }
