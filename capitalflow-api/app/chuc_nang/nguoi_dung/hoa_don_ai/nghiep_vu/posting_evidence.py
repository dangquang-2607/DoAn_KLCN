"""Archive identity atomically before purge, without retaining files or line items."""
import json
from datetime import date, datetime, timezone
from decimal import Decimal
from types import SimpleNamespace
from sqlalchemy import select, or_
from ..luu_tru.posting_evidence import InvoicePostingEvidence as Evidence
from ..luu_tru.invoice_item import InvoiceItem
from app.chuc_nang.nguoi_dung.tai_chinh.giao_dich.luu_tru.giao_dich import Transaction
from .chuan_hoa_hoa_don import content_snapshot, digest, identity_key
from .doi_chieu_ban_le import basket_signature


def preserve_posting_evidence(db, invoice):
    transaction_id = db.scalar(select(Transaction.id).where(
        Transaction.invoice_id == invoice.id, Transaction.user_id == invoice.user_id))
    if transaction_id is None:
        return
    if db.get(Evidence, transaction_id) is not None:
        return
    basket = basket_signature(db.scalars(select(InvoiceItem).where(InvoiceItem.invoice_id == invoice.id)).all())
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    db.add(Evidence(transaction_id=transaction_id, invoice_id=invoice.id, user_id=invoice.user_id,
        file_sha256=invoice.file_sha256, strong_identity_key=identity_key(invoice),
        invoice_date=invoice.invoice_date, invoice_number=invoice.invoice_number,
        snapshot_json=json.dumps(content_snapshot(invoice), ensure_ascii=False),
        basket_hash=digest(basket) if basket else None,
        created_at=invoice.created_at or now, purged_at=now))
    db.flush()


def archived_candidates(db, user_id, invoices):
    conditions = []
    for invoice in invoices:
        if invoice.file_sha256:
            conditions.append(Evidence.file_sha256 == invoice.file_sha256)
        key = identity_key(invoice)
        if key:
            conditions.append(Evidence.strong_identity_key == key)
        if invoice.invoice_date:
            conditions.append(Evidence.invoice_date == invoice.invoice_date)
        if invoice.invoice_number:
            conditions.append(Evidence.invoice_number == invoice.invoice_number)
    if not conditions:
        return []
    records = db.scalars(select(Evidence).join(Transaction, Transaction.id == Evidence.transaction_id).where(
        Evidence.user_id == user_id, Transaction.user_id == user_id, or_(*conditions)))
    rows = []
    for record in records:
        values = json.loads(record.snapshot_json)
        values['invoice_date'] = date.fromisoformat(values['invoice_date']) if values['invoice_date'] else None
        values['total_amount'] = Decimal(values['total_amount']) if values['total_amount'] else None
        values.update(id=record.invoice_id, user_id=user_id, created_at=record.created_at,
            deleted_at=record.purged_at, revision=1, status='CONFIRMED', purged=True,
            basket_hash=record.basket_hash)
        rows.append((SimpleNamespace(**values), record.transaction_id))
    return rows


def reject_archived_file(db, user_id, file_hash):
    record = db.scalar(select(Evidence).join(Transaction, Transaction.id == Evidence.transaction_id).where(
        Evidence.user_id == user_id, Transaction.user_id == user_id, Evidence.file_sha256 == file_hash))
    if record is not None:
        from fastapi import HTTPException
        raise HTTPException(409, detail={'code': 'INVOICE_ALREADY_POSTED_PURGED',
            'message': 'Hóa đơn này đã ghi sổ. Chứng từ gốc đã xóa vĩnh viễn, nhưng khoản chi vẫn còn; không tạo khoản chi mới.',
            'transaction_id': str(record.transaction_id), 'matched_invoice_id': str(record.invoice_id)})
