"""
API quản lý vòng đời xóa tài khoản người dùng.
Hỗ trợ xóa mềm, xóa cứng, khôi phục và thử lại việc dọn dữ liệu/tệp.
Tiền tố đường dẫn: /admin/users/{id}, /admin/user-deletions/*
"""
import uuid
from datetime import datetime, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Response
from fastapi import status as http_status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.dung_chung.http.phu_thuoc import get_db, require_admin
from app.dung_chung.security.secrets import seal
from app.chuc_nang.nguoi_dung.dang_nhap.luu_tru.nguoi_dung import User
from app.chuc_nang.quan_tri.nguoi_dung.luu_tru.xoa_nguoi_dung import UserDeletionFile, UserDeletionRequest
from app.dung_chung.email.dich_vu import EmailService
from app.dung_chung.tac_vu_nen.hang_doi import enqueue, enqueue_email
from app.chuc_nang.quan_tri.nguoi_dung.vong_doi.dich_vu import deleted_email_alias, email_fingerprint, original_email

from app.chuc_nang.quan_tri.dung_chung.tien_ich import (
    BulkDeleteRequest,
    RestoreUserRequest,
    UserDeleteRequest,
    _deletion_request_out,
    _ensure_not_deleted,
    _is_protected_account,
    _iso_utc,
    _locked_user,
    _revoke_user_sessions,
    _user_out,
    _validate_deletion_target,
    _write_audit,
)

router = APIRouter()


def _apply_soft_delete(
    db: Session,
    target: User,
    admin: User,
    reason: str,
    release_email: bool,
) -> UserDeletionRequest:
    _validate_deletion_target(target, admin)
    if target.is_deleted:
        raise HTTPException(status_code=409, detail="Tài khoản đã ở trạng thái xóa")
    timestamp = datetime.now(timezone.utc)
    email = target.email
    target.pre_delete_is_active = target.is_active
    target.email_before_delete_sealed = seal(email)
    target.email = deleted_email_alias(target.id) if release_email else email
    target.is_active = False
    target.is_deleted = True
    target.deletion_status = "SOFT_DELETED"
    target.deleted_at = timestamp
    target.deleted_by = admin.id
    _revoke_user_sessions(db, target, "admin_soft_delete")

    request = UserDeletionRequest(
        id=uuid.uuid4(),
        target_user_id=target.id,
        requested_by=admin.id,
        mode="soft",
        status="SOFT_DELETED",
        purge_checkpoint="COMPLETE",
        reason=reason,
        target_email_hash=email_fingerprint(email),
        target_email_sealed=seal(email),
        completed_at=timestamp,
    )
    db.add(request)
    _write_audit(db, admin.id, "SOFT_DELETE_USER", "user", str(target.id))
    enqueue_email(
        db,
        EmailService.send_account_deleted_email,
        email,
        target.full_name or "Quý khách",
        "soft",
        reason,
        dedupe_key=f"soft-delete-notice:{request.id}",
        owner_user_id=target.id,
    )
    return request


@router.delete(
    "/users/{user_id}",
    summary="Xóa mềm hoặc yêu cầu xóa vĩnh viễn người dùng",
)
def delete_user(
    user_id: UUID,
    payload: UserDeleteRequest,
    response: Response,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    target = _locked_user(db, user_id)
    if not target:
        raise HTTPException(status_code=404, detail="Không tìm thấy người dùng")
    _validate_deletion_target(target, admin)

    if payload.mode == "soft":
        request = _apply_soft_delete(db, target, admin, payload.reason, payload.release_email)
        db.commit()
        db.refresh(request)
        return {
            "message": "Đã xóa mềm tài khoản và thu hồi toàn bộ phiên đăng nhập",
            "deletion": _deletion_request_out(request),
        }

    if target.deletion_status == "PURGE_PENDING":
        raise HTTPException(status_code=409, detail="Yêu cầu xóa vĩnh viễn đang được xử lý")
    try:
        email = original_email(target, strict=True)
    except ValueError:
        raise HTTPException(status_code=409, detail="Không thể đọc email gốc để xác nhận xóa")
    confirmation = (payload.confirmation or "").strip()
    valid_phrase = confirmation.casefold() in {"xóa vĩnh viễn", "xoa vinh vien"}
    if confirmation.casefold() != email.casefold() and not valid_phrase:
        raise HTTPException(status_code=422, detail="Nội dung xác nhận xóa vĩnh viễn không khớp")

    timestamp = datetime.now(timezone.utc)
    if not target.is_deleted:
        target.pre_delete_is_active = target.is_active
        target.email_before_delete_sealed = seal(email)
    target.email = deleted_email_alias(target.id)
    target.is_active = False
    target.is_deleted = True
    target.deletion_status = "PURGE_PENDING"
    target.deleted_at = timestamp
    target.deleted_by = admin.id
    _revoke_user_sessions(db, target, "admin_hard_delete")

    request = UserDeletionRequest(
        id=uuid.uuid4(),
        target_user_id=target.id,
        requested_by=admin.id,
        mode="hard",
        status="PENDING",
        purge_checkpoint="REQUESTED",
        reason=payload.reason,
        target_email_hash=email_fingerprint(email),
        target_email_sealed=seal(email),
    )
    db.add(request)
    db.flush()
    _write_audit(db, admin.id, "HARD_DELETE_USER_REQUESTED", "user", str(target.id))
    enqueue_email(
        db,
        EmailService.send_account_deleted_email,
        email,
        target.full_name or "Quý khách",
        "hard",
        payload.reason,
        dedupe_key=f"hard-delete-notice:{request.id}",
    )
    enqueue(
        db,
        "USER_PURGE",
        {"request_id": str(request.id), "user_id": str(target.id)},
        f"user-purge:{request.id}",
        owner_user_id=target.id,
    )
    db.commit()
    db.refresh(request)
    response.status_code = http_status.HTTP_202_ACCEPTED
    return {
        "message": "Đã khóa tài khoản; worker đang xóa dữ liệu theo checkpoint",
        "deletion": _deletion_request_out(request),
    }


@router.post(
    "/users/bulk-delete",
    summary="Xóa mềm nhiều tài khoản",
)
def bulk_delete_users(
    payload: BulkDeleteRequest,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    deleted_ids = []
    skipped_ids = []
    for user_id in sorted(set(payload.user_ids), key=str):
        target = _locked_user(db, user_id)
        if not target or target.id == admin.id or _is_protected_account(target) or target.is_deleted:
            skipped_ids.append(str(user_id))
            continue
        _apply_soft_delete(db, target, admin, payload.reason, payload.release_email)
        deleted_ids.append(str(user_id))
    db.commit()
    return {
        "success": True,
        "deleted_count": len(deleted_ids),
        "deleted_ids": deleted_ids,
        "skipped_ids": skipped_ids,
    }


@router.post(
    "/users/{user_id}/restore",
    summary="Khôi phục tài khoản đã xóa mềm",
)
def restore_user(
    user_id: UUID,
    payload: RestoreUserRequest,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    from sqlalchemy import func
    target = _locked_user(db, user_id)
    if not target:
        raise HTTPException(status_code=404, detail="Không tìm thấy người dùng")
    _validate_deletion_target(target, admin)
    if target.deletion_status != "SOFT_DELETED":
        raise HTTPException(status_code=409, detail="Chỉ có thể khôi phục tài khoản đã xóa mềm")

    try:
        email = original_email(target, strict=True)
    except ValueError:
        raise HTTPException(status_code=409, detail="Không thể đọc email gốc để khôi phục")
    collision = db.scalar(
        select(User.id).where(func.lower(User.email) == email.casefold(), User.id != target.id)
    )
    if collision:
        raise HTTPException(
            status_code=409,
            detail="Email cũ đã được đăng ký lại; cần xử lý tài khoản trùng trước khi khôi phục",
        )

    target.email = email
    target.is_active = target.pre_delete_is_active if target.pre_delete_is_active is not None else True
    target.is_deleted = False
    target.deletion_status = "ACTIVE"
    target.deleted_at = None
    target.deleted_by = None
    target.email_before_delete_sealed = None
    target.pre_delete_is_active = None
    _revoke_user_sessions(db, target, "admin_restore")
    try:
        db.flush()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=409,
            detail="Email cũ vừa được một tài khoản khác sử dụng; không thể khôi phục",
        )

    request = db.scalar(
        select(UserDeletionRequest)
        .where(
            UserDeletionRequest.target_user_id == user_id,
            UserDeletionRequest.mode == "soft",
            UserDeletionRequest.status == "SOFT_DELETED",
        )
        .order_by(UserDeletionRequest.created_at.desc(), UserDeletionRequest.id.desc())
        .limit(1)
    )
    if request:
        request.status = "RESTORED"
        request.purge_checkpoint = "RESTORED"
        request.target_email_sealed = None
        request.updated_at = datetime.now(timezone.utc)
    _write_audit(db, admin.id, "RESTORE_USER", "user", str(target.id))
    enqueue_email(
        db,
        EmailService.send_account_restored_email,
        email,
        target.full_name or "Quý khách",
        dedupe_key=f"restore-user:{target.id}:{target.token_version}",
        owner_user_id=target.id,
    )
    db.commit()
    return {"message": "Đã khôi phục tài khoản", "user": _user_out(target), "reason": payload.reason}


@router.get(
    "/user-deletions/{request_id}",
    summary="Theo dõi tiến độ xóa vĩnh viễn",
)
def get_user_deletion(
    request_id: UUID,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    request = db.get(UserDeletionRequest, request_id)
    if not request:
        raise HTTPException(status_code=404, detail="Không tìm thấy yêu cầu xóa")
    return _deletion_request_out(request)


@router.post(
    "/user-deletions/{request_id}/retry-purge",
    status_code=http_status.HTTP_202_ACCEPTED,
    summary="Thử lại bước xóa dữ liệu bị lỗi",
)
def retry_user_deletion_purge(
    request_id: UUID,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    request = db.scalar(select(UserDeletionRequest).where(UserDeletionRequest.id == request_id).with_hint(
        UserDeletionRequest, "WITH (UPDLOCK, ROWLOCK)", dialect_name="mssql"
    ).execution_options(populate_existing=True))
    if not request:
        raise HTTPException(status_code=404, detail="Không tìm thấy yêu cầu xóa")
    if request.status != "FAILED" or request.purge_checkpoint == "DB_PURGED":
        raise HTTPException(status_code=409, detail="Yêu cầu không ở trạng thái có thể thử lại bước xóa dữ liệu")
    target = _locked_user(db, request.target_user_id)
    if not target or target.deletion_status != "PURGE_PENDING":
        raise HTTPException(status_code=409, detail="Tài khoản đích không còn ở trạng thái chờ xóa")
    request.status = "PENDING"
    request.purge_checkpoint = "REQUESTED"
    request.error_code = None
    request.updated_at = datetime.now(timezone.utc)
    enqueue(
        db,
        "USER_PURGE",
        {"request_id": str(request.id), "user_id": str(target.id)},
        f"user-purge-retry:{request.id}:{uuid.uuid4()}",
        owner_user_id=target.id,
    )
    _write_audit(db, admin.id, "RETRY_USER_PURGE", "user", str(request.target_user_id))
    db.commit()
    return _deletion_request_out(request)


@router.post(
    "/user-deletions/{request_id}/retry-files",
    status_code=http_status.HTTP_202_ACCEPTED,
    summary="Thử lại bước xóa file bị lỗi",
)
def retry_user_deletion_files(
    request_id: UUID,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    request = db.scalar(select(UserDeletionRequest).where(UserDeletionRequest.id == request_id).with_hint(
        UserDeletionRequest, "WITH (UPDLOCK, ROWLOCK)", dialect_name="mssql"
    ).execution_options(populate_existing=True))
    if not request:
        raise HTTPException(status_code=404, detail="Không tìm thấy yêu cầu xóa")
    if request.status != "FAILED" or request.purge_checkpoint != "DB_PURGED":
        raise HTTPException(status_code=409, detail="Yêu cầu không ở trạng thái có thể thử lại bước xóa file")
    failed = db.scalars(select(UserDeletionFile).where(
        UserDeletionFile.request_id == request_id, UserDeletionFile.status == "FAILED"
    )).all()
    if not failed:
        raise HTTPException(status_code=409, detail="Không có file lỗi để thử lại")
    for row in failed:
        row.status = "PENDING"
        row.attempts = 0
        row.error_code = None
    request.status = "FILES_PENDING"
    request.error_code = None
    request.updated_at = datetime.now(timezone.utc)
    enqueue(db, "USER_FILE_PURGE", {"request_id": str(request.id)}, f"user-file-purge-retry:{request.id}:{uuid.uuid4()}")
    _write_audit(db, admin.id, "RETRY_USER_FILE_PURGE", "user", str(request.target_user_id))
    db.commit()
    return _deletion_request_out(request)
