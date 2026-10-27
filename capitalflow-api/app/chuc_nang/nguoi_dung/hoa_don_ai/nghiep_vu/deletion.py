"""Xóa hóa đơn theo thứ tự bảo toàn khóa ngoại và tệp vật lý.

Vai trò: dùng chung quy trình xóa cho endpoint đơn lẻ và hàng loạt.
Đầu vào: SQLAlchemy Session và Invoice thuộc đúng người dùng.
Đầu ra: thay đổi DB được chuẩn bị để caller commit.
Ràng buộc: không commit; tệp chỉ được xóa qua background job sau khi DB thành công.
"""

from datetime import datetime, timezone, timedelta
from sqlalchemy import delete, update, select
from sqlalchemy.orm import Session

from app.chuc_nang.nguoi_dung.hoa_don_ai.luu_tru.invoice import Invoice
from app.chuc_nang.nguoi_dung.hoa_don_ai.luu_tru.invoice_item import InvoiceItem
from app.chuc_nang.nguoi_dung.hoa_don_ai.luu_tru.tac_vu_ocr import OcrJob
from app.chuc_nang.nguoi_dung.tai_chinh.giao_dich.luu_tru.giao_dich import Transaction
from app.dung_chung.tac_vu_nen.hang_doi import enqueue
from app.chuc_nang.nguoi_dung.hoa_don_ai.luu_tru.lich_su import InvoiceEvent
from .vong_doi import record_event

RETENTION_DAYS = 30


def utc_now():
    return datetime.now(timezone.utc).replace(tzinfo=None)


def trash_expires_at(invoice):
    if not invoice.deleted_at:
        return None
    return invoice.deleted_at.replace(tzinfo=None) + timedelta(days=RETENTION_DAYS)


def trash_expired(invoice, instant=None):
    deadline = trash_expires_at(invoice)
    return bool(deadline and deadline <= (instant or utc_now()))


def purge_expired_invoices(sessions, *, instant=None, limit=100, user_id=None):
    """Bounded periodic sweep; serialize with restore/upload using the user lock."""
    from app.chuc_nang.nguoi_dung.dang_nhap.luu_tru.nguoi_dung import User
    cutoff = (instant or utc_now()) - timedelta(days=RETENTION_DAYS)
    with sessions() as db:
        query = select(Invoice.user_id, Invoice.id).where(Invoice.deleted_at <= cutoff)
        if user_id is not None:
            query = query.where(Invoice.user_id == user_id)
        rows = db.execute(query.order_by(Invoice.deleted_at, Invoice.id).limit(limit)).all()
    removed = 0
    for user_id, invoice_id in rows:
        with sessions() as db:
            db.scalar(select(User).where(User.id == user_id).with_hint(User, 'WITH (UPDLOCK, ROWLOCK)', dialect_name='mssql'))
            invoice = db.scalar(select(Invoice).where(Invoice.id == invoice_id, Invoice.user_id == user_id)
                .with_hint(Invoice, 'WITH (UPDLOCK, ROWLOCK)', dialect_name='mssql').execution_options(populate_existing=True))
            if invoice and invoice.deleted_at and invoice.deleted_at.replace(tzinfo=None) <= cutoff:
                purge_invoice(db, invoice)
                db.commit()
                removed += 1
    return removed


def purge_invoice(db: Session, invoice: Invoice) -> None:
    """Gỡ quan hệ con, enqueue xóa file rồi đánh dấu xóa bản ghi hóa đơn."""

    db.execute(
        update(Transaction)
        .where(Transaction.invoice_id == invoice.id)
        .values(invoice_id=None)
    )
    db.execute(update(Invoice).where(Invoice.duplicate_of_invoice_id == invoice.id).values(duplicate_of_invoice_id=None))
    db.execute(delete(InvoiceEvent).where(InvoiceEvent.invoice_id == invoice.id))
    db.execute(delete(InvoiceItem).where(InvoiceItem.invoice_id == invoice.id))
    db.execute(delete(OcrJob).where(OcrJob.invoice_id == invoice.id))
    db.flush()
    if invoice.storage_key:
        enqueue(
            db,
            "FILE_DELETE",
            {"storage_key": invoice.storage_key},
            "delete-file:" + invoice.storage_key,
        )
    db.delete(invoice)


def safe_delete_invoice(db: Session, invoice: Invoice) -> None:
    """Move to trash for 30 days, retaining source file and posted transaction."""
    if invoice.deleted_at:
        return
    invoice.deleted_at = utc_now()
    invoice.revision += 1
    if invoice.status == "PROCESSING":
        invoice.status = "FAILED"
    db.execute(delete(OcrJob).where(OcrJob.invoice_id == invoice.id))
    record_event(db, invoice, "TRASH", expires_at=trash_expires_at(invoice))
