"""User-scoped duplicate evidence, refreshed on review and before posting."""
from sqlalchemy import and_, or_, select
from collections import defaultdict
from app.chuc_nang.nguoi_dung.hoa_don_ai.luu_tru.invoice import Invoice
from app.chuc_nang.nguoi_dung.hoa_don_ai.luu_tru.invoice_item import InvoiceItem
from app.chuc_nang.nguoi_dung.tai_chinh.giao_dich.luu_tru.giao_dich import Transaction
from .chuan_hoa_hoa_don import content_snapshot, digest, identity_key, normalized
from .doi_chieu_ban_le import address_matches, basket_signature, receipt_matches, retail_reason, seller_matches
from .do_tuong_dong import similarity_percent


def _baskets(db, user_id, invoices, rows):
    ids = {i.id for i in invoices} | {other.id for other, _ in rows}
    grouped = defaultdict(list)
    # Chunk to stay below SQL Server's parameter limit for large result sets.
    ids = list(ids)
    for start in range(0, len(ids), 500):
        for item in db.scalars(select(InvoiceItem).join(Invoice, Invoice.id == InvoiceItem.invoice_id).where(
                Invoice.user_id == user_id, InvoiceItem.invoice_id.in_(ids[start:start + 500]))):
            grouped[item.invoice_id].append(item)
    return {key: basket_signature(value) for key, value in grouped.items()}


def _candidate_conditions(invoice):
    key = identity_key(invoice)
    conditions = []
    if invoice.file_sha256:
        conditions.append(Invoice.file_sha256 == invoice.file_sha256)
    if key:
        conditions.append(Invoice.strong_identity_key == key)
    if invoice.invoice_date:
        conditions.append(and_(Invoice.invoice_date == invoice.invoice_date,
                               Invoice.currency == invoice.currency))
    if invoice.invoice_number:
        conditions.append(Invoice.invoice_number == invoice.invoice_number)
    return conditions


def _candidate_rows(db, user_id, invoices):
    conditions = [condition for invoice in invoices for condition in _candidate_conditions(invoice)]
    if not conditions:
        return []
    return db.execute(select(Invoice, Transaction.id).outerjoin(
            Transaction, and_(Transaction.invoice_id == Invoice.id, Transaction.user_id == user_id)
        ).where(Invoice.user_id == user_id,
                Invoice.duplicate_of_invoice_id.is_(None),
                # Trashed receipts remain reusable until permanently purged.
                or_(*conditions)).order_by(Invoice.created_at, Invoice.id)).all()


def inspect_duplicate_batch(db, user_id, invoices):
    rows = _candidate_rows(db, user_id, invoices)
    baskets = _baskets(db, user_id, invoices, rows) if rows else {}
    return {invoice.id: inspect_duplicates(db, user_id, invoice, rows=rows, baskets=baskets) for invoice in invoices}


def inspect_duplicates(db, user_id, invoice, *, rows=None, baskets=None):
    key = identity_key(invoice)
    candidates = []
    evidence = []
    if rows is None:
        rows = _candidate_rows(db, user_id, [invoice])
    if baskets is None:
        baskets = _baskets(db, user_id, [invoice], rows) if rows else {}
    basket = baskets.get(invoice.id, ())
    if getattr(invoice, '_duplicate_items', None) is not None:
        basket = basket_signature(invoice._duplicate_items)
    for other, transaction_id in rows:
        if other.id == invoice.id:
            continue
        same_file = bool(invoice.file_sha256 and invoice.file_sha256 == other.file_sha256)
        same_identity = bool(key and key == identity_key(other))
        same_date_amount = bool(invoice.invoice_date and invoice.total_amount is not None
            and invoice.invoice_date == other.invoice_date
            and invoice.total_amount == other.total_amount
            and invoice.currency == other.currency)
        same_purchase = bool(same_date_amount
            and (seller_matches(invoice.merchant_name, other.merchant_name) or
                (normalized(invoice.merchant_name) and normalized(invoice.merchant_name) == normalized(other.merchant_name))))
        # OCR may omit the branch suffix from a seller name. A receipt number
        # plus an address/date/amount is only review evidence until corroborated
        # by seller + time or a sufficiently detailed matching basket.
        same_retail_receipt = bool(same_date_amount
            and receipt_matches(invoice.invoice_number, other.invoice_number)
            and address_matches(invoice.merchant_address, other.merchant_address))
        retail = retail_reason(invoice, other, basket, baskets.get(other.id, ())) if same_date_amount else None
        score = 100 if same_file or same_identity else similarity_percent(invoice, other, basket, baskets.get(other.id, ()))
        if not (same_file or same_identity or same_purchase or same_retail_receipt or retail or score >= 50):
            continue
        # Earlier draft is canonical. It must remain confirmable when a
        # later copy exists. A posted receipt always takes precedence.
        if (same_file or same_identity or retail or score > 80) and not transaction_id:
            mine = (str(invoice.created_at or "9999"), str(invoice.id))
            theirs = (str(other.created_at or "9999"), str(other.id))
            if theirs >= mine:
                continue
        level = "EXACT" if same_file or same_identity or retail else "SUSPECTED"
        reason = ("SAME_FILE" if same_file else "SAME_IDENTITY" if same_identity else
                  retail if retail else
                  "SAME_RECEIPT_NUMBER_ADDRESS_DATE_AMOUNT" if same_retail_receipt else
                  "SAME_MERCHANT_DATE_AMOUNT" if same_purchase else "SIMILAR_DATA")
        if same_identity and (invoice.invoice_date != other.invoice_date
            or invoice.total_amount != other.total_amount or invoice.currency != other.currency):
            reason = "IDENTITY_DATA_CONFLICT"
        candidates.append({"invoice_id": str(other.id), "transaction_id": str(transaction_id) if transaction_id else None,
            "level": level, "reason": reason, "status": other.status, "similarity_percent": score,
            "merchant_name": other.merchant_name, "invoice_date": other.invoice_date.isoformat() if other.invoice_date else None,
            "total_amount": str(other.total_amount) if other.total_amount is not None else None, "currency": other.currency,
            "deleted_at": other.deleted_at.isoformat() if other.deleted_at else None, "revision": other.revision})
        evidence.append([str(other.id), other.revision, str(transaction_id or ""), level,
                         content_snapshot(other), baskets.get(other.id, ()), score])
    candidates.sort(key=lambda c: (-c["similarity_percent"], c["level"] != "EXACT", c["transaction_id"] is None, c["invoice_id"]))
    level = "EXACT" if any(c["level"] == "EXACT" for c in candidates) else "SUSPECTED" if candidates else "NONE"
    # Include all evidence, even when only the first 20 candidates are returned.
    token = digest([str(user_id), str(invoice.id), invoice.revision, content_snapshot(invoice), basket, evidence])
    return {"level": level, "can_override": level == "SUSPECTED", "review_token": token,
            "candidate_count": len(candidates), "candidates": candidates[:20], "score_version": 1,
            "similarity_percent": max((c["similarity_percent"] for c in candidates), default=0)}


def check_duplicate(db, user_id, invoice):
    """Compatibility for clients using the original boolean warning."""
    result = inspect_duplicates(db, user_id, invoice)
    return result["level"] != "NONE", (
        "Hóa đơn trùng đã tồn tại. Vui lòng mở bản gốc." if result["level"] == "EXACT" else
        "Có hóa đơn có thông tin tương đồng. Cần kiểm tra trước khi ghi sổ."
        if result["level"] == "SUSPECTED" else None
    )
