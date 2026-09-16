"""
Admin OCR — Giám sát và retry hệ thống OCR.
GET /admin/system/ocr-monitor
POST /admin/system/ocr-jobs/{job_id}/retry
GET /admin/system/analytics
"""
from datetime import date
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select, text
from sqlalchemy.orm import Session

from app.api.dependencies import get_db, require_admin
from app.models.invoice import Invoice
from app.models.ocr_job import OcrJob
from app.models.transaction import Transaction
from app.models.user import User

from ._shared import _iso_utc, _write_audit

router = APIRouter()


@router.get(
    "/system/analytics",
    summary="Phân tích vận hành hệ thống (System Analytics)",
    description="Thống kê vận hành hệ thống dạng tổng hợp (không chứa dữ liệu cá nhân).",
)
def system_analytics(
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    today = date.today()

    total_tx = db.scalar(select(func.count(Transaction.id))) or 0
    total_income_tx = db.scalar(select(func.count(Transaction.id)).where(Transaction.type == "INCOME")) or 0
    total_expense_tx = db.scalar(select(func.count(Transaction.id)).where(Transaction.type == "EXPENSE")) or 0

    month_start_q = text(
        "SELECT COUNT(*) as cnt FROM transactions WHERE MONTH(transaction_date) = :m AND YEAR(transaction_date) = :y"
    )
    tx_this_month = db.execute(month_start_q, {"m": today.month, "y": today.year}).scalar() or 0

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


@router.get(
    "/system/ocr-monitor",
    summary="Giám sát hệ thống OCR (OCR Monitor)",
    description="Giám sát hiệu suất vận hành dịch vụ OCR.",
)
def ocr_monitor(
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    total_invoices = db.scalar(select(func.count(Invoice.id))) or 0
    completed = db.scalar(select(func.count(Invoice.id)).where(Invoice.status == "CONFIRMED")) or 0
    failed = db.scalar(select(func.count(Invoice.id)).where(Invoice.status == "FAILED")) or 0
    processing = db.scalar(select(func.count(Invoice.id)).where(Invoice.status == "PROCESSING")) or 0
    review_required = db.scalar(select(func.count(Invoice.id)).where(Invoice.status == "REVIEW_REQUIRED")) or 0
    uploaded = db.scalar(select(func.count(Invoice.id)).where(Invoice.status == "UPLOADED")) or 0

    ocr_success_rate = round(completed / total_invoices * 100, 1) if total_invoices else 0.0

    total_jobs = db.scalar(select(func.count(OcrJob.id))) or 0
    failed_jobs = db.scalar(select(func.count(OcrJob.id)).where(OcrJob.status == "FAILED")) or 0
    average_processing_ms = db.scalar(
        select(func.avg(OcrJob.processing_ms)).where(OcrJob.processing_ms.is_not(None))
    )

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
            "created_at": _iso_utc(j.created_at),
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
            "average_processing_ms": round(float(average_processing_ms), 0) if average_processing_ms is not None else None,
        },
        "recent_failures": recent_failures,
    }


@router.post("/system/ocr-jobs/{job_id}/retry", status_code=202)
def retry_failed_ocr_job(
    job_id: UUID,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    job = db.scalar(
        select(OcrJob).where(OcrJob.id == job_id).with_hint(
            OcrJob, "WITH (UPDLOCK, ROWLOCK)", dialect_name="mssql"
        ).execution_options(populate_existing=True)
    )
    if not job or job.status != "FAILED" or not job.invoice_id:
        raise HTTPException(status_code=404, detail="Không tìm thấy lượt OCR lỗi có thể xử lý lại")
    from app.api.routes.invoices import _enqueue_ocr

    result = _enqueue_ocr(db, job.invoice_id, job.user_id)
    _write_audit(db, admin.id, "OCR_RETRY", "ocr_job", str(job.id))
    db.commit()
    return result
