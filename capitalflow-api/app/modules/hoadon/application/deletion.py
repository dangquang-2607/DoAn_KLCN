"""Xóa hóa đơn theo thứ tự bảo toàn khóa ngoại và tệp vật lý.

Vai trò: dùng chung quy trình xóa cho endpoint đơn lẻ và hàng loạt.
Đầu vào: SQLAlchemy Session và Invoice thuộc đúng người dùng.
Đầu ra: thay đổi DB được chuẩn bị để caller commit.
Ràng buộc: không commit; tệp chỉ được xóa qua background job sau khi DB thành công.
"""

from sqlalchemy import delete, update
from sqlalchemy.orm import Session

from app.modules.hoadon.persistence.invoice import Invoice
from app.modules.hoadon.persistence.invoice_item import InvoiceItem
from app.modules.hoadon.persistence.ocr_job import OcrJob
from app.modules.taichinh.persistence.transaction import Transaction
from app.modules.jobs.queue import enqueue


def safe_delete_invoice(db: Session, invoice: Invoice) -> None:
    """Gỡ quan hệ con, enqueue xóa file rồi đánh dấu xóa bản ghi hóa đơn."""

    db.execute(
        update(Transaction)
        .where(Transaction.invoice_id == invoice.id)
        .values(invoice_id=None)
    )
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
