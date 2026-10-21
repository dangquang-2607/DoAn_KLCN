"""Common invoice locking, revision checks and minimal decision history."""
import json
from fastapi import HTTPException
from sqlalchemy import select
from app.chuc_nang.nguoi_dung.dang_nhap.nghiep_vu.session_management import locked_user
from app.chuc_nang.nguoi_dung.hoa_don_ai.luu_tru.invoice import Invoice
from app.chuc_nang.nguoi_dung.hoa_don_ai.luu_tru.lich_su import InvoiceEvent


def conflict(code, message, **extra):
    raise HTTPException(409, detail={"code": code, "message": message, **extra})


def lock_invoice(db, user, invoice_id):
    locked_user(db, user.id, user.token_version)
    invoice = db.scalar(select(Invoice).where(Invoice.id == invoice_id, Invoice.user_id == user.id)
        .with_hint(Invoice, "WITH (UPDLOCK, ROWLOCK)", dialect_name="mssql")
        .execution_options(populate_existing=True))
    if not invoice:
        raise HTTPException(404, "Không tìm thấy hóa đơn")
    return invoice


def require_visible(invoice):
    if invoice.deleted_at:
        conflict("INVOICE_DELETED", "Hóa đơn đã bị ẩn. Vui lòng khôi phục trước khi tiếp tục.")


def check_revision(invoice, expected, *, required=False):
    if (required and expected is None) or (expected is not None and expected != invoice.revision):
        conflict("INVOICE_VERSION_CONFLICT", "Thông tin hóa đơn đã thay đổi. Vui lòng tải lại.",
                 revision=invoice.revision)


def record_event(db, invoice, action, **details):
    db.add(InvoiceEvent(user_id=invoice.user_id, invoice_id=invoice.id, action=action,
                        revision=invoice.revision or 1,
                        details_json=json.dumps(details, ensure_ascii=False, default=str)))


def transaction_removed(db, invoice, transaction_id):
    invoice.status = "REVIEW_REQUIRED"
    invoice.confirmed_at = None
    invoice.revision = (invoice.revision or 1) + 1
    invoice.confirmation_generation = (invoice.confirmation_generation or 0) + 1
    record_event(db, invoice, "TRANSACTION_DELETED", transaction_id=str(transaction_id))
