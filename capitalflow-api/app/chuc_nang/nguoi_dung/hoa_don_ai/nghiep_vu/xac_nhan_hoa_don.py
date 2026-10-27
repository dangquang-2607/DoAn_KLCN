"""Post an invoice atomically with user-scoped deduplication and replay protection."""
import uuid
from datetime import datetime, timezone
from decimal import Decimal
from fastapi import HTTPException
from sqlalchemy import select, delete
from sqlalchemy.exc import DBAPIError, IntegrityError
from app.chuc_nang.nguoi_dung.hoa_don_ai.luu_tru.invoice_item import InvoiceItem
from app.chuc_nang.nguoi_dung.tai_chinh.giao_dich.luu_tru.giao_dich import Transaction, TransactionType, TransactionSource
from app.chuc_nang.nguoi_dung.tai_chinh.giao_dich.so_cai import create_transaction
from app.chuc_nang.nguoi_dung.danh_muc.phan_loai import suggest_category
from app.dung_chung.tac_vu_nen.hang_doi import enqueue
from .chuan_hoa_hoa_don import refresh_identity, parse_invoice_time
from .phat_hien_trung_lap import inspect_duplicates
from .vong_doi import lock_invoice, require_visible, check_revision, record_event, conflict
from .luy_dang import begin_operation, finish_operation


def confirm(db, user, invoice_id, payload, *, record_only=False):
    for attempt in range(3):
        try:
            return _confirm(db, user, invoice_id, payload, record_only=record_only)
        except IntegrityError:
            db.rollback()
            conflict("INVOICE_WRITE_CONFLICT", "Dữ liệu hóa đơn vừa thay đổi. Hãy tải lại trước khi thử lại.")
        except DBAPIError as exc:
            db.rollback()
            # SQL Server 1205 guarantees the victim's transaction was rolled
            # back. Other failures can have an unknown commit outcome.
            if "1205" in str(exc.orig) and attempt < 2:
                continue
            raise HTTPException(503, detail={"code": "INVOICE_RETRY_REQUIRED", "message": "Chưa xác định kết quả. Hãy thử lại cùng khóa yêu cầu."}) from exc
        except Exception:
            db.rollback()
            raise


def _confirm(db, user, invoice_id, payload, *, record_only=False):
    pending, replay = begin_operation(db, user, "invoice-record" if record_only else "invoice-confirm", {"invoice_id": str(invoice_id), "payload": payload.model_dump(mode="json")})
    if replay is not None:
        db.rollback()
        return replay
    invoice = lock_invoice(db, user, invoice_id)
    if record_only and invoice.currency != 'VND':
        raise HTTPException(422, "Sổ thu chi hiện chỉ hỗ trợ hóa đơn bằng VND")
    existing = db.scalar(select(Transaction).where(Transaction.invoice_id == invoice.id, Transaction.user_id == user.id))
    if existing:
        return finish_operation(db, pending, {"success": True, "transaction_id": str(existing.id),
                                             "outcome": "ALREADY_CONFIRMED", "revision": invoice.revision})
    require_visible(invoice)
    check_revision(invoice, payload.expected_revision, required=bool(invoice.confirmation_generation))
    if invoice.duplicate_of_invoice_id:
        conflict("INVOICE_DUPLICATE_EXACT", "Bản này đã được đánh dấu trùng. Hãy mở bản gốc hoặc xóa quyết định trùng.",
                 matched_invoice_id=str(invoice.duplicate_of_invoice_id))
    if invoice.status not in ("REVIEW_REQUIRED", "UPLOADED", "FAILED"):
        raise HTTPException(409, "Hóa đơn chưa sẵn sàng để xác nhận")

    # Lưu lại dữ liệu người dùng đã chỉnh sửa trên form OCR
    for field in ("merchant_name", "invoice_date", "invoice_number", "invoice_symbol", "merchant_tax_code", "merchant_address"):
        if field in payload.model_fields_set:
            setattr(invoice, field, getattr(payload, field))
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

    if "invoice_time" in payload.model_fields_set:
        invoice.invoice_time = parse_invoice_time(payload.invoice_time)
    refresh_identity(invoice)
    # SessionLocal disables autoflush: compare the actual edited item rows,
    # not a stale basket from before this confirmation request.
    db.flush()
    check = inspect_duplicates(db, user.id, invoice)
    if check["level"] == "EXACT":
        conflict("INVOICE_DUPLICATE_EXACT", "Hóa đơn này đã tồn tại. Vui lòng mở bản gốc.", duplicate_check=check)
    if check["level"] == "SUSPECTED":
        if not payload.accept_distinct or payload.duplicate_review_token != check["review_token"]:
            conflict("INVOICE_DUPLICATE_REVIEW_REQUIRED", "Cần đối chiếu hóa đơn nghi trùng.", duplicate_check=check)
        record_event(db, invoice, "ACCEPT_DISTINCT", review_token=check["review_token"],
                     candidates=[c["invoice_id"] for c in check["candidates"]])

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

    creator = create_transaction
    if record_only:
        from app.chuc_nang.nguoi_dung.tai_chinh.giao_dich.bookkeeping import create_record
        creator = create_record
    linked_txn = None
    if record_only:
        from app.chuc_nang.nguoi_dung.tai_chinh.giao_dich.payment_records import linked_record, check_possible_payment
        if payload.wallet_entry_id:
            linked_txn,evidence=linked_record(db,user.id,payload.wallet_entry_id)
            if linked_txn.invoice_id:
                raise HTTPException(409,'Khoản thanh toán đã gắn hóa đơn khác. Hãy mở hóa đơn đã có.')
            if final_amount != -evidence.amount:
                raise HTTPException(422,'Tổng hóa đơn phải khớp số tiền thanh toán khi liên kết')
            linked_txn.invoice_id=invoice.id
        else:
            from app.chuc_nang.nguoi_dung.tai_chinh.ngan_sach.ky_han import today_vn
            check_possible_payment(db,user.id,final_amount,invoice.invoice_date or today_vn(),payload.accept_separate_record)
    txn = linked_txn if linked_txn is not None else creator(
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
        **({'include_in_reports':payload.include_in_reports} if record_only else {}),
        **category_metadata,
    )

    invoice.status = "CONFIRMED"
    invoice.confirmed_at = datetime.now(timezone.utc)
    invoice.account_id = payload.account_id
    invoice.category_id = txn.category_id
    enqueue(db, "BUDGET", {"user_id": str(user.id), "transaction_id": str(txn.id)}, "budget-check:" + str(txn.id))
    invoice.revision += 1
    record_event(db, invoice, "RECONFIRM" if invoice.confirmation_generation else "CONFIRM", transaction_id=str(txn.id))
    return finish_operation(db, pending, {"success": True, "transaction_id": str(txn.id),
                                         "outcome": "LINKED_PAYMENT" if linked_txn is not None else "CREATED", "revision": invoice.revision})

