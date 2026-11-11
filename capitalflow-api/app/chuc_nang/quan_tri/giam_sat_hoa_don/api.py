"""
API giám sát và thử lại tác vụ OCR.
GET /admin/system/ocr-monitor
POST /admin/system/ocr-jobs/{job_id}/retry
"""
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import Float, case, cast, func, select
from sqlalchemy.orm import Session, load_only

from app.dung_chung.http.phu_thuoc import get_db, require_admin
from app.chuc_nang.nguoi_dung.hoa_don_ai.luu_tru.invoice import Invoice
from app.chuc_nang.nguoi_dung.hoa_don_ai.luu_tru.tac_vu_ocr import OcrJob
from app.chuc_nang.nguoi_dung.dang_nhap.luu_tru.nguoi_dung import User

from app.chuc_nang.quan_tri.dung_chung.tien_ich import _iso_utc, _locked_user, _write_audit

router = APIRouter()


def _failure_state(job_id, invoice, owner, latest_job, error_code=None):
    """Shared display/retry policy; history alone never authorizes a new OCR."""
    def state(code, label, reason, can_retry=False):
        return {"resolution": code, "resolution_label": label,
                "retry_reason": reason, "can_retry": can_retry}

    if invoice is None:
        if error_code == "UPLOAD_OCR_INTERRUPTED":
            return state("UNAVAILABLE", "Đã gián đoạn", "Lượt OCR khi tải lên đã quá thời gian chờ. Hướng dẫn người dùng thử lại ảnh tại màn Quét hóa đơn.")
        if error_code in {"UPLOAD_OCR_UNAVAILABLE", "UPLOAD_INVALID_OCR", "UnsupportedInvoiceCurrency"}:
            return state("UNAVAILABLE", "Chưa tạo hóa đơn", "OCR khi tải lên chưa hoàn tất. Hướng dẫn người dùng thử lại ảnh tại màn Quét hóa đơn.")
        return state("UNAVAILABLE", "Không có hóa đơn", "Lượt lỗi không còn hóa đơn liên quan để thử lại.")
    if invoice.deleted_at:
        return state("UNAVAILABLE", "Hóa đơn đã xóa", "Không thể quét hóa đơn trong thùng rác.")
    if invoice.duplicate_of_invoice_id:
        return state("UNAVAILABLE", "Hóa đơn trùng", "Xử lý trên hóa đơn gốc, không quét lại bản trùng.")
    if invoice.status == "CONFIRMED":
        return state("RESOLVED", "Đã xác nhận", "Hóa đơn đã được ghi nhận; lỗi này chỉ còn trong lịch sử.")
    if invoice.status == "REVIEW_REQUIRED":
        return state("REVIEW_REQUIRED", "Đã có kết quả · chờ xác nhận", "Người dùng cần kiểm tra kết quả; không cần thử lại lượt lỗi cũ.")
    if invoice.status == "PROCESSING" or (latest_job and latest_job.status in {"QUEUED", "PROCESSING"}):
        return state("PROCESSING", "Đang xử lý", "Đã có lượt OCR đang chờ hoặc đang chạy.")
    if not owner or not owner.is_active:
        return state("UNAVAILABLE", "Tài khoản không hoạt động", "Không thể thử lại cho tài khoản đã khóa hoặc đã xóa.")
    if not invoice.storage_key:
        return state("UNAVAILABLE", "Thiếu tệp hóa đơn", "Người dùng cần tải lại tệp trước khi quét.")
    if invoice.mime_type == "application/xml":
        return state("UNAVAILABLE", "Hóa đơn XML", "Hóa đơn XML được đọc trực tiếp, không chạy OCR.")
    if latest_job is None or latest_job.id != job_id:
        return state("SUPERSEDED", "Đã có lượt mới hơn", "Kiểm tra lượt OCR mới nhất của hóa đơn; không thử lại lượt lỗi cũ.")
    if invoice.status != "FAILED" or latest_job.status != "FAILED":
        return state("UNAVAILABLE", "Không cần thử lại lượt lỗi này", "Hóa đơn hiện không ở trạng thái OCR thất bại cần thử lại.")
    return state("NEEDS_RETRY", "Cần xử lý", "Hóa đơn vẫn thất bại và đây là lượt OCR mới nhất.", True)


def _latest_jobs(db, invoice_ids):
    if not invoice_ids:
        return {}
    ranked = select(
        OcrJob.id, OcrJob.invoice_id, OcrJob.status,
        func.row_number().over(partition_by=OcrJob.invoice_id,
                               order_by=(OcrJob.created_at.desc(), OcrJob.id.desc())).label("position"),
    ).where(OcrJob.invoice_id.in_(invoice_ids)).subquery()
    return {row.invoice_id: row for row in db.execute(select(ranked).where(ranked.c.position == 1))}


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
        ).where(Invoice.deleted_at.is_(None))
    ).one()
    total_invoices, completed, failed, processing, review_required, uploaded = (
        int(value or 0) for value in invoice_counts
    )

    ocr_success_rate = round(completed / total_invoices * 100, 1) if total_invoices else 0.0

    total_jobs, failed_jobs, queued_jobs, processing_jobs, average_processing_ms, measured_jobs = db.execute(
        select(
            func.count(OcrJob.id),
            func.sum(case((OcrJob.status == "FAILED", 1), else_=0)),
            func.sum(case((OcrJob.status == "QUEUED", 1), else_=0)),
            func.sum(case((OcrJob.status == "PROCESSING", 1), else_=0)),
            func.avg(cast(OcrJob.processing_ms, Float)),
            func.count(OcrJob.processing_ms),
        )
    ).one()
    total_jobs = int(total_jobs or 0)
    failed_jobs = int(failed_jobs or 0)

    recent_failures_q = (
        select(OcrJob, Invoice, User)
        .options(
            load_only(OcrJob.id, OcrJob.invoice_id, OcrJob.error_code, OcrJob.error_message, OcrJob.created_at),
            load_only(Invoice.id, Invoice.status, Invoice.deleted_at, Invoice.duplicate_of_invoice_id,
                      Invoice.storage_key, Invoice.mime_type),
            load_only(User.id, User.is_active),
        )
        .outerjoin(Invoice, (Invoice.id == OcrJob.invoice_id) & (Invoice.user_id == OcrJob.user_id))
        .outerjoin(User, User.id == OcrJob.user_id)
        .where(OcrJob.status == "FAILED")
        .order_by(OcrJob.created_at.desc(), OcrJob.id.desc())
        .limit(10)
    )
    failures = db.execute(recent_failures_q).all()
    latest = _latest_jobs(db, {invoice.id for _, invoice, _ in failures if invoice})
    recent_failures = [
        {
            "job_id": str(j.id),
            "error": j.error_message,
            "error_code": j.error_code,
            "created_at": _iso_utc(j.created_at),
            "invoice_id": str(j.invoice_id) if j.invoice_id else None,
            "invoice_status": invoice.status if invoice else None,
            "latest_job_id": str(latest[invoice.id].id) if invoice and invoice.id in latest else None,
            "latest_job_status": latest[invoice.id].status if invoice and invoice.id in latest else None,
            **_failure_state(j.id, invoice, owner, latest.get(invoice.id) if invoice else None, j.error_code),
        }
        for j, invoice, owner in failures
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
            "queued": int(queued_jobs or 0),
            "processing": int(processing_jobs or 0),
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
    # Follow the same user -> invoice/job order as user mutations.
    reference = db.execute(select(OcrJob.user_id, OcrJob.invoice_id).where(OcrJob.id == job_id)).first()
    if not reference:
        raise HTTPException(status_code=404, detail="Không tìm thấy lượt OCR lỗi")
    owner = _locked_user(db, reference.user_id)
    # Serialize the state check and enqueue with worker/confirmation/deletion.
    # The lock order is user -> invoice -> job throughout the OCR lifecycle.
    invoice = db.scalar(select(Invoice).where(
        Invoice.id == reference.invoice_id, Invoice.user_id == reference.user_id,
    ).with_hint(Invoice, "WITH (UPDLOCK, ROWLOCK)", dialect_name="mssql")
      .execution_options(populate_existing=True)) if reference.invoice_id else None
    job = db.scalar(
        select(OcrJob).where(OcrJob.id == job_id).with_hint(
            OcrJob, "WITH (UPDLOCK, ROWLOCK)", dialect_name="mssql"
        ).execution_options(populate_existing=True)
    )
    if not job or job.status != "FAILED" or not job.invoice_id:
        raise HTTPException(status_code=404, detail="Không tìm thấy lượt OCR lỗi có thể xử lý lại")
    latest = _latest_jobs(db, {job.invoice_id}).get(job.invoice_id)
    state = _failure_state(job.id, invoice, owner, latest, job.error_code)
    if not state["can_retry"]:
        raise HTTPException(status_code=409, detail=state["retry_reason"])
    from app.chuc_nang.nguoi_dung.hoa_don_ai.api.routes import _enqueue_ocr

    result = _enqueue_ocr(db, job.invoice_id, job.user_id)
    _write_audit(db, admin.id, "OCR_RETRY", "ocr_job", str(job.id),
                 before={"status": "FAILED"}, after={"retry_queued": True})
    db.commit()
    return result
