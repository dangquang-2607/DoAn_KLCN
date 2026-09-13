"""
Invoice routes — upload, OCR bằng Gemini AI, xác nhận hóa đơn, xóa an toàn.
Tính năng:
  - Upload hóa đơn → trạng thái UPLOADED (Chờ quét), người dùng tự bấm Quét AI.
  - Quét đơn lẻ / hàng loạt (tối đa 5/lần) với Rate Limiter 15/phút.
  - Phát hiện hóa đơn trùng lặp (Duplicate Detection).
  - Xóa đơn lẻ & xóa hàng loạt (không giới hạn) — an toàn tuyệt đối với SQL Server FK.
  - Xác nhận hóa đơn: lưu lại dữ liệu người dùng đã chỉnh sửa, tạo giao dịch chi tiêu đúng số tiền.
  - Phục vụ tệp xem trước an toàn (GET /invoices/{id}/file).
"""
import json
import uuid
import re
from datetime import datetime, timezone, date
from decimal import Decimal
from pathlib import Path
from time import time

from fastapi import APIRouter, Depends, File, HTTPException, Query, Request, UploadFile
from fastapi.responses import FileResponse
from sqlalchemy import select, func, delete, update
from sqlalchemy.orm import Session

from app.api.dependencies import get_current_user, get_db
from app.core.config import settings
from app.core.limiter import limiter
from app.models.invoice import Invoice
from app.models.invoice_item import InvoiceItem
from app.models.ocr_job import OcrJob
from app.models.transaction import Transaction, TransactionSource, TransactionType
from app.models.user import User
from app.schemas.invoice import (
    InvoiceConfirm,
    InvoiceListOut,
    InvoiceOut,
    InvoicePage,
    InvoiceItemOut,
    InvoiceBatchDelete,
    InvoiceBatchOcr,
)
from app.services.gemini_service import run_gemini_ocr
from app.services.jobs import enqueue
from app.services.transaction_service import create_transaction

router = APIRouter(prefix="/invoices", tags=["Invoices"])

ALLOWED_MIME = {"image/jpeg", "image/png", "image/webp", "application/pdf"}
ALLOWED_EXT = {".jpg", ".jpeg", ".png", ".webp", ".pdf"}
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10 MB
MAX_BATCH_OCR = 5  # Tối đa 5 hóa đơn / lần quét hàng loạt


# ─── Helper: Parse amount & date ────────────────────────────────────────────

def _parse_amount(raw: any) -> Decimal:
    """Chuẩn hóa chuỗi số tiền Việt Nam / Quốc tế sang Decimal an toàn."""
    if raw is None:
        return Decimal("0")
    s = str(raw).strip().replace("đ", "").replace("VND", "").replace("vnd", "").replace(" ", "")
    if not s:
        return Decimal("0")
    if len(s) > 64 or not re.fullmatch(r"-?[0-9]+(?:[.,][0-9]+)*", s):
        raise ValueError("Invalid OCR numeric value")

    # Kiểu VN phân cách nghìn: 1.234.567 hoặc 1,234,567
    if re.match(r"^-?\d{1,3}([.,]\d{3})+$", s):
        s = re.sub(r"[.,]", "", s)
    # Kiểu thập phân: 10,5 -> 10.5
    elif re.match(r"^-?\d+[.,]\d{1,2}$", s):
        s = s.replace(",", ".")
    else:
        if "," in s and "." in s:
            s = s.replace(",", "")
        elif s.count(".") > 1:
            s = s.replace(".", "")
        elif s.count(",") > 1:
            s = s.replace(",", "")

    try:
        return Decimal(s)
    except Exception as exc:
        raise ValueError("Invalid OCR numeric value") from exc


def _parse_date(raw: any) -> date | None:
    """Phân tích ngày tháng đa định dạng."""
    if not raw:
        return None
    s = str(raw).strip()
    for fmt in ("%d/%m/%Y", "%Y-%m-%d", "%d-%m-%Y", "%d/%m/%y", "%Y/%m/%d"):
        try:
            return datetime.strptime(s, fmt).date()
        except ValueError:
            continue
    return None


# ─── Helper: Xóa hóa đơn an toàn (tái sử dụng cho cả đơn lẻ & hàng loạt) ──

def _safe_delete_invoice(db: Session, invoice: Invoice) -> None:
    """
    Xóa hóa đơn an toàn tuyệt đối với SQL Server:
    1. Gỡ liên kết Transaction.invoice_id để tránh FK constraint.
    2. Xóa InvoiceItem và OcrJob liên quan.
    3. db.flush() để commit thứ tự SQL đúng thứ tự.
    4. Xóa file vật lý.
    5. Xóa bản ghi Invoice.
    """
    # 1. Gỡ FK từ transactions
    db.execute(
        update(Transaction)
        .where(Transaction.invoice_id == invoice.id)
        .values(invoice_id=None)
    )
    # 2. Xóa bảng con
    db.execute(delete(InvoiceItem).where(InvoiceItem.invoice_id == invoice.id))
    db.execute(delete(OcrJob).where(OcrJob.invoice_id == invoice.id))
    # 3. Flush để SQL Server xử lý đúng thứ tự trước khi xóa cha
    db.flush()
    if invoice.storage_key:
        enqueue(db, "FILE_DELETE", {"storage_key": invoice.storage_key}, "delete-file:"+invoice.storage_key)
    # 5. Xóa bản ghi
    db.delete(invoice)


# ─── Helper: Phát hiện hóa đơn trùng lặp ───────────────────────────────────

def _check_duplicate(db: Session, user_id: uuid.UUID, invoice: Invoice) -> tuple[bool, str | None]:
    """
    Kiểm tra hóa đơn này có bị trùng với hóa đơn đã xác nhận CONFIRMED nào không.
    Tiêu chí trùng: cùng merchant_tax_code + invoice_number, hoặc cùng merchant_name + invoice_date + total_amount.
    """
    if invoice.merchant_tax_code and invoice.invoice_number:
        dup = db.scalar(
            select(Invoice).where(
                Invoice.user_id == user_id,
                Invoice.id != invoice.id,
                Invoice.status == "CONFIRMED",
                Invoice.merchant_tax_code == invoice.merchant_tax_code,
                Invoice.invoice_number == invoice.invoice_number,
            )
        )
        if dup:
            return True, f"Trùng số hóa đơn {invoice.invoice_number} từ MST {invoice.merchant_tax_code} (đã xác nhận ngày {dup.confirmed_at})"

    if invoice.merchant_name and invoice.invoice_date and invoice.total_amount:
        dup = db.scalar(
            select(Invoice).where(
                Invoice.user_id == user_id,
                Invoice.id != invoice.id,
                Invoice.status == "CONFIRMED",
                Invoice.merchant_name == invoice.merchant_name,
                Invoice.invoice_date == invoice.invoice_date,
                Invoice.total_amount == invoice.total_amount,
            )
        )
        if dup:
            return True, f"Trùng hóa đơn từ '{invoice.merchant_name}' ngày {invoice.invoice_date} số tiền {invoice.total_amount:,.0f} VND"

    return False, None


# ─── Upload & List ────────────────────────────────────────────────────────────

@router.post(
    "",
    status_code=201,
    summary="Tải lên hóa đơn (Upload Invoice)",
    description="Tải lên tệp hóa đơn (JPG, PNG, WEBP, PDF — tối đa 10MB). Tạo bản ghi UPLOADED, chờ người dùng bấm Quét AI.",
)
def upload_invoice(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    ext = Path(file.filename or "").suffix.lower()
    if ext not in ALLOWED_EXT:
        raise HTTPException(status_code=400, detail=f"Định dạng không hỗ trợ: {ext}")

    contents = file.file.read(MAX_FILE_SIZE + 1)
    if len(contents) > MAX_FILE_SIZE:
        raise HTTPException(status_code=413, detail="File quá lớn (tối đa 10 MB)")

    actual_mime = (
        "application/pdf" if contents.startswith(b"%PDF-") else
        "image/png" if contents.startswith(b"\x89PNG\r\n\x1a\n") else
        "image/jpeg" if contents.startswith(b"\xff\xd8\xff") else
        "image/webp" if contents[:4]==b"RIFF" and contents[8:12]==b"WEBP" else None
    )
    expected = {".pdf":"application/pdf", ".png":"image/png", ".jpg":"image/jpeg", ".jpeg":"image/jpeg", ".webp":"image/webp"}
    if actual_mime != expected[ext]:
        raise HTTPException(status_code=415, detail="Nội dung file không khớp định dạng")
    stored_name = f"{uuid.uuid4()}{ext}"
    upload_path = Path(settings.upload_dir) / stored_name
    upload_path.parent.mkdir(parents=True, exist_ok=True)
    upload_path.write_bytes(contents)

    invoice = Invoice(
        user_id=user.id,
        original_filename=Path(file.filename or stored_name).name[:255],
        storage_key=stored_name,
        mime_type=actual_mime,
        file_size_bytes=len(contents),
        source="UPLOAD",
        status="UPLOADED",
    )
    try:
        db.add(invoice)
        db.flush()
    except Exception:
        db.rollback()
        upload_path.unlink(missing_ok=True)
        raise
    # A failed commit acknowledgement can still mean SQL Server committed.
    # Keep the file on uncertain commit/refresh failures to avoid a dangling row.
    db.commit()
    db.refresh(invoice)
    return {
        "id": str(invoice.id),
        "filename": invoice.original_filename,
        "status": invoice.status,
        "mime_type": invoice.mime_type,
        "created_at": invoice.created_at.isoformat(),
    }


@router.get(
    "",
    response_model=InvoicePage,
    summary="Danh sách hóa đơn (List Invoices)",
    description="Lấy danh sách hóa đơn phân trang và lọc theo trạng thái.",
)
def list_invoices(
    page: int = Query(1, ge=1, description="Số trang"),
    page_size: int = Query(50, ge=1, le=100, description="Số bản ghi mỗi trang"),
    status: str | None = Query(None, description="Trạng thái lọc"),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    q = select(Invoice).where(Invoice.user_id == user.id)
    if status:
        q = q.where(Invoice.status == status.upper())
    q = q.order_by(Invoice.created_at.desc())

    count_q = select(func.count()).select_from(q.subquery())
    total = db.scalar(count_q) or 0
    items = db.scalars(q.offset((page - 1) * page_size).limit(page_size)).all()

    return InvoicePage(items=items, total=total, page=page, page_size=page_size)


@router.get(
    "/{invoice_id}",
    response_model=InvoiceOut,
    summary="Chi tiết hóa đơn (Get Invoice Details)",
    description="Lấy thông tin chi tiết hóa đơn kèm danh sách mặt hàng và cờ trùng lặp.",
)
def get_invoice(
    invoice_id: uuid.UUID,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
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

    is_dup, dup_reason = _check_duplicate(db, user.id, invoice)

    result = InvoiceOut.model_validate(invoice)
    result.items = [InvoiceItemOut.model_validate(it) for it in items]
    result.is_duplicate = is_dup
    result.duplicate_reason = dup_reason
    return result


@router.get(
    "/{invoice_id}/file",
    summary="Xem tệp hóa đơn gốc (Get Invoice Physical File)",
    description="Trả về tệp ảnh hoặc PDF gốc của hóa đơn để xem trước trên giao diện.",
)
def get_invoice_file(
    invoice_id: uuid.UUID,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    invoice = db.scalar(
        select(Invoice).where(Invoice.id == invoice_id, Invoice.user_id == user.id)
    )
    if not invoice or not invoice.storage_key:
        raise HTTPException(status_code=404, detail="Không tìm thấy hóa đơn")

    file_path = Path(settings.upload_dir) / invoice.storage_key
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="Tệp vật lý không tồn tại trên máy chủ")

    return FileResponse(
        path=file_path,
        media_type=invoice.mime_type or "application/octet-stream",
        filename=invoice.original_filename or f"invoice_{invoice_id}",
    )


@router.get(
    "/{invoice_id}/items",
    response_model=list[InvoiceItemOut],
    summary="Danh sách mặt hàng của hóa đơn (List Invoice Items)",
    description="Lấy danh sách các mặt hàng chi tiết của hóa đơn.",
)
def get_invoice_items(
    invoice_id: uuid.UUID,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
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


# ─── OCR — Gemini AI ───────────────────────────────────────────────────────

def _enqueue_ocr(db, invoice_id, user_id):
    invoice = db.scalar(select(Invoice).where(Invoice.id==invoice_id, Invoice.user_id==user_id).with_hint(
        Invoice, "WITH (UPDLOCK, ROWLOCK)", dialect_name="mssql").execution_options(populate_existing=True))
    if not invoice:
        raise HTTPException(status_code=404, detail="Không tìm thấy hóa đơn")
    if invoice.status == "CONFIRMED":
        raise HTTPException(status_code=409, detail="Hóa đơn đã xác nhận")
    if invoice.status == "PROCESSING":
        return {"id":str(invoice.id), "success":True, "queued":True}
    job=OcrJob(id=uuid.uuid4(),user_id=user_id,invoice_id=invoice.id,status="QUEUED",provider="google_gemini",model_name=settings.google_ai_model)
    db.add(job);invoice.status="PROCESSING";db.flush()
    enqueue(db,"OCR",{"invoice_id":str(invoice.id),"user_id":str(user_id),"ocr_job_id":str(job.id)},"ocr:"+str(job.id))
    return {"id":str(invoice.id),"success":True,"queued":True,"job_id":str(job.id)}


@router.post("/{invoice_id}/ocr", status_code=202)
@limiter.limit("15/minute")
def run_ocr(request: Request, invoice_id: uuid.UUID, db: Session=Depends(get_db), user: User=Depends(get_current_user)):
    result=_enqueue_ocr(db,invoice_id,user.id)
    db.commit()
    return result


@router.post("/batch-ocr", status_code=202)
@limiter.limit("15/minute")
def batch_ocr(request: Request, payload: InvoiceBatchOcr, db: Session=Depends(get_db), user: User=Depends(get_current_user)):
    results=[]
    for invoice_id in sorted(set(payload.invoice_ids),key=str):
        # Savepoints keep one invalid invoice from rolling back another queued invoice.
        try:
            with db.begin_nested(): results.append(_enqueue_ocr(db,invoice_id,user.id))
        except HTTPException as exc:
            results.append({"id":str(invoice_id),"success":False,"error":exc.detail})
    db.commit()
    return {"results":results,"success_count":sum(r["success"] for r in results),"failed_count":sum(not r["success"] for r in results)}


@router.post(
    "/{invoice_id}/confirm",
    status_code=201,
    summary="Xác nhận hóa đơn (Confirm Invoice)",
    description="Xác nhận hóa đơn, lưu lại dữ liệu đã chỉnh sửa và tự động tạo giao dịch EXPENSE vào Sổ cái.",
)
def confirm_invoice(
    invoice_id: uuid.UUID,
    payload: InvoiceConfirm,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    invoice = db.scalar(
        select(Invoice).where(Invoice.id == invoice_id, Invoice.user_id == user.id).with_hint(Invoice, "WITH (UPDLOCK, ROWLOCK)", dialect_name="mssql").execution_options(populate_existing=True)
    )
    if not invoice:
        raise HTTPException(status_code=404, detail="Không tìm thấy hóa đơn")
    existing = db.scalar(select(Transaction).where(Transaction.invoice_id == invoice.id, Transaction.user_id == user.id))
    if existing:
        if invoice.status != "CONFIRMED":
            invoice.status = "CONFIRMED"
            invoice.confirmed_at = invoice.confirmed_at or datetime.now(timezone.utc)
            invoice.account_id = existing.account_id
            invoice.category_id = existing.category_id
            db.commit()
        return {"success": True, "transaction_id": str(existing.id)}
    if invoice.status not in ("REVIEW_REQUIRED", "UPLOADED", "FAILED"):
        raise HTTPException(status_code=400, detail=f"Hóa đơn ở trạng thái '{invoice.status}' không thể xác nhận")

    # Lưu lại dữ liệu người dùng đã chỉnh sửa trên form OCR
    if payload.merchant_name is not None:
        invoice.merchant_name = payload.merchant_name
    if payload.invoice_date is not None:
        invoice.invoice_date = payload.invoice_date
    if payload.invoice_number is not None:
        invoice.invoice_number = payload.invoice_number
    if payload.merchant_tax_code is not None:
        invoice.merchant_tax_code = payload.merchant_tax_code
    if payload.subtotal_amount is not None:
        invoice.subtotal_amount = payload.subtotal_amount
    if payload.tax_amount is not None:
        invoice.tax_amount = payload.tax_amount
    if payload.total_amount is not None:
        invoice.total_amount = payload.total_amount

    # Dùng số tiền đã được người dùng xác nhận (có thể đã sửa)
    final_amount = invoice.total_amount or Decimal("0")
    desc = (invoice.merchant_name or f"Hóa đơn {invoice.invoice_number or ''}").strip() or "Hóa đơn OCR"

    txn = create_transaction(
        db=db,
        user_id=user.id,
        source=TransactionSource.OCR,
        commit=False,
        account_id=payload.account_id,
        category_id=payload.category_id,
        description=desc,
        amount=final_amount,
        type=TransactionType.EXPENSE,
        transaction_date=invoice.invoice_date or datetime.now().date(),
        note=payload.note,
        invoice_id=invoice.id,
    )

    invoice.status = "CONFIRMED"
    invoice.confirmed_at = datetime.now(timezone.utc)
    invoice.account_id = payload.account_id
    invoice.category_id = payload.category_id
    enqueue(db, "BUDGET", {"user_id": str(user.id), "transaction_id": str(txn.id)}, "budget-check:" + str(txn.id))
    db.commit()

    return {"success": True, "transaction_id": str(txn.id)}


@router.delete(
    "/{invoice_id}",
    status_code=204,
    summary="Xóa hóa đơn đơn lẻ (Delete Invoice)",
    description="Xóa vĩnh viễn hóa đơn, tệp vật lý, và tự động gỡ liên kết giao dịch — an toàn tuyệt đối với SQL Server FK.",
)
def delete_invoice(
    invoice_id: uuid.UUID,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    invoice = db.scalar(
        select(Invoice).where(Invoice.id == invoice_id, Invoice.user_id == user.id)
    )
    if not invoice:
        raise HTTPException(status_code=404, detail="Không tìm thấy hóa đơn")

    _safe_delete_invoice(db, invoice)
    db.commit()


@router.post(
    "/batch-delete",
    status_code=200,
    summary="Xóa hàng loạt hóa đơn (Batch Delete Invoices)",
    description="Xóa nhiều hóa đơn cùng lúc — không giới hạn số lượng, xóa an toàn tuyệt đối.",
)
def batch_delete_invoices(
    payload: InvoiceBatchDelete,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    if len(payload.invoice_ids) == 0:
        raise HTTPException(status_code=400, detail="Danh sách hóa đơn không được rỗng")

    deleted = 0
    not_found = []
    for inv_id in payload.invoice_ids:
        invoice = db.scalar(
            select(Invoice).where(Invoice.id == inv_id, Invoice.user_id == user.id)
        )
        if not invoice:
            not_found.append(str(inv_id))
            continue
        _safe_delete_invoice(db, invoice)
        deleted += 1

    db.commit()
    return {
        "success": True,
        "deleted": deleted,
        "not_found": not_found,
    }
