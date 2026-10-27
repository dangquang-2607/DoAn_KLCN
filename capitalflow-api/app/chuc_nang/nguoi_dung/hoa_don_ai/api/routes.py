"""
Các route tải lên, OCR bằng Gemini AI, xác nhận và xóa hóa đơn an toàn.
Tính năng:
  - Upload → kiểm tra tạm SHA/OCR/trùng → bản mới REVIEW_REQUIRED hoặc trả bản cũ.
  - Quét đơn lẻ / hàng loạt (tối đa 5/lần) với Rate Limiter 15/phút.
  - Phát hiện hóa đơn trùng lặp (Duplicate Detection).
  - Xóa đơn lẻ & xóa hàng loạt (không giới hạn) — an toàn tuyệt đối với SQL Server FK.
  - Xác nhận hóa đơn: lưu lại dữ liệu người dùng đã chỉnh sửa, tạo giao dịch chi tiêu đúng số tiền.
  - Phục vụ tệp xem trước an toàn (GET /invoices/{id}/file).
"""
import uuid
from pathlib import Path
from typing import Annotated, Literal
from types import SimpleNamespace

from fastapi import APIRouter, Depends, File, HTTPException, Query, Request, UploadFile, Form, Response
from fastapi.responses import FileResponse
from sqlalchemy import select, func, delete
from sqlalchemy.orm import Session

from app.dung_chung.http.phu_thuoc import get_current_user, get_db
from app.dung_chung.config import settings
from app.dung_chung.http.gioi_han_tan_suat import limiter
from app.chuc_nang.nguoi_dung.hoa_don_ai.luu_tru.invoice import Invoice
from app.chuc_nang.nguoi_dung.hoa_don_ai.luu_tru.invoice_item import InvoiceItem
from app.chuc_nang.nguoi_dung.hoa_don_ai.luu_tru.tac_vu_ocr import OcrJob
from app.chuc_nang.nguoi_dung.tai_chinh.giao_dich.luu_tru.giao_dich import Transaction
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
    InvoiceDuplicateCheck, InvoiceResolution, InvoiceRestore,
)
from app.dung_chung.tac_vu_nen.hang_doi import enqueue
from app.chuc_nang.nguoi_dung.hoa_don_ai.nghiep_vu.deletion import safe_delete_invoice as _safe_delete_invoice
from app.chuc_nang.nguoi_dung.hoa_don_ai.nghiep_vu.phat_hien_trung_lap import check_duplicate as _check_duplicate, inspect_duplicates, inspect_duplicate_batch
from app.chuc_nang.nguoi_dung.hoa_don_ai.nghiep_vu.chuan_hoa_hoa_don import parse_invoice_time
from app.chuc_nang.nguoi_dung.hoa_don_ai.nghiep_vu.vong_doi import lock_invoice, require_visible, check_revision, record_event, conflict
from app.chuc_nang.nguoi_dung.hoa_don_ai.nghiep_vu.luy_dang import begin_operation, finish_operation
from app.chuc_nang.nguoi_dung.dang_nhap.nghiep_vu.session_management import locked_user
from app.chuc_nang.nguoi_dung.hoa_don_ai.nghiep_vu.phan_tich_du_lieu import parse_amount as _parse_amount
from app.chuc_nang.nguoi_dung.hoa_don_ai.nghiep_vu.phan_tich_du_lieu import parse_date as _parse_date
from app.chuc_nang.nguoi_dung.hoa_don_ai.ha_tang.invoice_xml import parse_invoice_xml

from .telemetry import InvoiceMetricsRoute
from ..nghiep_vu.deletion import trash_expired, trash_expires_at, purge_invoice

router = APIRouter(prefix="/invoices", tags=["Invoices"], route_class=InvoiceMetricsRoute)

ALLOWED_MIME = {"image/jpeg", "image/png", "image/webp", "application/pdf", "application/xml"}
ALLOWED_EXT = {".jpg", ".jpeg", ".png", ".webp", ".pdf", ".xml"}
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10 MB
MAX_BATCH_OCR = 5  # Tối đa 5 hóa đơn / lần quét hàng loạt


# ─── Upload và danh sách ──────────────────────────────────────────────────────

@router.post(
    "",
    status_code=201,
    summary="Tải lên hóa đơn (Upload Invoice)",
    description="Kiểm tra SHA-256, nhận diện và đối chiếu trước khi tạo hóa đơn. XML đọc trực tiếp; ảnh/PDF tự OCR. Bản mới ở trạng thái chờ kiểm tra.",
)
def upload_invoice(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    source: Annotated[Literal["UPLOAD", "CAMERA"], Form()] = "UPLOAD",
    upload_ticket: Annotated[str | None, Form(max_length=2000000)] = None,
    accept_distinct: Annotated[bool, Form()] = False,
    response: Response = None,
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
    xml_data = None
    if actual_mime == "application/xml":
        try:
            xml_data = parse_invoice_xml(contents)
        except ValueError as exc:
            raise HTTPException(status_code=422, detail=str(exc)) from exc
    from app.chuc_nang.nguoi_dung.hoa_don_ai.nghiep_vu.tai_len import upload
    result, created = upload(db, user, contents, file.filename, ext, actual_mime, source, xml_data, upload_ticket, accept_distinct)
    if response is not None:
        response.status_code = 201 if created else 200
    return result


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
    visibility: Literal["active", "hidden", "trash"] = "active",
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    q = select(Invoice).where(Invoice.user_id == user.id,
        Invoice.deleted_at.is_not(None) if visibility in {"hidden", "trash"} else Invoice.deleted_at.is_(None))
    if status:
        q = q.where(Invoice.status == status.upper())
    q = q.order_by(Invoice.created_at.desc())

    count_q = select(func.count()).select_from(q.subquery())
    total = db.scalar(count_q) or 0
    items = db.scalars(q.offset((page - 1) * page_size).limit(page_size)).all()

    checks = inspect_duplicate_batch(db, user.id, items)
    summaries = []
    for item in items:
        summary = InvoiceListOut.model_validate(item)
        summary.trash_expires_at = trash_expires_at(item)
        summary.can_restore = bool(item.deleted_at and not trash_expired(item))
        summary.duplicate_level = checks[item.id]["level"]
        summary.duplicate_candidate_count = checks[item.id]["candidate_count"]
        summary.duplicate_similarity_percent = checks[item.id]["similarity_percent"]
        summary.duplicate_match_id = checks[item.id]["candidates"][0]["invoice_id"] if checks[item.id]["candidates"] else None
        summaries.append(summary)
    return InvoicePage(items=summaries, total=total, page=page, page_size=page_size)


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
    result.trash_expires_at = trash_expires_at(invoice)
    result.can_restore = bool(invoice.deleted_at and not trash_expired(invoice))
    result.items = [InvoiceItemOut.model_validate(it) for it in items]
    result.is_duplicate = is_dup
    result.duplicate_reason = dup_reason
    result.duplicate_check = inspect_duplicates(db, user.id, invoice)
    result.transaction_id = db.scalar(select(Transaction.id).where(Transaction.invoice_id == invoice.id, Transaction.user_id == user.id))
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
    if trash_expired(invoice):
        raise HTTPException(410, detail="Hóa đơn đã hết thời hạn lưu trong Thùng rác.")

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
    invoice = lock_invoice(db, user, invoice_id)
    require_visible(invoice)
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
    invoice.revision += 1
    db.commit()
    for item in edited_items:
        db.refresh(item)
    return edited_items


# ─── OCR bằng Gemini AI ──────────────────────────────────────────────────────

def _enqueue_ocr(db, invoice_id, user_id):
    locked_user(db, user_id)
    invoice = db.scalar(select(Invoice).where(Invoice.id==invoice_id, Invoice.user_id==user_id).with_hint(
        Invoice, "WITH (UPDLOCK, ROWLOCK)", dialect_name="mssql").execution_options(populate_existing=True))
    if not invoice:
        raise HTTPException(status_code=404, detail="Không tìm thấy hóa đơn")
    require_visible(invoice)
    if not invoice.storage_key:
        conflict("INVOICE_FILE_MISSING", "Hãy tải lại ảnh trước khi quét.")
    if invoice.status == "CONFIRMED":
        raise HTTPException(status_code=409, detail="Hóa đơn đã xác nhận")
    if invoice.mime_type == "application/xml":
        raise HTTPException(status_code=409, detail="Hóa đơn XML đã được đọc trực tiếp, không cần quét AI")
    if invoice.status == "PROCESSING":
        return {"id":str(invoice.id), "success":True, "queued":True}
    job=OcrJob(id=uuid.uuid4(),user_id=user_id,invoice_id=invoice.id,status="QUEUED",provider="google_gemini",model_name=settings.google_ai_model)
    db.add(job);invoice.status="PROCESSING";invoice.revision += 1;db.flush()
    enqueue(db,"OCR",{"invoice_id":str(invoice.id),"user_id":str(user_id),"ocr_job_id":str(job.id),"invoice_revision":invoice.revision},"ocr:"+str(job.id))
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
    if settings.independent_wallets_enabled:
        raise HTTPException(409, "Luồng ghi sổ đã thay đổi. Dùng /bookkeeping/invoices/{id}/confirm, không chọn ví.")
    from app.chuc_nang.nguoi_dung.hoa_don_ai.nghiep_vu.xac_nhan_hoa_don import confirm
    return confirm(db, user, invoice_id, payload)


@router.post("/{invoice_id}/duplicate-check")
def preview_duplicates(invoice_id: uuid.UUID, payload: InvoiceDuplicateCheck,
                       db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    invoice = db.scalar(select(Invoice).where(Invoice.id == invoice_id, Invoice.user_id == user.id))
    if not invoice:
        raise HTTPException(404, "Không tìm thấy hóa đơn")
    require_visible(invoice)
    # Evaluate edited values without mutating a tracked ORM instance.
    preview = SimpleNamespace(**{column.name: getattr(invoice, column.name) for column in Invoice.__table__.columns})
    for name, value in payload.model_dump(exclude_unset=True).items():
        setattr(preview, '_duplicate_items' if name == 'items' else name,
                parse_invoice_time(value) if name == "invoice_time" else value)
    return inspect_duplicates(db, user.id, preview)


@router.post("/{invoice_id}/duplicate-resolution")
def resolve_duplicate(invoice_id: uuid.UUID, payload: InvoiceResolution,
                      db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    pending, replay = begin_operation(db, user, "invoice-resolution", {"id": str(invoice_id), **payload.model_dump(mode="json")})
    if replay is not None:
        db.rollback()
        return replay
    invoice = lock_invoice(db, user, invoice_id)
    require_visible(invoice)
    check_revision(invoice, payload.expected_revision)
    if invoice.status in {"CONFIRMED", "PROCESSING"}:
        conflict("INVOICE_NOT_EDITABLE", "Không thể thay đổi hóa đơn đang xử lý hoặc đã ghi sổ.")
    if payload.action == "CLEAR":
        invoice.duplicate_of_invoice_id = None
    else:
        target = db.scalar(select(Invoice).where(Invoice.id == payload.matched_invoice_id,
                           Invoice.user_id == user.id, Invoice.duplicate_of_invoice_id.is_(None)))
        if not target or target.id == invoice.id:
            raise HTTPException(404, "Không tìm thấy bản gốc hợp lệ")
        check = inspect_duplicates(db, user.id, invoice)
        if str(target.id) not in {c["invoice_id"] for c in check["candidates"]}:
            conflict("INVOICE_CANDIDATE_CHANGED", "Hãy kiểm tra lại danh sách hóa đơn đối chiếu.")
        invoice.duplicate_of_invoice_id = target.id
    invoice.revision += 1
    record_event(db, invoice, "MARK_DUPLICATE" if payload.action == "SAME_INVOICE" else "CLEAR_DUPLICATE",
                 matched_invoice_id=payload.matched_invoice_id)
    return finish_operation(db, pending, {"success": True, "revision": invoice.revision,
        "duplicate_of_invoice_id": str(invoice.duplicate_of_invoice_id) if invoice.duplicate_of_invoice_id else None})


@router.post("/{invoice_id}/restore")
def restore_invoice(invoice_id: uuid.UUID, payload: InvoiceRestore,
                    db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    pending, replay = begin_operation(db, user, "invoice-restore", {"id": str(invoice_id), **payload.model_dump(mode="json")})
    if replay is not None:
        db.rollback()
        return replay
    invoice = lock_invoice(db, user, invoice_id)
    check_revision(invoice, payload.expected_revision)
    if invoice.deleted_at:
        if trash_expired(invoice):
            raise HTTPException(410, detail={"code": "INVOICE_TRASH_EXPIRED", "message": "Đã hết 30 ngày lưu trong Thùng rác; không thể khôi phục hóa đơn."})
        invoice.deleted_at = None
        invoice.revision += 1
        invoice.confirmation_generation += 1
        record_event(db, invoice, "RESTORE")
    return finish_operation(db, pending, {"success": True, "revision": invoice.revision, "status": invoice.status,
            "requires_file": not bool(invoice.storage_key)})


@router.delete(
    "/{invoice_id}",
    status_code=204,
    summary="Xóa hóa đơn đơn lẻ (Delete Invoice)",
    description="Chuyển hóa đơn vào Thùng rác, giữ ảnh và thông tin 30 ngày. Hết hạn xóa vĩnh viễn hóa đơn; giữ khoản chi đã ghi sổ.",
)
def delete_invoice(
    invoice_id: uuid.UUID,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    invoice = lock_invoice(db, user, invoice_id)
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
    locked_user(db, user.id, user.token_version)
    for inv_id in sorted(set(payload.invoice_ids), key=str):
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


@router.post("/batch-purge", summary="Xóa vĩnh viễn hóa đơn trong Thùng rác")
def permanently_delete_invoices(payload: InvoiceBatchDelete,
                               db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    ids = sorted(set(payload.invoice_ids), key=str)
    if not ids or len(ids) > 100:
        raise HTTPException(422, detail="Chọn từ 1 đến 100 hóa đơn trong Thùng rác.")
    locked_user(db, user.id, user.token_version)
    invoices = db.scalars(select(Invoice).where(Invoice.user_id == user.id, Invoice.id.in_(ids))
        .order_by(Invoice.id).with_hint(Invoice, "WITH (UPDLOCK, ROWLOCK)", dialect_name="mssql")
        .execution_options(populate_existing=True)).all()
    # Validate the complete batch first. A restored invoice must never be purged
    # by an old browser selection; serialize with restore and the retention worker.
    if any(not invoice.deleted_at for invoice in invoices):
        raise HTTPException(409, detail={"code": "INVOICE_NOT_IN_TRASH",
            "message": "Có hóa đơn không còn trong Thùng rác. Hãy làm mới danh sách; chưa xóa hóa đơn nào."})
    found = {invoice.id for invoice in invoices}
    for invoice in invoices:
        purge_invoice(db, invoice)
    db.commit()
    return {"success": True, "deleted": len(invoices),
            "not_found": [str(i) for i in ids if i not in found]}
