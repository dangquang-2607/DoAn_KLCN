"""Tiếp nhận và xử lý yêu cầu mất quyền truy cập email hoặc bị khóa tài khoản."""

from typing import Literal, get_args
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.chuc_nang.nguoi_dung.dang_nhap.luu_tru.nguoi_dung import User, UserRole
from app.chuc_nang.quan_tri.dung_chung.tien_ich import _iso_utc, _write_audit
from app.chuc_nang.quan_tri.ho_tro.luu_tru import AccountSupportCase
from app.dung_chung.http.gioi_han_tan_suat import limiter
from app.dung_chung.http.phu_thuoc import get_current_user, get_db, lock_admin_write

router = APIRouter(prefix="/support-cases")
public_router = APIRouter(prefix="/support")
CaseStatus = Literal["OPEN", "ESCALATED", "RESOLVED"]
CaseIssue = Literal["NO_EMAIL", "LOCKED"]


class NewCase(BaseModel):
    email: EmailStr = Field(max_length=255)
    contact_email: EmailStr | None = Field(default=None, max_length=255)
    issue: CaseIssue


class CaseUpdate(BaseModel):
    status: Literal["ESCALATED", "RESOLVED"]


def require_support(request: Request, user: User = Depends(get_current_user),
                    db: Session = Depends(get_db)) -> User:
    user = lock_admin_write(request, db, user)
    if user.role != UserRole.ADMIN or not (user.is_system_account or user.support_only):
        raise HTTPException(403, "Tài khoản không có quyền hỗ trợ.")
    return user


def mask(email):
    name, domain = email.rsplit("@", 1)
    return f"{name[:1]}***@{domain}"


def case_out(case):
    return {
        "id": case.id,
        "email": mask(case.account_email),
        "source": case.source,
        "issue": case.issue,
        "status": case.status,
        "created_at": _iso_utc(case.created_at),
        "updated_at": _iso_utc(case.updated_at),
    }


def get_case(db, case_id, lock=False):
    query = select(AccountSupportCase).where(
        AccountSupportCase.id == case_id, AccountSupportCase.issue.in_(get_args(CaseIssue)),
    )
    if lock:
        query = query.with_hint(AccountSupportCase, "WITH (UPDLOCK, ROWLOCK)", dialect_name="mssql")
    case = db.scalar(query.execution_options(populate_existing=True))
    if not case:
        raise HTTPException(404, "Không tìm thấy yêu cầu hỗ trợ.")
    return case


def create_case(db, payload):
    email = str(payload.email).lower()
    contact = str(payload.contact_email).lower() if payload.contact_email else None
    if len(email.encode("utf-16-le")) > 510 or (contact and len(contact.encode("utf-16-le")) > 510):
        raise HTTPException(422, "Địa chỉ email vượt giới hạn độ dài.")
    if payload.issue == "NO_EMAIL" and (not contact or email == contact):
        raise HTTPException(422, "Nhập một email liên hệ khác mà bạn vẫn truy cập được.")
    existing = select(AccountSupportCase).where(
        AccountSupportCase.account_email == email, AccountSupportCase.issue == payload.issue,
        AccountSupportCase.status != "RESOLVED",
    )
    case = db.scalar(existing)
    if case:
        return case
    case = AccountSupportCase(
        account_email=email, contact_email=contact, issue=payload.issue, source="USER",
    )
    try:
        with db.begin_nested():
            db.add(case)
            db.flush()
    except IntegrityError:
        case = db.scalar(existing)
        if case:
            return case
        raise
    db.commit()
    return case


@public_router.post("/account", status_code=202)
@limiter.limit("3/minute;10/hour")
def request_support(request: Request, payload: NewCase, db: Session = Depends(get_db)):
    create_case(db, payload)
    # Public intake never looks up the account or triggers email.
    return {"message": "Đã tiếp nhận yêu cầu hỗ trợ tài khoản."}


@router.get("")
def list_support_cases(status: CaseStatus | None = None, page: int = Query(1, ge=1, le=10_000),
                       db: Session = Depends(get_db), _admin: User = Depends(require_support)):
    query = select(AccountSupportCase).where(AccountSupportCase.issue.in_(get_args(CaseIssue)))
    if status:
        query = query.where(AccountSupportCase.status == status)
    total = db.scalar(select(func.count()).select_from(query.subquery()))
    rows = db.scalars(query.order_by(AccountSupportCase.created_at.desc(), AccountSupportCase.id.desc())
                      .offset((page - 1) * 15).limit(15))
    return {"items": [case_out(row) for row in rows], "total": total}


@router.get("/{case_id}")
def support_detail(case_id: UUID, db: Session = Depends(get_db), admin: User = Depends(require_support)):
    case = get_case(db, case_id)
    return {
        **case_out(case),
        "contact_email": case.contact_email,
        "can_resolve": case.status == "OPEN" or (case.status == "ESCALATED" and admin.is_system_account),
    }


@router.patch("/{case_id}")
def update_support_case(case_id: UUID, payload: CaseUpdate, db: Session = Depends(get_db),
                        admin: User = Depends(require_support)):
    case = get_case(db, case_id, lock=True)
    if case.status == payload.status:
        return case_out(case)
    if case.status == "RESOLVED" or (case.status == "ESCALATED" and not admin.is_system_account):
        raise HTTPException(409, "Yêu cầu đã đóng hoặc đang chờ admin gốc xử lý.")
    previous_status = case.status
    case.status = payload.status
    case.updated_by = admin.id
    _write_audit(db, admin.id, f"SUPPORT_CASE_{payload.status}", "support_case", str(case.id),
                 before={"status": previous_status}, after={"status": case.status})
    db.commit()
    return case_out(case)
