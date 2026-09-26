"""
API giám sát và thử lại tác vụ OCR.
GET /admin/system/ocr-monitor
POST /admin/system/ocr-jobs/{job_id}/retry
GET /admin/system/analytics
"""
from datetime import date
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import case, func, select
from sqlalchemy.orm import Session

from app.shared.http.dependencies import get_db, require_admin
from app.modules.hoadon.persistence.invoice import Invoice
from app.modules.hoadon.persistence.ocr_job import OcrJob
from app.modules.danhmuc.persistence.category import Category
from app.modules.taichinh.persistence.transaction import Transaction
from app.modules.dangnhap.persistence.user import User

from app.modules.admin.common.shared import _iso_utc, _write_audit

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
    month_start = date(today.year, today.month, 1)
    next_month = date(today.year + (today.month == 12), today.month % 12 + 1, 1)

    totals = db.execute(
        select(
            func.count(Transaction.id),
            func.sum(case((Transaction.type == "INCOME", 1), else_=0)),
            func.sum(case((Transaction.type == "EXPENSE", 1), else_=0)),
            func.sum(
                case(
                    (
                        (Transaction.transaction_date >= month_start)
                        & (Transaction.transaction_date < next_month),
                        1,
                    ),
                    else_=0,
                )
            ),
            func.count(
                func.distinct(
                    case(
                        (
                            (Transaction.transaction_date >= month_start)
                            & (Transaction.transaction_date < next_month),
                            Transaction.user_id,
                        )
                    )
                )
            ),
        )
    ).one()
    total_tx, total_income_tx, total_expense_tx, tx_this_month, active_users_this_month = (
        int(value or 0) for value in totals
    )

    top_categories_q = (
        select(Category.name, func.count(Transaction.id).label("tx_count"))
        .select_from(Transaction)
        .outerjoin(Category, Transaction.category_id == Category.id)
        .group_by(Category.name)
        .order_by(func.count(Transaction.id).desc())
        .limit(5)
    )
    top_categories = [
        {"name": row[0] or "Không phân loại", "transaction_count": row[1]}
        for row in db.execute(top_categories_q).fetchall()
    ]

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
    invoice_counts = db.execute(
        select(
            func.count(Invoice.id),
            func.sum(case((Invoice.status == "CONFIRMED", 1), else_=0)),
            func.sum(case((Invoice.status == "FAILED", 1), else_=0)),
            func.sum(case((Invoice.status == "PROCESSING", 1), else_=0)),
            func.sum(case((Invoice.status == "REVIEW_REQUIRED", 1), else_=0)),
            func.sum(case((Invoice.status == "UPLOADED", 1), else_=0)),
        )
    ).one()
    total_invoices, completed, failed, processing, review_required, uploaded = (
        int(value or 0) for value in invoice_counts
    )

    ocr_success_rate = round(completed / total_invoices * 100, 1) if total_invoices else 0.0

    total_jobs, failed_jobs, average_processing_ms = db.execute(
        select(
            func.count(OcrJob.id),
            func.sum(case((OcrJob.status == "FAILED", 1), else_=0)),
            func.avg(OcrJob.processing_ms),
        )
    ).one()
    total_jobs = int(total_jobs or 0)
    failed_jobs = int(failed_jobs or 0)

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
    from app.modules.hoadon.api.routes import _enqueue_ocr

    result = _enqueue_ocr(db, job.invoice_id, job.user_id)
    _write_audit(db, admin.id, "OCR_RETRY", "ocr_job", str(job.id))
    db.commit()
    return result
