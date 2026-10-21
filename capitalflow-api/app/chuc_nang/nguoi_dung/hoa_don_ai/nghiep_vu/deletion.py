"""Xóa hóa đơn theo thứ tự bảo toàn khóa ngoại và tệp vật lý.

Vai trò: dùng chung quy trình xóa cho endpoint đơn lẻ và hàng loạt.
Đầu vào: SQLAlchemy Session và Invoice thuộc đúng người dùng.
Đầu ra: thay đổi DB được chuẩn bị để caller commit.
Ràng buộc: không commit; tệp chỉ được xóa qua background job sau khi DB thành công.
"""

from datetime import datetime, timezone
from sqlalchemy import delete, update
from sqlalchemy.orm import Session

from app.chuc_nang.nguoi_dung.hoa_don_ai.luu_tru.invoice import Invoice
from app.chuc_nang.nguoi_dung.hoa_don_ai.luu_tru.invoice_item import InvoiceItem
from app.chuc_nang.nguoi_dung.hoa_don_ai.luu_tru.tac_vu_ocr import OcrJob
from app.chuc_nang.nguoi_dung.tai_chinh.giao_dich.luu_tru.giao_dich import Transaction
from app.dung_chung.tac_vu_nen.hang_doi import enqueue
from app.chuc_nang.nguoi_dung.hoa_don_ai.luu_tru.lich_su import InvoiceEvent
from .vong_doi import record_event


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
    """Hide metadata without severing the transaction; remove file after commit."""
    if invoice.deleted_at:
        return
    invoice.deleted_at = datetime.now(timezone.utc)
    invoice.revision += 1
    if invoice.status == "PROCESSING":
        invoice.status = "FAILED"
    db.execute(delete(OcrJob).where(OcrJob.invoice_id == invoice.id))
    if invoice.storage_key:
        key = invoice.storage_key
        invoice.storage_key = None
        enqueue(db, "FILE_DELETE", {"storage_key": key}, "delete-file:" + key)
    record_event(db, invoice, "HIDE")
