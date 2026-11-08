"""Shared transaction filters for bookkeeping and historical records."""
import uuid
from datetime import date
from typing import Literal
from fastapi import Depends, HTTPException, Query
from sqlalchemy import func, or_, select
from app.dung_chung.http.phu_thuoc import get_current_user
from app.chuc_nang.nguoi_dung.dang_nhap.luu_tru.nguoi_dung import User
from .luu_tru.giao_dich import Transaction
from ..vi_tai_khoan.luu_tru.account import Account
from ..vi_tai_khoan.luu_tru.wallet import Wallet, WalletEntry


def with_account_display(query):
    """Resolve the owner's wallet (including closed wallets), historical account, or plain ledger."""
    return (query
        .outerjoin(WalletEntry, WalletEntry.id == Transaction.wallet_entry_id)
        .outerjoin(Wallet, (Wallet.id == WalletEntry.wallet_id) & (Wallet.user_id == Transaction.user_id))
        .outerjoin(Account, (Account.id == Transaction.account_id) & (Account.user_id == Transaction.user_id)
                   & Transaction.wallet_entry_id.is_(None))
        .add_columns(func.coalesce(Wallet.name, Account.name, "Sổ thu chi").label("account_name"),
                     func.coalesce(Account.currency, "VND").label("currency")))


def _filtered_transactions(
    type: str | None = Query(None),
    account_id: uuid.UUID | None = Query(None),
    category_id: uuid.UUID | Literal["uncategorized"] | None = Query(None),
    invoice_id: uuid.UUID | None = Query(None),
    search: str | None = Query(None, max_length=100),
    start_date: date | None = Query(None),
    end_date: date | None = Query(None),
    user: User = Depends(get_current_user),
):
    if start_date and end_date and start_date > end_date:
        raise HTTPException(status_code=422, detail="Ngày bắt đầu phải trước hoặc bằng ngày kết thúc")
    q = select(Transaction).where(Transaction.user_id == user.id)

    if type:
        q = q.where(Transaction.type == type)
    if account_id:
        q = q.where(Transaction.account_id == account_id)
    if category_id == "uncategorized":
        q = q.where(Transaction.category_id.is_(None))
    elif category_id:
        q = q.where(Transaction.category_id == category_id)
    if invoice_id:
        from app.chuc_nang.nguoi_dung.hoa_don_ai.luu_tru.posting_evidence import InvoicePostingEvidence
        q = q.where(or_(Transaction.invoice_id == invoice_id, Transaction.id.in_(
            select(InvoicePostingEvidence.transaction_id).where(
                InvoicePostingEvidence.invoice_id == invoice_id, InvoicePostingEvidence.user_id == user.id))))
    if search and (term := search.strip()):
        # Treat LIKE metacharacters as text, not as user-provided wildcards.
        escaped = term.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_").replace("[", "\\[")
        pattern = f"%{escaped}%"
        q = q.where(or_(
            Transaction.description.ilike(pattern, escape="\\"),
            Transaction.note.ilike(pattern, escape="\\"),
        ))
    if start_date:
        q = q.where(Transaction.transaction_date >= start_date)
    if end_date:
        q = q.where(Transaction.transaction_date <= end_date)
    return q

