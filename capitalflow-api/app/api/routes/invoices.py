"""
Invoice routes — upload, OCR bằng Gemini AI, xác nhận hóa đơn.
Gemini prompt được nâng cấp để trả về từng dòng sản phẩm chi tiết.
"""
import json
import uuid
from datetime import datetime, timezone
from decimal import Decimal
from pathlib import Path
from time import time

from fastapi import APIRouter, Depends, File, HTTPException, Query, Request, UploadFile
from sqlalchemy import select, func
from sqlalchemy.orm import Session

from app.api.dependencies import get_current_user, get_db
from app.core.config import settings
from app.core.limiter import limiter
from app.models.invoice import Invoice
from app.models.invoice_item import InvoiceItem
from app.models.ocr_job import OcrJob
from app.models.transaction import TransactionSource, TransactionType
from app.models.user import User
from app.schemas.invoice import InvoiceConfirm, InvoiceListOut, InvoiceOut, InvoicePage, InvoiceItemOut
from app.services.gemini_service import run_gemini_ocr
from app.services.transaction_service import create_transaction

router = APIRouter(prefix="/invoices", tags=["Invoices"])

ALLOWED_MIME = {"image/jpeg", "image/png", "image/webp", "application/pdf"}
ALLOWED_EXT = {".jpg", ".jpeg", ".png", ".webp", ".pdf"}
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10 MB


# ─────────────────────────────────────────────
# Upload & List
# ─────────────────────────────────────────────

@router.post("", status_code=201)
async def upload_invoice(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Upload hóa đơn — lưu file và tạo bản ghi Invoice với status UPLOADED."""
    ext = Path(file.filename or "").suffix.lower()
    if ext not in ALLOWED_EXT:
        raise HTTPException(status_code=400, detail=f"Định dạng không hỗ trợ: {ext}")

    contents = await file.read()
    if len(contents) > MAX_FILE_SIZE:
        raise HTTPException(status_code=413, detail="File quá lớn (tối đa 10 MB)")

    stored_name = f"{uuid.uuid4()}{ext}"
    upload_path = Path(settings.upload_dir) / stored_name
    upload_path.parent.mkdir(parents=True, exist_ok=True)
    upload_path.write_bytes(contents)

    invoice = Invoice(
        user_id=user.id,
        original_filename=file.filename,
        storage_key=stored_name,
        mime_type=file.content_type or "application/octet-stream",
        file_size_bytes=len(contents),
        source="UPLOAD",
        status="UPLOADED",
    )
    db.add(invoice)
    db.commit()
    db.refresh(invoice)
    return {"id": str(invoice.id), "filename": invoice.original_filename, "status": invoice.status}


@router.get("", response_model=InvoicePage)
def list_invoices(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    status: str | None = None,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Lấy danh sách hóa đơn (không bao gồm items chi tiết để tối ưu hiệu suất)."""
    q = select(Invoice).where(Invoice.user_id == user.id)
    if status:
        q = q.where(Invoice.status == status.upper())
    q = q.order_by(Invoice.created_at.desc())

    count_q = select(func.count()).select_from(q.subquery())
    total = db.scalar(count_q) or 0
    items = db.scalars(q.offset((page - 1) * page_size).limit(page_size)).all()

    return InvoicePage(items=items, total=total, page=page, page_size=page_size)


@router.get("/{invoice_id}", response_model=InvoiceOut)
def get_invoice(
    invoice_id: uuid.UUID,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Lấy chi tiết hóa đơn kèm danh sách sản phẩm (items)."""
    invoice = db.scalar(
        select(Invoice).where(Invoice.id == invoice_id, Invoice.user_id == user.id)
    )
    if not invoice:
        raise HTTPException(status_code=404, detail="Không tìm thấy hóa đơn")

    # Load items chi tiết
    items = db.scalars(
        select(InvoiceItem)
        .where(InvoiceItem.invoice_id == invoice_id)
        .order_by(InvoiceItem.line_no)
    ).all()

    result = InvoiceOut.model_validate(invoice)
    result.items = [InvoiceItemOut.model_validate(it) for it in items]
    return result


# ─────────────────────────────────────────────
# Invoice Items
# ─────────────────────────────────────────────

@router.get("/{invoice_id}/items", response_model=list[InvoiceItemOut])
def get_invoice_items(
    invoice_id: uuid.UUID,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Lấy riêng danh sách sản phẩm của hóa đơn."""
    invoice = db.scalar(
        select(Invoice).where(Invoice.id == invoice_id, Invoice.user_id == user.id)
    )
    if not invoice:
        raise HTTPException(status_code=404, detail="Không tìm thấy hóa đơn")

    items = db.scalars(
        select(InvoiceItem)
        .where(InvoiceItem.invoice_id == invoice_id)
        .order_by(InvoiceItem.line_no)
    ).all()
    return items


# ─────────────────────────────────────────────
# OCR — Gemini AI
# ─────────────────────────────────────────────

@router.post("/{invoice_id}/ocr")
@limiter.limit("5/minute")
async def run_ocr(
    request: Request,
    invoice_id: uuid.UUID,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """
    Gọi Gemini AI để đọc hóa đơn.
    Kết quả trả về gồm thông tin tổng hợp VÀ từng dòng sản phẩm chi tiết.
    """
    invoice = db.scalar(
        select(Invoice).where(Invoice.id == invoice_id, Invoice.user_id == user.id)
    )
    if not invoice:
        raise HTTPException(status_code=404, detail="Không tìm thấy hóa đơn")
    if invoice.status in ("CONFIRMED", "PROCESSING"):
        raise HTTPException(status_code=400, detail=f"Hóa đơn đang ở trạng thái '{invoice.status}', không thể OCR lại")

    started = time()
    ocr_job = OcrJob(
        user_id=user.id,
        invoice_id=invoice.id,
        status="PROCESSING",
        provider="google_gemini",
        model_name=settings.google_ai_model,
        attempt_count=1,
        progress_percent=10,
        started_at=datetime.now(timezone.utc),
    )
    invoice.status = "PROCESSING"
    invoice.ocr_provider = "google_gemini"
    invoice.ocr_model = settings.google_ai_model
    db.add(ocr_job)
    db.commit()

    try:
        file_path = Path(settings.upload_dir) / (invoice.storage_key or "")
        file_bytes = file_path.read_bytes()

        ocr_job.progress_percent = 30
        db.commit()

        ocr_data = await run_gemini_ocr(file_bytes, invoice.mime_type or "image/jpeg")

        # ── Ánh xạ dữ liệu tổng hợp lên Invoice ──────────────────────────────
        if ngay_lap := ocr_data.get("ngay_lap"):
            try:
                day, month, year = map(int, ngay_lap.split("/"))
                invoice.invoice_date = datetime(year, month, day).date()
            except Exception:
                pass

        def _parse_amount(val) -> Decimal:
            s = "".join(filter(lambda c: c.isdigit() or c == ".", str(val or "0")))
            return Decimal(s) if s else Decimal("0")

        invoice.subtotal_amount = _parse_amount(ocr_data.get("doanh_so_chua_thue"))
        invoice.tax_amount = _parse_amount(ocr_data.get("tien_thue_gtgt"))
        invoice.total_amount = _parse_amount(ocr_data.get("tong_thanh_toan"))
        invoice.merchant_name = ocr_data.get("ten_nguoi_ban_mua") or ocr_data.get("ten_nguoi_ban")
        invoice.merchant_tax_code = ocr_data.get("ma_so_thue")
        invoice.invoice_number = ocr_data.get("so_hoa_don")
        invoice.extracted_json = json.dumps(ocr_data, ensure_ascii=False)
        invoice.ocr_confidence = Decimal(str(ocr_data.get("do_tin_cay", 0.85)))
        invoice.status = "REVIEW_REQUIRED"

        ocr_job.progress_percent = 80
        db.commit()

        # ── Lưu từng dòng sản phẩm vào invoice_items ──────────────────────────
        raw_items: list[dict] = ocr_data.get("items", [])
        if raw_items:
            # Xóa items cũ nếu chạy OCR lại
            old_items = db.scalars(
                select(InvoiceItem).where(InvoiceItem.invoice_id == invoice.id)
            ).all()
            for old in old_items:
                db.delete(old)

            for idx, item in enumerate(raw_items, start=1):
                db.add(InvoiceItem(
                    invoice_id=invoice.id,
                    line_no=idx,
                    name=str(item.get("ten_hang", item.get("name", "Không rõ")))[:500],
                    sku=item.get("ma_hang") or item.get("sku"),
                    unit=item.get("don_vi") or item.get("unit"),
                    quantity=_parse_amount(item.get("so_luong") or item.get("quantity")) or None,
                    unit_price=_parse_amount(item.get("don_gia") or item.get("unit_price")) or None,
                    discount_amount=_parse_amount(item.get("giam_gia") or item.get("discount_amount")) or None,
                    tax_amount=_parse_amount(item.get("thue") or item.get("tax_amount")) or None,
                    line_total=_parse_amount(item.get("thanh_tien") or item.get("line_total")) or None,
                    confidence=Decimal(str(item.get("do_tin_cay", 0.85))),
                    raw_text=str(item.get("raw_text", ""))[:1000] or None,
                ))

        processing_ms = int((time() - started) * 1000)
        ocr_job.status = "COMPLETED"
        ocr_job.progress_percent = 100
        ocr_job.completed_at = datetime.now(timezone.utc)
        ocr_job.processing_ms = processing_ms
        ocr_job.response_json = invoice.extracted_json

        db.commit()

        return {
            "success": True,
            "invoice_id": str(invoice.id),
            "processing_ms": processing_ms,
            "items_extracted": len(raw_items),
            "result": ocr_data,
        }

    except Exception as e:
        processing_ms = int((time() - started) * 1000)
        invoice.status = "FAILED"
        ocr_job.status = "FAILED"
        ocr_job.error_message = str(e)
        ocr_job.completed_at = datetime.now(timezone.utc)
        ocr_job.processing_ms = processing_ms
        ocr_job.progress_percent = 0
        db.commit()
        raise HTTPException(status_code=500, detail=f"OCR thất bại: {str(e)}")


# ─────────────────────────────────────────────
# Confirm & Delete
# ─────────────────────────────────────────────

@router.post("/{invoice_id}/confirm", status_code=201)
def confirm_invoice(
    invoice_id: uuid.UUID,
    payload: InvoiceConfirm,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Xác nhận hóa đơn → tự động tạo giao dịch tài chính với source=OCR."""
    invoice = db.scalar(
        select(Invoice).where(Invoice.id == invoice_id, Invoice.user_id == user.id)
    )
    if not invoice:
        raise HTTPException(status_code=404, detail="Không tìm thấy hóa đơn")
    if invoice.status not in ("REVIEW_REQUIRED", "UPLOADED"):
        raise HTTPException(status_code=400, detail="Hóa đơn chưa ở trạng thái có thể xác nhận")

    desc = (invoice.merchant_name or f"Hóa đơn {invoice.invoice_number or ''}").strip() or "Hóa đơn OCR"

    txn = create_transaction(
        db=db,
        user_id=user.id,
        source=TransactionSource.OCR,   # ← Đánh dấu giao dịch đến từ OCR
        account_id=payload.account_id,
        category_id=payload.category_id,
        description=desc,
        amount=invoice.total_amount or Decimal("0"),
        type=TransactionType.EXPENSE,
        transaction_date=invoice.invoice_date or datetime.now().date(),
        note=payload.note,
        invoice_id=invoice.id,
    )

    invoice.status = "CONFIRMED"
    invoice.confirmed_at = datetime.now(timezone.utc)
    invoice.account_id = payload.account_id
    invoice.category_id = payload.category_id
    db.commit()

    return {"success": True, "transaction_id": str(txn.id)}


@router.delete("/{invoice_id}", status_code=204)
def delete_invoice(
    invoice_id: uuid.UUID,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Xóa hóa đơn kèm file trên đĩa, OCR jobs và invoice items."""
    invoice = db.scalar(
        select(Invoice).where(Invoice.id == invoice_id, Invoice.user_id == user.id)
    )
    if not invoice:
        raise HTTPException(status_code=404, detail="Không tìm thấy hóa đơn")

    # Xóa file vật lý
    try:
        if invoice.storage_key:
            Path(settings.upload_dir, invoice.storage_key).unlink(missing_ok=True)
    except Exception:
        pass

    # Xóa items và OCR jobs liên quan
    for item in db.scalars(select(InvoiceItem).where(InvoiceItem.invoice_id == invoice.id)).all():
        db.delete(item)
    for job in db.scalars(select(OcrJob).where(OcrJob.invoice_id == invoice.id)).all():
        db.delete(job)

    db.delete(invoice)
    db.commit()
