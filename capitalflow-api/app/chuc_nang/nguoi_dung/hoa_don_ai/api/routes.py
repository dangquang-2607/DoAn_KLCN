"""
Các route tải lên, OCR bằng Gemini AI, xác nhận và xóa hóa đơn an toàn.
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
from datetime import datetime, timezone
from decimal import Decimal
from pathlib import Path
from time import time

from fastapi import APIRouter, Depends, File, HTTPException, Query, Request, UploadFile
from fastapi.responses import FileResponse
from sqlalchemy import select, func, delete
from sqlalchemy.orm import Session

from app.dung_chung.http.phu_thuoc import get_current_user, get_db
from app.dung_chung.config import settings
from app.dung_chung.http.gioi_han_tan_suat import limiter
from app.chuc_nang.nguoi_dung.hoa_don_ai.luu_tru.invoice import Invoice
from app.chuc_nang.nguoi_dung.hoa_don_ai.luu_tru.invoice_item import InvoiceItem
from app.chuc_nang.nguoi_dung.hoa_don_ai.luu_tru.tac_vu_ocr import OcrJob
from app.chuc_nang.nguoi_dung.tai_chinh.giao_dich.luu_tru.giao_dich import Transaction, TransactionSource, TransactionType
from app.chuc_nang.nguoi_dung.dang_nhap.luu_tru.nguoi_dung import User
from app.chuc_nang.nguoi_dung.hoa_don_ai.schemas.invoice import (
    InvoiceConfirm,
    InvoiceListOut,
    InvoiceOut,
    InvoicePage,
    InvoiceItemOut,
    InvoiceItemsUpdate,
    InvoiceBatchDelete,
    InvoiceBatchOcr,
)
from app.dung_chung.tac_vu_nen.hang_doi import enqueue
from app.chuc_nang.nguoi_dung.tai_chinh.giao_dich.so_cai import create_transaction
from app.chuc_nang.nguoi_dung.danh_muc.phan_loai import suggest_category
from app.chuc_nang.nguoi_dung.hoa_don_ai.nghiep_vu.deletion import safe_delete_invoice as _safe_delete_invoice
from app.chuc_nang.nguoi_dung.hoa_don_ai.nghiep_vu.phat_hien_trung_lap import check_duplicate as _check_duplicate
from app.chuc_nang.nguoi_dung.hoa_don_ai.nghiep_vu.phan_tich_du_lieu import parse_amount as _parse_amount
from app.chuc_nang.nguoi_dung.hoa_don_ai.nghiep_vu.phan_tich_du_lieu import parse_date as _parse_date
from app.chuc_nang.nguoi_dung.hoa_don_ai.ha_tang.gemini import run_gemini_ocr
from app.chuc_nang.nguoi_dung.hoa_don_ai.ha_tang.invoice_xml import parse_invoice_xml

router = APIRouter(prefix="/invoices", tags=["Invoices"])

ALLOWED_MIME = {"image/jpeg", "image/png", "image/webp", "application/pdf", "application/xml"}
ALLOWED_EXT = {".jpg", ".jpeg", ".png", ".webp", ".pdf", ".xml"}
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10 MB
MAX_BATCH_OCR = 5  # Tối đa 5 hóa đơn / lần quét hàng loạt


# ─── Upload và danh sách ──────────────────────────────────────────────────────

@router.post(
    "",
    status_code=201,
    summary="Tải lên hóa đơn (Upload Invoice)",
    description="Tải lên tệp hóa đơn (JPG, PNG, WEBP, PDF, XML — tối đa 10MB). XML được đọc trực tiếp; ảnh/PDF chờ người dùng bấm Quét AI.",
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
        "image/webp" if contents[:4]==b"RIFF" and contents[8:12]==b"WEBP" else
        "application/xml" if ext == ".xml" and contents.lstrip(b"\xef\xbb\xbf \t\r\n").startswith(b"<") else None
    )
    expected = {".pdf":"application/pdf", ".png":"image/png", ".jpg":"image/jpeg", ".jpeg":"image/jpeg", ".webp":"image/webp", ".xml":"application/xml"}
    if actual_mime != expected[ext]:
        raise HTTPException(status_code=415, detail="Nội dung file không khớp định dạng")
    stored_name = f"{uuid.uuid4()}{ext}"
    upload_path = Path(settings.upload_dir) / stored_name
    upload_path.parent.mkdir(parents=True, exist_ok=True)
    upload_path.write_bytes(contents)

    xml_data = None
    if actual_mime == "application/xml":
        try:
            xml_data = parse_invoice_xml(contents)
        except ValueError as exc:
            upload_path.unlink(missing_ok=True)
            raise HTTPException(status_code=422, detail=str(exc)) from exc

    invoice = Invoice(
        user_id=user.id,
        original_filename=Path(file.filename or stored_name).name[:255],
        storage_key=stored_name,
        mime_type=actual_mime,
        file_size_bytes=len(contents),
        # Nguồn nhập dữ liệu phải thuộc CK_invoices_source; định dạng nằm ở mime_type.
        source="IMPORT" if xml_data else "UPLOAD",
        status="REVIEW_REQUIRED" if xml_data else "UPLOADED",
        **({key: value for key, value in xml_data.items() if key != "items"} if xml_data else {}),
    )
    try:
        db.add(invoice)
        db.flush()
        if xml_data:
            db.add_all([
                InvoiceItem(invoice_id=invoice.id, line_no=index, **item)
                for index, item in enumerate(xml_data["items"], start=1)
            ])
    except Exception:
        db.rollback()
        upload_path.unlink(missing_ok=True)
        raise
    # Không nhận được xác nhận commit vẫn có thể nghĩa là SQL Server đã commit.
    # Giữ file khi kết quả commit/refresh không chắc chắn để tránh bản ghi bị treo.
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


@router.put(
    "/{invoice_id}/items",
    response_model=list[InvoiceItemOut],
    summary="Cập nhật mặt hàng hóa đơn (Update Invoice Items)",
    description="Thay thế danh sách mặt hàng OCR bằng dữ liệu người dùng đã kiểm tra và hiệu chỉnh.",
)
def update_invoice_items(
    invoice_id: uuid.UUID,
    payload: InvoiceItemsUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    invoice = db.scalar(
        select(Invoice)
        .where(Invoice.id == invoice_id, Invoice.user_id == user.id)
        .with_hint(Invoice, "WITH (UPDLOCK, ROWLOCK)", dialect_name="mssql")
        .execution_options(populate_existing=True)
    )
    if not invoice:
        raise HTTPException(status_code=404, detail="Không tìm thấy hóa đơn")
    if invoice.status in {"CONFIRMED", "PROCESSING"}:
        raise HTTPException(status_code=409, detail="Không thể sửa mặt hàng khi hóa đơn đang xử lý hoặc đã ghi sổ")

    db.execute(delete(InvoiceItem).where(InvoiceItem.invoice_id == invoice.id))
    edited_items = [
        InvoiceItem(
            invoice_id=invoice.id,
            line_no=line_no,
            name=item.name.strip(),
            sku=item.sku.strip() if item.sku else None,
            unit=item.unit.strip() if item.unit else None,
            quantity=item.quantity,
            unit_price=item.unit_price,
            discount_amount=item.discount_amount,
            tax_amount=item.tax_amount,
            line_total=item.line_total,
        )
        for line_no, item in enumerate(payload.items, start=1)
    ]
    db.add_all(edited_items)
    db.commit()
    for item in edited_items:
        db.refresh(item)
    return edited_items


# ─── OCR bằng Gemini AI ──────────────────────────────────────────────────────

def _enqueue_ocr(db, invoice_id, user_id):
    invoice = db.scalar(select(Invoice).where(Invoice.id==invoice_id, Invoice.user_id==user_id).with_hint(
        Invoice, "WITH (UPDLOCK, ROWLOCK)", dialect_name="mssql").execution_options(populate_existing=True))
    if not invoice:
        raise HTTPException(status_code=404, detail="Không tìm thấy hóa đơn")
    if invoice.status == "CONFIRMED":
        raise HTTPException(status_code=409, detail="Hóa đơn đã xác nhận")
    if invoice.mime_type == "application/xml":
        raise HTTPException(status_code=409, detail="Hóa đơn XML đã được đọc trực tiếp, không cần quét AI")
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
        # Savepoint ngăn một hóa đơn lỗi rollback các hóa đơn khác đã được xếp hàng.
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
    if payload.invoice_symbol is not None:
        invoice.invoice_symbol = payload.invoice_symbol
    if payload.merchant_tax_code is not None:
        invoice.merchant_tax_code = payload.merchant_tax_code
    if payload.merchant_address is not None:
        invoice.merchant_address = payload.merchant_address
    for field in ("vat_rate", "payment_method"):
        value = getattr(payload, field)
        if value is not None:
            setattr(invoice, field, value)
    if payload.subtotal_amount is not None:
        invoice.subtotal_amount = payload.subtotal_amount
    if payload.tax_amount is not None:
        invoice.tax_amount = payload.tax_amount
    if payload.total_amount is not None:
        invoice.total_amount = payload.total_amount
    invoice.note = payload.note.strip() if payload.note and payload.note.strip() else None
    if payload.items is not None:
        db.execute(delete(InvoiceItem).where(InvoiceItem.invoice_id == invoice.id))
        db.add_all([
            InvoiceItem(
                invoice_id=invoice.id,
                line_no=line_no,
                name=item.name.strip(),
                sku=item.sku.strip() if item.sku else None,
                unit=item.unit.strip() if item.unit else None,
                quantity=item.quantity,
                unit_price=item.unit_price,
                discount_amount=item.discount_amount,
                tax_amount=item.tax_amount,
                line_total=item.line_total,
            )
            for line_no, item in enumerate(payload.items, start=1)
        ])

    # Dùng số tiền đã được người dùng xác nhận (có thể đã sửa)
    final_amount = invoice.total_amount or Decimal("0")
    desc = (invoice.merchant_name or f"Hóa đơn {invoice.invoice_number or ''}").strip() or "Hóa đơn OCR"

    category_id = payload.category_id
    category_metadata = {}
    if category_id:
        category_metadata = {
            "category_confidence": Decimal("1.0000"),
            "category_source": "MANUAL",
            "category_was_auto": False,
        }
    else:
        item_names = (
            [item.name for item in payload.items]
            if payload.items is not None
            else list(db.scalars(select(InvoiceItem.name).where(InvoiceItem.invoice_id == invoice.id)))
        )
        suggestion = suggest_category(
            db,
            user.id,
            TransactionType.EXPENSE,
            description=desc,
            note=payload.note,
            item_names=item_names,
        )
        if suggestion.auto_apply:
            category_id = suggestion.category_id
            category_metadata = {
                "category_confidence": suggestion.confidence,
                "category_source": suggestion.source,
                "category_was_auto": True,
            }

    txn = create_transaction(
        db=db,
        user_id=user.id,
        source=TransactionSource.OCR,
        commit=False,
        account_id=payload.account_id,
        category_id=category_id,
        description=desc,
        amount=final_amount,
        type=TransactionType.EXPENSE,
        transaction_date=invoice.invoice_date or datetime.now().date(),
        note=payload.note,
        invoice_id=invoice.id,
        **category_metadata,
    )

    invoice.status = "CONFIRMED"
    invoice.confirmed_at = datetime.now(timezone.utc)
    invoice.account_id = payload.account_id
    invoice.category_id = category_id
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
