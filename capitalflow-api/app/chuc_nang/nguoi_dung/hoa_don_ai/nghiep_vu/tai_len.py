"""Content-based upload reuse, with short user-serialized database writes."""
import hashlib
import uuid
from pathlib import Path
from sqlalchemy import case, select
from sqlalchemy.exc import DBAPIError
from fastapi import HTTPException
from app.dung_chung.config import settings
from app.chuc_nang.nguoi_dung.hoa_don_ai.luu_tru.invoice import Invoice
from app.chuc_nang.nguoi_dung.hoa_don_ai.luu_tru.invoice_item import InvoiceItem
from app.chuc_nang.nguoi_dung.tai_chinh.giao_dich.luu_tru.giao_dich import Transaction
from .chuan_hoa_hoa_don import refresh_identity
from .luy_dang import begin_operation, finish_operation
from .vong_doi import record_event


def upload(db, user, contents, filename, ext, mime, source, xml_data):
    for attempt in range(3):
        state = {"path": None, "committing": False}
        try:
            return _upload(db, user, contents, filename, ext, mime, source, xml_data, state)
        except DBAPIError as exc:
            db.rollback()
            if not state["committing"] or "1205" in str(exc.orig):
                _remove_uncommitted_file(state)
            if "1205" in str(exc.orig) and attempt < 2:
                continue
            raise HTTPException(503, detail={"code": "INVOICE_RETRY_REQUIRED", "message": "Hãy thử tải lại với cùng khóa yêu cầu."}) from exc
        except Exception:
            db.rollback()
            if not state["committing"]:
                _remove_uncommitted_file(state)
            raise


def _remove_uncommitted_file(state):
    path = state["path"]
    if path and path.resolve().parent == Path(settings.upload_dir).resolve():
        path.unlink(missing_ok=True)


def _upload(db, user, contents, filename, ext, mime, source, xml_data, state):
    file_hash = hashlib.sha256(contents).hexdigest()
    pending, replay = begin_operation(db, user, "invoice-upload", {"hash": file_hash, "source": source})
    invoice = None
    if replay:
        invoice = db.scalar(select(Invoice).where(Invoice.id == uuid.UUID(replay["id"]), Invoice.user_id == user.id))
        if invoice is None:
            raise HTTPException(409, detail={"code": "UPLOAD_NO_LONGER_ACTIVE", "message": "Bản tải lên cũ không còn tồn tại."})
    if invoice is None:
        invoice = db.scalar(select(Invoice).where(Invoice.user_id == user.id, Invoice.file_sha256 == file_hash)
            .order_by(case((Invoice.status == "CONFIRMED", 0), else_=1),
                      case((Invoice.deleted_at.is_(None), 0), else_=1), Invoice.created_at, Invoice.id))
    created = invoice is None
    if created:
        invoice = Invoice(user_id=user.id, file_sha256=file_hash,
                          source="IMPORT" if xml_data else source,
                          status="REVIEW_REQUIRED" if xml_data else "UPLOADED",
                          **({k: v for k, v in xml_data.items() if k != "items"} if xml_data else {}))
        db.add(invoice)
        refresh_identity(invoice)
    transaction_id = None if created else db.scalar(select(Transaction.id).where(
        Transaction.invoice_id == invoice.id, Transaction.user_id == user.id))
    # Do not resurrect deleted files on a repeated upload request. Restoration
    # is an explicit, revision-checked operation followed by a fresh upload.
    # Explicitly restored receipts may regain their source file even when the
    # expense is already posted. This does not change their posting state.
    if not invoice.deleted_at and not invoice.storage_key:
        stored_name = f"{uuid.uuid4()}{ext}"
        upload_path = Path(settings.upload_dir) / stored_name
        upload_path.parent.mkdir(parents=True, exist_ok=True)
        state["path"] = upload_path
        upload_path.write_bytes(contents)
        invoice.storage_key = stored_name
        invoice.original_filename = Path(filename or stored_name).name[:255]
        invoice.mime_type = mime
        invoice.file_size_bytes = len(contents)
        # Keep the file if the outcome of commit is unknown; remove it only
        # after rollback is known to have undone the reference.
    db.flush()
    if created and xml_data:
        db.add_all([InvoiceItem(invoice_id=invoice.id, line_no=i, **item)
                    for i, item in enumerate(xml_data["items"], 1)])
    outcome = ("CREATED" if created else "ALREADY_CONFIRMED" if transaction_id else
               "RESTORE_REQUIRED" if invoice.deleted_at else "REUSED_DRAFT")
    if created:
        record_event(db, invoice, "UPLOAD", source=invoice.source)
    result = {"id": str(invoice.id), "filename": invoice.original_filename, "status": invoice.status,
              "mime_type": invoice.mime_type, "created_at": invoice.created_at.isoformat(),
              "outcome": outcome, "revision": invoice.revision,
              "transaction_id": str(transaction_id) if transaction_id else None,
              "deleted_at": invoice.deleted_at.isoformat() if invoice.deleted_at else None}
    state["committing"] = True
    return finish_operation(db, pending, result), created
