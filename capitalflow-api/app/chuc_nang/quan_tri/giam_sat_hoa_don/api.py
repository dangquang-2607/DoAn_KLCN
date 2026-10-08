"""
API giám sát và thử lại tác vụ OCR.
GET /admin/system/ocr-monitor
POST /admin/system/ocr-jobs/{job_id}/retry
"""
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import case, func, select
from sqlalchemy.orm import Session

from app.dung_chung.http.phu_thuoc import get_db, require_admin
from app.chuc_nang.nguoi_dung.hoa_don_ai.luu_tru.invoice import Invoice
from app.chuc_nang.nguoi_dung.hoa_don_ai.luu_tru.tac_vu_ocr import OcrJob
from app.chuc_nang.nguoi_dung.dang_nhap.luu_tru.nguoi_dung import User

from app.chuc_nang.quan_tri.dung_chung.tien_ich import _iso_utc, _write_audit

router = APIRouter()


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

    total_jobs, failed_jobs, average_processing_ms, measured_jobs = db.execute(
        select(
            func.count(OcrJob.id),
            func.sum(case((OcrJob.status == "FAILED", 1), else_=0)),
            func.avg(OcrJob.processing_ms),
            func.count(OcrJob.processing_ms),
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
            "measured": int(measured_jobs or 0),
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
    from app.chuc_nang.nguoi_dung.hoa_don_ai.api.routes import _enqueue_ocr

    result = _enqueue_ocr(db, job.invoice_id, job.user_id)
    _write_audit(db, admin.id, "OCR_RETRY", "ocr_job", str(job.id))
    db.commit()
    return result
