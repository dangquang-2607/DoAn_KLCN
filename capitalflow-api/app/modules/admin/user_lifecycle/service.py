"""Điều phối chuyển trạng thái và pha CSDL bền vững khi quản trị viên xóa người dùng."""
from __future__ import annotations

import hashlib
import hmac
import json
import uuid
from datetime import datetime, timezone

from sqlalchemy import delete, func, or_, select, update
from sqlalchemy.orm import Session

from app.shared.config import settings
from app.shared.security.secrets import unseal
from app.modules.taichinh.persistence.account import Account
from app.modules.admin.persistence.audit_log import AuditLog
from app.modules.jobs.persistence.background_job import BackgroundJob
from app.modules.taichinh.persistence.budget import Budget
from app.modules.danhmuc.persistence.category import Category
from app.modules.email.persistence.email_log import EmailLog
from app.modules.taichinh.persistence.idempotency_record import IdempotencyRecord
from app.modules.hoadon.persistence.invoice import Invoice
from app.modules.hoadon.persistence.invoice_item import InvoiceItem
from app.modules.hoadon.persistence.ocr_job import OcrJob
from app.modules.dangnhap.persistence.password_reset import PasswordResetOTP
from app.modules.dangnhap.persistence.refresh_token import RefreshToken
from app.modules.email.persistence.system_setting import SystemSetting
from app.modules.taichinh.persistence.transaction import Transaction
from app.modules.dangnhap.persistence.user import User
from app.modules.admin.persistence.user_deletion import UserDeletionFile, UserDeletionRequest
from app.modules.jobs.queue import decode, enqueue, now


def email_fingerprint(email: str) -> str:
    """Tạo fingerprint có khóa để đối chiếu mà không lưu địa chỉ email dạng rõ."""
    return hmac.new(
        settings.job_encryption_key.encode(),
        email.strip().casefold().encode(),
        hashlib.sha256,
    ).hexdigest()


def deleted_email_alias(user_id: uuid.UUID) -> str:
    return f"deleted.{user_id.hex}@deleted.invalid"


def original_email(user: User, *, strict: bool = False) -> str:
    if user.email_before_delete_sealed:
        try:
            return unseal(user.email_before_delete_sealed)
        except Exception as exc:
            if strict:
                raise ValueError("Stored deletion email cannot be decrypted") from exc
    return user.email


def _job_targets_user(job: BackgroundJob, user_id: uuid.UUID, email: str) -> bool:
    if job.owner_user_id == user_id:
        return True
    if not job.payload:
        return False
    try:
        payload = decode(job)
    except Exception:
        return False
    if payload.get("function") == "send_account_deleted_email":
        args = payload.get("args") or []
        if len(args) > 2 and str(args[2]).lower() == "hard":
            return False
    if str(payload.get("user_id") or "") == str(user_id):
        return True
    # Dọn tương thích cho job được tạo trước khi cột owner_user_id tồn tại.
    return email.casefold() in json.dumps(payload, ensure_ascii=False).casefold()


def _cancel_and_scrub_jobs(
    db: Session,
    user_id: uuid.UUID,
    email: str,
    current_job_id: uuid.UUID,
) -> None:
    candidates = db.scalars(
        select(BackgroundJob).where(
            BackgroundJob.id != current_job_id,
            BackgroundJob.payload != "",
            or_(BackgroundJob.owner_user_id == user_id, BackgroundJob.owner_user_id.is_(None)),
        )
    ).all()
    for job in candidates:
        if not _job_targets_user(job, user_id, email):
            continue
        if job.status in {"PENDING", "RUNNING"}:
            job.status = "CANCELLED"
            job.lease_until = None
            job.lease_token = None
        job.payload = ""
        job.error_code = None


def purge_user_database(
    db: Session,
    request_id: uuid.UUID,
    current_job_id: uuid.UUID,
) -> str:
    """Purge một user theo thứ tự an toàn FK; bên gọi commit toàn bộ trong một transaction."""
    request = db.scalar(
        select(UserDeletionRequest)
        .where(UserDeletionRequest.id == request_id)
        .with_hint(UserDeletionRequest, "WITH (UPDLOCK, ROWLOCK)", dialect_name="mssql")
        .execution_options(populate_existing=True)
    )
    if not request:
        return "MISSING"
    if request.status in {"FILES_PENDING", "COMPLETE"}:
        return request.status
    if request.mode != "hard":
        raise ValueError("Only hard deletion requests can be purged")

    user = db.scalar(
        select(User)
        .where(User.id == request.target_user_id)
        .with_hint(User, "WITH (UPDLOCK, ROWLOCK)", dialect_name="mssql")
        .execution_options(populate_existing=True)
    )
    if not user:
        request.status = "FAILED"
        request.error_code = "TARGET_USER_MISSING"
        request.updated_at = now()
        return "FAILED"
    if user.deletion_status != "PURGE_PENDING":
        raise ValueError("User is not pending purge")

    request.status = "RUNNING"
    request.purge_checkpoint = "DB_PURGE"
    request.error_code = None
    request.updated_at = now()
    email = original_email(user, strict=True)
    user_id = user.id

    account_ids = select(Account.id).where(Account.user_id == user_id)
    category_ids = select(Category.id).where(Category.owner_user_id == user_id)
    invoice_ids = select(Invoice.id).where(Invoice.user_id == user_id)

    # Không thể gỡ an toàn tham chiếu account khác tenant và không nullable. Dừng lại
    # để lộ lỗi toàn vẹn thay vì vô tình xóa dữ liệu của người dùng khác.
    foreign_account_refs = db.scalar(
        select(func.count(Transaction.id)).where(
            Transaction.user_id != user_id,
            Transaction.account_id.in_(account_ids),
        )
    ) or 0
    foreign_budget_refs = db.scalar(
        select(func.count(Budget.id)).where(
            Budget.user_id != user_id,
            Budget.category_id.in_(category_ids),
        )
    ) or 0
    if foreign_account_refs or foreign_budget_refs:
        raise RuntimeError("CROSS_TENANT_REFERENCE")

    storage_keys = db.scalars(
        select(Invoice.storage_key)
        .where(Invoice.user_id == user_id, Invoice.storage_key.is_not(None))
        .distinct()
    ).all()
    file_rows = [
        UserDeletionFile(
            id=uuid.uuid4(),
            request_id=request.id,
            storage_key=key,
            status="PENDING",
            attempts=0,
        )
        for key in storage_keys
        if key
    ]
    db.add_all(file_rows)
    request.file_total = len(file_rows)

    _cancel_and_scrub_jobs(db, user_id, email, current_job_id)

    # Gỡ tham chiếu nullable bị sai tenant nhưng giữ nguyên bản ghi nghiệp vụ của tenant
    # còn lại. API đúng thiết kế không được phép tạo ra các tham chiếu này.
    db.execute(
        update(Invoice)
        .where(Invoice.user_id != user_id, Invoice.account_id.in_(account_ids))
        .values(account_id=None)
    )
    db.execute(
        update(Invoice)
        .where(Invoice.user_id != user_id, Invoice.category_id.in_(category_ids))
        .values(category_id=None)
    )
    db.execute(
        update(Transaction)
        .where(Transaction.user_id != user_id, Transaction.invoice_id.in_(invoice_ids))
        .values(invoice_id=None)
    )
    db.execute(
        update(Transaction)
        .where(Transaction.user_id != user_id, Transaction.category_id.in_(category_ids))
        .values(category_id=None)
    )

    # Thứ tự an toàn FK: xóa job/transaction tham chiếu trước invoice, sau đó mới đến
    # account/category cha. Gỡ self-reference trước khi xóa.
    db.execute(delete(Transaction).where(Transaction.user_id == user_id))
    db.execute(delete(OcrJob).where(OcrJob.user_id == user_id))
    db.execute(delete(InvoiceItem).where(InvoiceItem.invoice_id.in_(invoice_ids)))
    db.execute(delete(Invoice).where(Invoice.user_id == user_id))
    db.execute(delete(Budget).where(Budget.user_id == user_id))
    db.execute(delete(Account).where(Account.user_id == user_id))
    db.execute(delete(Category).where(Category.owner_user_id == user_id))

    db.execute(
        update(RefreshToken)
        .where(RefreshToken.parent_token_id.in_(select(RefreshToken.id).where(RefreshToken.user_id == user_id)))
        .values(parent_token_id=None)
    )
    db.execute(delete(RefreshToken).where(RefreshToken.user_id == user_id))
    db.execute(
        delete(PasswordResetOTP).where(
            or_(PasswordResetOTP.user_id == user_id, func.lower(PasswordResetOTP.email) == email.casefold())
        )
    )
    db.execute(delete(IdempotencyRecord).where(IdempotencyRecord.user_id == user_id))
    db.execute(update(SystemSetting).where(SystemSetting.updated_by == user_id).values(updated_by=None))

    # Giữ sự kiện audit nhưng xóa PII ở cấp request thuộc user bị xóa. Sự kiện quản trị
    # nhắm tới UUID vẫn được giữ làm dấu vết kiểm toán.
    db.execute(
        update(AuditLog)
        .where(AuditLog.user_id == user_id)
        .values(
            user_id=None,
            entity_id=None,
            request_id=None,
            ip_address=None,
            user_agent=None,
            old_values_json=None,
            new_values_json=None,
            metadata_json='{"anonymized":true}',
        )
    )
    db.execute(
        update(EmailLog)
        .where(or_(EmailLog.user_id == user_id, func.lower(EmailLog.recipient) == email.casefold()))
        .values(user_id=None, recipient="erased-user@redacted.invalid", error_message=None)
    )
    db.execute(
        update(UserDeletionRequest)
        .where(UserDeletionRequest.target_user_id == user_id, UserDeletionRequest.id != request.id)
        .values(target_email_sealed=None)
    )

    db.execute(delete(User).where(User.id == user_id))
    db.add(
        AuditLog(
            user_id=None,
            action="HARD_DELETE_USER_COMPLETE",
            entity_type="user",
            entity_id=user_id,
            metadata_json=json.dumps(
                {"request_id": str(request.id), "requested_by": str(request.requested_by)},
                ensure_ascii=False,
            ),
        )
    )

    request.target_email_sealed = None
    request.purge_checkpoint = "DB_PURGED"
    request.updated_at = now()
    if file_rows:
        request.status = "FILES_PENDING"
        enqueue(
            db,
            "USER_FILE_PURGE",
            {"request_id": str(request.id)},
            f"user-file-purge:{request.id}",
        )
    else:
        request.status = "COMPLETE"
        request.purge_checkpoint = "COMPLETE"
        request.completed_at = now()
    return request.status


def mark_purge_failed(db: Session, request_id: uuid.UUID, error_code: str) -> None:
    request = db.get(UserDeletionRequest, request_id)
    if request and request.status != "COMPLETE":
        request.status = "FAILED"
        request.error_code = error_code[:100]
        request.updated_at = datetime.now(timezone.utc).replace(tzinfo=None)
