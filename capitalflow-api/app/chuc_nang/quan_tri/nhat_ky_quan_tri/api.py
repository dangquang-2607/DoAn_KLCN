"""Admin-only audit search and detail. Credentials are never returned."""
import json
import re
from datetime import date, datetime, time, timedelta
from typing import Literal
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Path, Query
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session, load_only

from app.dung_chung.http.phu_thuoc import get_db, require_admin
from app.chuc_nang.quan_tri.nhat_ky_quan_tri.luu_tru.nhat_ky import AuditLog
from app.chuc_nang.nguoi_dung.dang_nhap.luu_tru.nguoi_dung import User

from app.chuc_nang.quan_tri.dung_chung.tien_ich import _iso_utc

router = APIRouter()
GROUPS = {
    "auth": ["auth", "session", "sessions"],
    "users": ["user", "users", "user_deletion"],
    "categories": ["category", "categories"],
    "ocr": ["invoice", "invoices", "ocr_job", "ocr"],
    "email": ["email", "emails", "settings", "smtp"],
}
SENSITIVE_KEY = re.compile(r"password|passwd|token|secret|authorization|cookie|otp|api.?key|credential", re.I)

# Danh sách không cần JSON trước/sau hay thông tin bảo mật của người thao tác.
# Giữ bản ghi sắp xếp hẹp để tránh memory grant lớn trên SQL Server.
_LIST_FIELDS = (
    AuditLog.id, AuditLog.user_id, AuditLog.action, AuditLog.entity_type,
    AuditLog.entity_id, AuditLog.created_at, AuditLog.status_code, AuditLog.http_method,
)
_ACTOR_FIELDS = (User.id, User.full_name, User.email)


def safe_json(raw: str | None):
    """Bound payload size/depth and recursively redact secret-bearing keys."""
    if not raw:
        return None
    if len(raw) > 20000:
        return {"note": "Dữ liệu quá lớn để hiển thị"}
    try:
        value = json.loads(raw)
    except (ValueError, TypeError):
        return {"note": "Không có dữ liệu JSON hợp lệ"}

    def clean(item, depth=0):
        if depth > 5:
            return "[Đã rút gọn]"
        if isinstance(item, dict):
            return {str(key)[:100]: "[Đã ẩn]" if SENSITIVE_KEY.search(str(key)) else clean(child, depth + 1)
                    for key, child in list(item.items())[:50]}
        if isinstance(item, list):
            return [clean(child, depth + 1) for child in item[:30]]
        # Free text can carry credentials from request bodies and upstream errors.
        if isinstance(item, str):
            return "[Nội dung văn bản đã ẩn]"
        return item

    return clean(value)


def serialize(log: AuditLog, actor: User | None):
    return {
        "id": str(log.id), "admin_id": str(log.user_id) if log.user_id else None,
        "actor_name": (actor.full_name or actor.email) if actor else "Hệ thống / đã ẩn danh",
        "actor_email": actor.email if actor else None,
        "action": log.action, "target_type": log.entity_type,
        "target_id": str(log.entity_id) if log.entity_id else None,
        "created_at": _iso_utc(log.created_at), "status_code": log.status_code,
        "http_method": log.http_method,
    }


@router.get(
    "/audit-logs",
    summary="Nhật ký hệ thống (Audit Logs)",
    description="Lấy danh sách nhật ký hành động quản trị (phân trang) của các Admin trong hệ thống.",
)
def audit_logs(
    page: int = Query(1, ge=1, description="Số trang"),
    page_size: int = Query(50, ge=1, le=200, description="Số bản ghi mỗi trang"),
    search: str = Query("", max_length=150),
    group: Literal["", "auth", "users", "categories", "ocr", "email"] = "",
    result: Literal["", "success", "error", "unknown"] = "",
    start_date: date | None = None,
    end_date: date | None = None,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    if start_date and end_date and start_date > end_date:
        raise HTTPException(422, "Ngày bắt đầu phải trước ngày kết thúc")
    conditions = []
    if search.strip():
        term = search.strip().replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
        match = or_(*(field.ilike(f"%{term}%", escape="\\") for field in
                      [AuditLog.action, AuditLog.entity_type, User.full_name, User.email]))
        try:
            identifier = UUID(search.strip())
            match = or_(match, AuditLog.entity_id == identifier, AuditLog.request_id == identifier, AuditLog.user_id == identifier)
        except ValueError:
            if search.strip().isdigit() and len(search.strip()) < 19:
                match = or_(match, AuditLog.id == int(search.strip()))
        conditions.append(match)
    if group:
        routes = {"auth": ["/api/v1/auth/"], "users": ["/api/v1/admin/users", "/api/v1/admin/user-deletions"],
                  "categories": ["/api/v1/admin/categories", "/api/v1/categories"],
                  "ocr": ["/api/v1/admin/system/ocr", "/api/v1/invoices"], "email": ["/api/v1/admin/email/"]}
        conditions.append(or_(func.lower(AuditLog.entity_type).in_(GROUPS[group]),
                              *(AuditLog.route.like(f"{prefix}%") for prefix in routes[group])))
    if result == "success":
        conditions.append(AuditLog.status_code.between(200, 399))
    elif result == "error":
        conditions.append(AuditLog.status_code >= 400)
    elif result == "unknown":
        conditions.append(AuditLog.status_code.is_(None))
    # Inputs are Vietnam calendar days; stored timestamps are UTC.
    if start_date:
        conditions.append(AuditLog.created_at >= datetime.combine(start_date, time.min) - timedelta(hours=7))
    if end_date:
        conditions.append(AuditLog.created_at < datetime.combine(end_date, time.min) + timedelta(days=1, hours=-7))
    count_query = select(func.count(AuditLog.id)).where(*conditions)
    if search.strip():
        count_query = count_query.outerjoin(User, AuditLog.user_id == User.id)
    total = db.scalar(count_query) or 0
    rows = db.execute(select(AuditLog, User)
                      .options(load_only(*_LIST_FIELDS, raiseload=True), load_only(*_ACTOR_FIELDS, raiseload=True))
                      .outerjoin(User, AuditLog.user_id == User.id)
                      .where(*conditions).order_by(AuditLog.created_at.desc(), AuditLog.id.desc())
                      .offset((page - 1) * page_size).limit(page_size)).all()
    return {"items": [serialize(log, actor) for log, actor in rows], "total": total,
            "page": page, "page_size": page_size}


@router.get("/audit-logs/{log_id}", summary="Chi tiết một hoạt động")
def audit_detail(log_id: int = Path(ge=1), db: Session = Depends(get_db), admin: User = Depends(require_admin)):
    row = db.execute(select(AuditLog, User).options(load_only(*_ACTOR_FIELDS, raiseload=True))
                     .outerjoin(User, AuditLog.user_id == User.id).where(AuditLog.id == log_id)).first()
    if row is None:
        raise HTTPException(404, "Không tìm thấy bản ghi nhật ký")
    log, actor = row
    return {**serialize(log, actor), "request_id": str(log.request_id) if log.request_id else None,
            "route": (log.route or "").split("?", 1)[0] or None,
            "ip_address": log.ip_address, "user_agent": log.user_agent,
            "before": safe_json(log.old_values_json), "after": safe_json(log.new_values_json),
            "metadata": safe_json(log.metadata_json)}
