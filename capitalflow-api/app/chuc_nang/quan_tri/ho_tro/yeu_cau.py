"""Tiếp nhận yêu cầu trong ứng dụng và gửi phản hồi qua hàng đợi email."""

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from pydantic import BaseModel, ConfigDict, Field, ValidationInfo, field_validator
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.chuc_nang.nguoi_dung.dang_nhap.luu_tru.nguoi_dung import User
from app.chuc_nang.quan_tri.dung_chung.tien_ich import _iso_utc, _write_audit
from app.dung_chung.email.dich_vu import EmailService
from app.dung_chung.email.luu_tru.nhat_ky_email import EmailLog
from app.dung_chung.http.gioi_han_tan_suat import limiter
from app.dung_chung.http.phu_thuoc import get_current_user, get_db
from app.dung_chung.tac_vu_nen.hang_doi import enqueue_email, now
from app.dung_chung.tac_vu_nen.luu_tru.tac_vu_nen import BackgroundJob
from app.dung_chung.text.unicode import normalize_unicode_text, validate_utf16_length
from .api import require_support
from .luu_tru import SupportRequest

user_router = APIRouter(prefix="/support/requests", tags=["Support"])
admin_router = APIRouter(prefix="/support-requests")


class SupportText(BaseModel):
    model_config = ConfigDict(extra="forbid")

    @field_validator("*", mode="before")
    @classmethod
    def clean_text(cls, value, info: ValidationInfo):
        if info.field_name in {"title", "message", "reply"}:
            value = normalize_unicode_text(value, strip=True)
            if info.field_name == "title" and any(char in value for char in "\r\n"):
                raise ValueError("Tiêu đề phải nằm trên một dòng.")
            validate_utf16_length(value, 100 if info.field_name == "title" else 1500, "Nội dung")
        return value


class NewSupportRequest(SupportText):
    request_id: UUID
    title: str = Field(min_length=4, max_length=100)
    message: str = Field(min_length=10, max_length=1500)


class SupportReply(SupportText):
    reply: str = Field(min_length=1, max_length=1500)


def delivery_status(job_status, email_status, error_code):
    if email_status == "SENT":
        return "SENT"
    if email_status == "UNKNOWN" or error_code == "EmailDeliveryUncertain":
        return "UNKNOWN"
    if job_status == "DONE":
        return "SENT"
    if job_status == "DEAD":
        return "FAILED"
    return "QUEUED"


def request_out(item, job_status=None, email_status=None, error_code=None):
    return {
        "id": item.id, "title": item.title, "email": item.account_email,
        "full_name": item.full_name, "created_at": _iso_utc(item.created_at),
        "reply_status": delivery_status(job_status, email_status, error_code) if item.reply_job_id else "NEW",
    }


def request_detail(db, item):
    job = db.get(BackgroundJob, item.reply_job_id) if item.reply_job_id else None
    email = db.get(EmailLog, item.reply_job_id) if item.reply_job_id else None
    return {
        **request_out(item, job.status if job else None, email.status if email else None, job.error_code if job else None),
        "message": item.message, "reply": item.reply,
        "reply_queued_at": _iso_utc(item.reply_queued_at),
    }


@user_router.post("", status_code=201)
@limiter.limit("3/minute;10/hour")
def submit_request(request: Request, payload: NewSupportRequest, db: Session = Depends(get_db),
                   user: User = Depends(get_current_user)):
    def same_request(item):
        if item.user_id != user.id or item.title != payload.title or item.message != payload.message:
            raise HTTPException(409, "Mã gửi yêu cầu đã được sử dụng. Hãy tải lại biểu mẫu.")

    existing = db.get(SupportRequest, payload.request_id)
    if existing:
        same_request(existing)
        return {"id": existing.id, "message": "Đã tiếp nhận yêu cầu. Phản hồi sẽ được gửi qua email."}
    item = SupportRequest(id=payload.request_id, user_id=user.id, account_email=user.email,
                          full_name=user.full_name, title=payload.title, message=payload.message)
    try:
        with db.begin_nested():
            db.add(item)
            db.flush()
    except IntegrityError:
        existing = db.get(SupportRequest, payload.request_id)
        if existing is None:
            raise
        same_request(existing)
    db.commit()
    return {"id": payload.request_id, "message": "Đã tiếp nhận yêu cầu. Phản hồi sẽ được gửi qua email."}


@admin_router.get("")
def list_requests(page: int = Query(1, ge=1, le=10_000), db: Session = Depends(get_db),
                  _admin: User = Depends(require_support)):
    total = db.scalar(select(func.count()).select_from(SupportRequest))
    rows = db.execute(
        select(SupportRequest, BackgroundJob.status, EmailLog.status, BackgroundJob.error_code)
        .outerjoin(BackgroundJob, BackgroundJob.id == SupportRequest.reply_job_id)
        .outerjoin(EmailLog, EmailLog.id == SupportRequest.reply_job_id)
        .order_by(SupportRequest.created_at.desc(), SupportRequest.id.desc())
        .offset((page - 1) * 15).limit(15)
    ).all()
    return {"items": [request_out(*row) for row in rows], "total": total}


def owned_request(db, request_id, lock=False):
    query = select(SupportRequest).where(SupportRequest.id == request_id)
    if lock:
        query = query.with_hint(SupportRequest, "WITH (UPDLOCK, ROWLOCK)", dialect_name="mssql")
    item = db.scalar(query.execution_options(populate_existing=True))
    if item is None:
        raise HTTPException(404, "Không tìm thấy yêu cầu hỗ trợ.")
    return item


@admin_router.get("/{request_id}")
def read_request(request_id: UUID, db: Session = Depends(get_db), _admin: User = Depends(require_support)):
    return request_detail(db, owned_request(db, request_id))


@admin_router.post("/{request_id}/reply", status_code=202)
def reply_to_request(request_id: UUID, payload: SupportReply, db: Session = Depends(get_db),
                     admin: User = Depends(require_support)):
    item = owned_request(db, request_id, lock=True)
    if item.reply_job_id:
        detail = request_detail(db, item)
        if item.reply != payload.reply:
            raise HTTPException(409, "Yêu cầu đã có nội dung phản hồi. Hãy tải lại để xem kết quả gửi.")
        if detail["reply_status"] != "FAILED":
            return detail
        job = db.get(BackgroundJob, item.reply_job_id)
        if job is None:
            raise HTTPException(409, "Tác vụ phản hồi không còn tồn tại. Hãy tải lại yêu cầu.")
        job.status = "PENDING"
        job.attempts = 0
        job.error_code = None
        job.available_at = now()
        job.lease_until = None
        job.lease_token = None
    else:
        job = enqueue_email(db, EmailService.send_support_reply, recipient=item.account_email,
                            full_name=item.full_name, title=item.title, message=item.message, reply=payload.reply,
                            dedupe_key=f"support-reply:{item.id}", owner_user_id=item.user_id)
        item.reply = payload.reply
        item.reply_job_id = job.id
    item.replied_by = admin.id
    item.reply_queued_at = now()
    _write_audit(db, admin.id, "SUPPORT_REPLY_QUEUED", "support_request", str(item.id))
    db.commit()
    return request_detail(db, item)
