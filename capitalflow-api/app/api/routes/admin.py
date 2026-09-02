"""
Admin routes — tất cả endpoint yêu cầu require_admin.
Admin đọc dữ liệu tổng hợp, KHÔNG bao giờ trả password_hash hay token.
"""
from datetime import date
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select, text
from sqlalchemy.orm import Session

from app.api.dependencies import get_db, require_admin
from app.models.audit_log import AuditLog
from app.models.category import Category
from app.models.invoice import Invoice
from app.models.ocr_job import OcrJob
from app.models.transaction import Transaction
from app.models.user import User, UserRole
from app.schemas.category import CategoryCreate, CategoryOut, CategoryUpdate

router = APIRouter(prefix="/admin", tags=["Admin"])


# ─────────────────────────────────────────────────────────────
# DASHBOARD
# ─────────────────────────────────────────────────────────────

@router.get("/dashboard/stats")
def admin_stats(
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    """KPI toàn hệ thống cho Admin Dashboard."""
    total_users = db.scalar(select(func.count(User.id)))
    active_users = db.scalar(select(func.count(User.id)).where(User.is_active == True))
    banned_users = db.scalar(select(func.count(User.id)).where(User.is_active == False))
    total_transactions = db.scalar(select(func.count(Transaction.id)))
    total_invoices = db.scalar(select(func.count(Invoice.id))) or 0
    # FIX: Invoice.status là String — dùng string literal thay vì InvoiceStatus enum
    ocr_success = db.scalar(select(func.count(Invoice.id)).where(Invoice.status == "COMPLETED")) or 0
    ocr_failed = db.scalar(select(func.count(Invoice.id)).where(Invoice.status == "FAILED")) or 0
    ocr_processing = db.scalar(select(func.count(Invoice.id)).where(Invoice.status == "PROCESSING")) or 0
    ocr_rate = round(ocr_success / total_invoices * 100, 1) if total_invoices else 0.0

    return {
        "users": {
            "total": total_users,
            "active": active_users,
            "banned": banned_users,
        },
        "transactions": {"total": total_transactions},
        "invoices": {
            "total": total_invoices,
            "completed": ocr_success,
            "failed": ocr_failed,
            "processing": ocr_processing,
            "ocr_success_rate": ocr_rate,
        },
    }


# ─────────────────────────────────────────────────────────────
# USERS
# ─────────────────────────────────────────────────────────────

def _user_out(u: User) -> dict:
    """Serialize user — KHÔNG bao gồm password_hash, token."""
    return {
        "id": str(u.id),
        "email": u.email,
        "full_name": u.full_name,
        "role": u.role.value if hasattr(u.role, "value") else u.role,
        "is_active": u.is_active,
        "created_at": u.created_at,
        "last_login_at": u.last_login_at,
    }


@router.get("/users")
def list_users(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    search: str | None = None,
    role: UserRole | None = None,
    status: str | None = Query(None, description="active | banned"),
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    q = select(User)
    if search:
        q = q.where(
            User.email.ilike(f"%{search}%") | User.full_name.ilike(f"%{search}%")
        )
    if role:
        q = q.where(User.role == role)
    # FIX: parse `status` string → bool is_active thay vì dùng biến is_active chưa khai báo
    if status == "active":
        q = q.where(User.is_active == True)
    elif status == "banned":
        q = q.where(User.is_active == False)

    total = db.scalar(select(func.count()).select_from(q.subquery()))
    users = db.scalars(
        q.order_by(User.created_at.desc())
         .offset((page - 1) * page_size)
         .limit(page_size)
    ).all()

    return {
        "items": [_user_out(u) for u in users],
        "total": total,
        "page": page,
        "page_size": page_size,
    }


@router.get("/users/{user_id}")
def get_user(
    user_id: UUID,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="Không tìm thấy user")
    return _user_out(user)


@router.patch("/users/{user_id}/ban")
def ban_user(
    user_id: UUID,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="Không tìm thấy user")
    if user.role == UserRole.ADMIN:
        raise HTTPException(status_code=400, detail="Không thể ban Admin")
    user.is_active = False
    _write_audit(db, admin.id, "BAN_USER", "user", str(user_id))
    db.commit()
    return {"success": True, "user_id": str(user_id), "is_active": False}


@router.patch("/users/{user_id}/unban")
def unban_user(
    user_id: UUID,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="Không tìm thấy user")
    user.is_active = True
    _write_audit(db, admin.id, "UNBAN_USER", "user", str(user_id))
    db.commit()
    return {"success": True, "user_id": str(user_id), "is_active": True}


# ─────────────────────────────────────────────────────────────
# TRANSACTIONS (admin view — read only)
# ─────────────────────────────────────────────────────────────

@router.get("/transactions")
def admin_transactions(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    total = db.scalar(select(func.count(Transaction.id)))
    items = db.scalars(
        select(Transaction)
        .order_by(Transaction.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    ).all()
    return {
        "items": [
            {
                "id": str(t.id),
                "user_id": str(t.user_id),
                "description": t.description,
                "amount": float(t.amount),
                "type": t.type,
                "transaction_date": str(t.transaction_date),
            }
            for t in items
        ],
        "total": total,
        "page": page,
        "page_size": page_size,
    }


# ─────────────────────────────────────────────────────────────
# INVOICES (admin view)
# ─────────────────────────────────────────────────────────────

@router.get("/invoices")
def admin_invoices(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    status: str | None = None,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    q = select(Invoice)
    if status:
        q = q.where(Invoice.status == status)
    total = db.scalar(select(func.count()).select_from(q.subquery()))
    items = db.scalars(
        q.order_by(Invoice.created_at.desc())
         .offset((page - 1) * page_size)
         .limit(page_size)
    ).all()
    return {
        "items": [
            {
                "id": str(i.id),
                "user_id": str(i.user_id),
                "filename": i.original_filename,
                "status": i.status,
                "created_at": i.created_at,
            }
            for i in items
        ],
        "total": total,
        "page": page,
        "page_size": page_size,
    }


# ─────────────────────────────────────────────────────────────
# CATEGORIES (admin CRUD — hệ thống)
# ─────────────────────────────────────────────────────────────

@router.get("/categories", response_model=list[CategoryOut])
def admin_list_categories(
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    """Xem tất cả danh mục hệ thống (owner=NULL)."""
    return db.scalars(select(Category).where(Category.owner_user_id.is_(None))).all()


@router.post("/categories", response_model=CategoryOut, status_code=201)
def admin_create_category(
    payload: CategoryCreate,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    """Tạo danh mục hệ thống (owner=NULL — áp dụng cho tất cả user)."""
    cat = Category(owner_user_id=None, **payload.model_dump())
    db.add(cat)
    _write_audit(db, admin.id, "CREATE_CATEGORY", "category", cat.name)
    db.commit()
    db.refresh(cat)
    return cat


@router.patch("/categories/{cat_id}", response_model=CategoryOut)
def admin_update_category(
    cat_id: UUID,
    payload: CategoryUpdate,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    cat = db.get(Category, cat_id)
    if not cat:
        raise HTTPException(status_code=404, detail="Không tìm thấy danh mục")
    for field, value in payload.model_dump(exclude_none=True).items():
        setattr(cat, field, value)
    _write_audit(db, admin.id, "UPDATE_CATEGORY", "category", str(cat_id))
    db.commit()
    db.refresh(cat)
    return cat


@router.delete("/categories/{cat_id}", status_code=204)
def admin_delete_category(
    cat_id: UUID,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    cat = db.get(Category, cat_id)
    if not cat:
        raise HTTPException(status_code=404, detail="Không tìm thấy danh mục")
    _write_audit(db, admin.id, "DELETE_CATEGORY", "category", str(cat_id))
    db.delete(cat)
    db.commit()


# ─────────────────────────────────────────────────────────────
# AUDIT LOGS
# ─────────────────────────────────────────────────────────────

@router.get("/audit-logs")
def audit_logs(
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    total = db.scalar(select(func.count(AuditLog.id)))
    logs = db.scalars(
        select(AuditLog)
        .order_by(AuditLog.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    ).all()
    return {
        "items": [
            {
                "id": str(l.id),
                "admin_id": str(l.user_id),
                "action": l.action,
                "target_type": l.entity_type,
                "target_id": l.entity_id,
                "created_at": l.created_at,
            }
            for l in logs
        ],
        "total": total,
        "page": page,
        "page_size": page_size,
    }


# ─────────────────────────────────────────────────────────────
# SYSTEM ANALYTICS (Aggregated — NO personal data)
# ─────────────────────────────────────────────────────────────

@router.get("/system/analytics")
def system_analytics(
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    """
    Thống kê vận hành hệ thống — chỉ số tổng hợp, KHÔNG có dữ liệu cá nhân.
    Admin xem được volume, xu hướng nhưng KHÔNG thấy giao dịch cụ thể của user.
    """
    today = date.today()

    # Tổng volume giao dịch toàn hệ thống (aggregate)
    total_tx = db.scalar(select(func.count(Transaction.id))) or 0
    total_income_tx = db.scalar(select(func.count(Transaction.id)).where(Transaction.type == "INCOME")) or 0
    total_expense_tx = db.scalar(select(func.count(Transaction.id)).where(Transaction.type == "EXPENSE")) or 0

    # Volume theo tháng hiện tại (aggregate)
    month_start_q = text(
        "SELECT COUNT(*) as cnt FROM transactions WHERE MONTH(transaction_date) = :m AND YEAR(transaction_date) = :y"
    )
    tx_this_month = db.execute(month_start_q, {"m": today.month, "y": today.year}).scalar() or 0

    # Top 5 danh mục phổ biến nhất (không gắn với user cụ thể)
    top_categories_q = text("""
        SELECT TOP 5 c.name, COUNT(t.id) as tx_count
        FROM transactions t
        LEFT JOIN categories c ON t.category_id = c.id
        GROUP BY c.name
        ORDER BY tx_count DESC
    """)
    top_categories = [
        {"name": row[0] or "Không phân loại", "transaction_count": row[1]}
        for row in db.execute(top_categories_q).fetchall()
    ]

    # Số user active có ít nhất 1 giao dịch tháng này (count only, no names)
    active_users_q = text(
        "SELECT COUNT(DISTINCT user_id) FROM transactions WHERE MONTH(transaction_date) = :m AND YEAR(transaction_date) = :y"
    )
    active_users_this_month = db.execute(active_users_q, {"m": today.month, "y": today.year}).scalar() or 0

    return {
        "period": {"month": today.month, "year": today.year},
        "transactions": {
            "total_all_time": total_tx,
            "this_month": tx_this_month,
            "income_count": total_income_tx,
            "expense_count": total_expense_tx,
        },
        "active_users_this_month": active_users_this_month,
        "top_categories": top_categories,
    }


# ─────────────────────────────────────────────────────────────
# OCR MONITOR (System health — NO invoice content)
# ─────────────────────────────────────────────────────────────

@router.get("/system/ocr-monitor")
def ocr_monitor(
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    """
    Giám sát hệ thống OCR — chỉ số vận hành, KHÔNG có nội dung hóa đơn.
    Admin thấy success rate, thời gian xử lý, lỗi — KHÔNG thấy nội dung hóa đơn.
    """
    total_invoices = db.scalar(select(func.count(Invoice.id))) or 0
    completed = db.scalar(select(func.count(Invoice.id)).where(Invoice.status == "COMPLETED")) or 0
    failed = db.scalar(select(func.count(Invoice.id)).where(Invoice.status == "FAILED")) or 0
    processing = db.scalar(select(func.count(Invoice.id)).where(Invoice.status == "PROCESSING")) or 0
    review_required = db.scalar(select(func.count(Invoice.id)).where(Invoice.status == "REVIEW_REQUIRED")) or 0
    uploaded = db.scalar(select(func.count(Invoice.id)).where(Invoice.status == "UPLOADED")) or 0

    ocr_success_rate = round(completed / total_invoices * 100, 1) if total_invoices else 0.0

    # OCR jobs stats (từ bảng ocr_jobs)
    total_jobs = db.scalar(select(func.count(OcrJob.id))) or 0
    failed_jobs = db.scalar(select(func.count(OcrJob.id)).where(OcrJob.status == "FAILED")) or 0

    # Recent failed jobs (để admin debug — chỉ error message, không có nội dung)
    recent_failures_q = (
        select(OcrJob.id, OcrJob.status, OcrJob.error_message, OcrJob.created_at)
        .where(OcrJob.status == "FAILED")
        .order_by(OcrJob.created_at.desc())
        .limit(10)
    )
    recent_failures = [
        {
            "job_id": str(j.id),
            "error": j.error_message,
            "created_at": j.created_at,
        }
        for j in db.execute(recent_failures_q).fetchall()
    ]

    return {
        "invoices": {
            "total": total_invoices,
            "completed": completed,
            "failed": failed,
            "processing": processing,
            "review_required": review_required,
            "uploaded": uploaded,
            "success_rate_pct": ocr_success_rate,
        },
        "ocr_jobs": {
            "total": total_jobs,
            "failed": failed_jobs,
            "error_rate_pct": round(failed_jobs / total_jobs * 100, 1) if total_jobs else 0.0,
        },
        "recent_failures": recent_failures,
    }


# ─────────────────────────────────────────────────────────────
# HELPER
# ─────────────────────────────────────────────────────────────

def _write_audit(db: Session, admin_id: UUID, action: str, target_type: str, target_id: str | None = None):
    log = AuditLog(
        user_id=admin_id,
        action=action,
        entity_type=target_type,
        entity_id=target_id or "",
    )
    db.add(log)
    # Không flush tại đây — để caller quyết định khi nào commit

