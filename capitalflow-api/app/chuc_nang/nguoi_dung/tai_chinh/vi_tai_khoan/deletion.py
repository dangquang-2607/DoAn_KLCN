"""Xóa vĩnh viễn ví và các bản ghi tài chính phụ thuộc trong một DB transaction."""

import uuid
from collections import defaultdict
from decimal import Decimal

from fastapi import HTTPException
from sqlalchemy import delete, func, select
from sqlalchemy.orm import Session

from app.chuc_nang.nguoi_dung.hoa_don_ai.nghiep_vu.deletion import safe_delete_invoice
from app.chuc_nang.nguoi_dung.hoa_don_ai.luu_tru.invoice import Invoice
from app.chuc_nang.nguoi_dung.tai_chinh.vi_tai_khoan.luu_tru.account import Account
from app.chuc_nang.nguoi_dung.tai_chinh.thong_bao.luu_tru.thong_bao import Notification
from app.chuc_nang.nguoi_dung.tai_chinh.giao_dich.luu_tru.giao_dich import Transaction


def _batches(values, size=500):
    ordered = sorted(values, key=str)
    for offset in range(0, len(ordered), size):
        yield ordered[offset:offset + size]


def deletion_scope(db: Session, account: Account, user_id: uuid.UUID):
    """Tìm giao dịch của ví, hai vế chuyển tiền và hóa đơn liên quan."""
    if db.scalar(select(func.count()).select_from(Transaction).where(
        Transaction.account_id == account.id, Transaction.user_id != user_id,
    )) or db.scalar(select(func.count()).select_from(Invoice).where(
        Invoice.account_id == account.id, Invoice.user_id != user_id,
    )):
        raise HTTPException(409, "Ví có dữ liệu liên kết không hợp lệ; chưa xóa dữ liệu nào")

    own = db.scalars(select(Transaction).where(
        Transaction.account_id == account.id, Transaction.user_id == user_id,
    ).order_by(Transaction.id)).all()
    transfer_ids = {row.transfer_id for row in own if row.kind == "TRANSFER" and row.transfer_id}
    if any(row.kind == "TRANSFER" and not row.transfer_id for row in own):
        raise HTTPException(409, "Giao dịch chuyển tiền thiếu mã liên kết; chưa xóa dữ liệu nào")
    partners = [row for batch in _batches(transfer_ids) for row in db.scalars(
        select(Transaction).where(
            Transaction.transfer_id.in_(batch), Transaction.user_id == user_id,
        ).order_by(Transaction.id)
    ).all()]
    for transfer_id in transfer_ids:
        legs = [row for row in partners if row.transfer_id == transfer_id]
        if len(legs) != 2 or {row.type for row in legs} != {"INCOME", "EXPENSE"}:
            raise HTTPException(409, "Cặp chuyển tiền không đầy đủ; chưa xóa dữ liệu nào")
    transactions = {row.id: row for row in [*own, *partners]}
    invoice_ids = {row.invoice_id for row in transactions.values() if row.invoice_id}
    invoices = {row.id: row for row in db.scalars(select(Invoice).where(
        Invoice.user_id == user_id, Invoice.account_id == account.id,
    ).order_by(Invoice.id)).all()}
    for batch in _batches(invoice_ids):
        invoices.update((row.id, row) for row in db.scalars(select(Invoice).where(
            Invoice.user_id == user_id, Invoice.id.in_(batch),
        )).all())
    if not invoice_ids.issubset(invoices):
        raise HTTPException(409, "Hóa đơn liên kết không hợp lệ; chưa xóa dữ liệu nào")
    return own, transactions, list(invoices.values()), transfer_ids


def deletion_preview(db: Session, account: Account, user_id: uuid.UUID) -> dict:
    own, _, invoices, transfer_ids = deletion_scope(db, account, user_id)
    return {
        "transaction_count": sum(row.kind == "NORMAL" for row in own),
        "transfer_count": len(transfer_ids),
        "adjustment_count": sum(row.kind == "ADJUSTMENT" for row in own),
        "invoice_count": len(invoices),
    }


def delete_wallet(db: Session, account: Account, user_id: uuid.UUID) -> None:
    """Caller commits. Any failure rolls back ví, giao dịch, hóa đơn và số dư cùng nhau."""
    _, transactions, invoices, _ = deletion_scope(db, account, user_id)
    amounts = defaultdict(lambda: Decimal("0"))
    for row in transactions.values():
        if row.account_id != account.id:
            amounts[row.account_id] += Decimal(row.amount)
    if amounts:
        accounts = {row.id: row for batch in _batches(amounts) for row in db.scalars(
            select(Account).where(Account.id.in_(batch), Account.user_id == user_id)
            .order_by(Account.id).with_hint(Account, "WITH (UPDLOCK, ROWLOCK)", dialect_name="mssql")
            .execution_options(populate_existing=True)
        ).all()}
        if len(accounts) != len(amounts):
            raise HTTPException(409, "Ví đối ứng không còn hợp lệ; chưa xóa dữ liệu nào")
        for account_id, amount in amounts.items():
            accounts[account_id].balance -= amount

    for batch in _batches(transactions):
        db.execute(delete(Notification).where(
            Notification.user_id == user_id,
            Notification.source_type == "TRANSACTION",
            Notification.source_id.in_(batch),
        ))
        db.execute(delete(Transaction).where(
            Transaction.id.in_(batch), Transaction.user_id == user_id,
        ))
    for invoice in invoices:
        safe_delete_invoice(db, invoice)
    db.execute(delete(Notification).where(
        Notification.user_id == user_id,
        Notification.source_type == "ACCOUNT",
        Notification.source_id == account.id,
    ))
    db.flush()
    db.delete(account)
    db.flush()
