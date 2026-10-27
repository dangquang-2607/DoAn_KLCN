"""Email challenge bound to user, provider fixture and optional existing wallet."""
import hashlib
import secrets
from datetime import datetime
from uuid import UUID

from fastapi import HTTPException
from sqlalchemy import select

from app.chuc_nang.nguoi_dung.dang_nhap.luu_tru.dat_lai_mat_khau import PasswordResetOTP


def purpose_for(demo_id: str, account_id: UUID | None) -> str:
    binding = f"{demo_id}:{account_id or 'new'}"
    return "LINK_BANK:" + hashlib.sha256(binding.encode()).hexdigest()[:40]


def code_hash(challenge_id: UUID, code: str) -> str:
    return hashlib.sha256(f"{challenge_id}:{code}".encode()).hexdigest()


def consume_otp(db, user, challenge_id, code, demo_id, account_id=None):
    record = db.scalar(select(PasswordResetOTP).where(
        PasswordResetOTP.id == challenge_id,
        PasswordResetOTP.user_id == user.id,
        PasswordResetOTP.email == user.email,
        PasswordResetOTP.purpose == purpose_for(demo_id, account_id),
    ).with_hint(PasswordResetOTP, "WITH (UPDLOCK, ROWLOCK)", dialect_name="mssql"))
    if not record or record.is_used or record.expires_at <= datetime.utcnow() or record.failed_attempts >= 5:
        raise HTTPException(400, "Mã OTP không hợp lệ, đã dùng hoặc hết hạn. Vui lòng gửi lại mã.")
    if not code or not secrets.compare_digest(record.otp_code, code_hash(record.id, code)):
        record.failed_attempts += 1
        # Called before any wallet writes. Persist only failed-attempt accounting;
        # the outer idempotency wrapper then rolls back its now-empty transaction.
        db.commit()
        raise HTTPException(400, "Mã OTP không đúng. Tối đa 5 lần thử cho mỗi mã.")
    record.is_used = True
