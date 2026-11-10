"""One reporting record per immutable wallet entry, including historical movements."""
from datetime import timedelta
from sqlalchemy import select
from .luu_tru.giao_dich import Transaction
from ..vi_tai_khoan.luu_tru.wallet import Wallet, WalletEntry, DemoBankBalance
from app.chuc_nang.nguoi_dung.dang_nhap.luu_tru.nguoi_dung import User
from app.chuc_nang.nguoi_dung.danh_muc.phan_loai import suggest_category
from app.dung_chung.tac_vu_nen.hang_doi import enqueue

LABELS = {
    'TOPUP': 'Nạp từ ngân hàng', 'WITHDRAW': 'Rút về ngân hàng',
    'TRANSFER_IN': 'Nhận chuyển tiền', 'TRANSFER_OUT': 'Chuyển tiền',
    'PAYMENT': 'Thanh toán hóa đơn',
}


def movement_context(db, evidence, wallet):
    peer = db.get(Wallet, evidence.counterparty_wallet_id) if evidence.counterparty_wallet_id else None
    own_transfer = peer is not None and peer.user_id == wallet.user_id
    bank = db.get(DemoBankBalance, evidence.bank_id) if evidence.bank_id else None
    peer_user = db.get(User, peer.user_id) if peer else None
    # Other people's wallet names and balances are not exposed.
    counterparty = bank.provider if bank else peer.name if peer is not None and own_transfer else peer_user.full_name if peer_user else None
    label = LABELS.get(evidence.kind, 'Giao dịch ví')
    if own_transfer:
        label = 'Nhận tiền nội bộ' if evidence.amount > 0 else 'Chuyển tiền nội bộ'
    included = evidence.kind == 'PAYMENT' or (peer is not None and not own_transfer)
    description = f'{label} · {counterparty}' if counterparty else label
    if evidence.kind == 'PAYMENT':
        description = ' · '.join(filter(None, [evidence.merchant_name, evidence.bill_reference])) or label
    return description[:255], counterparty, own_transfer, included


def record_wallet_entry(db, evidence, wallet, *, notify_budget=True):
    """Caller holds the wallet/entry lock. Never adjusts money or existing preferences."""
    existing = db.scalar(select(Transaction).where(Transaction.wallet_entry_id == evidence.id))
    if existing is not None:
        return existing
    description, _, _, included = movement_context(db, evidence, wallet)
    kind = 'INCOME' if evidence.amount > 0 else 'EXPENSE'
    suggestion = suggest_category(db, wallet.user_id, kind, description=description, note=evidence.note)
    values = {}
    if suggestion.auto_apply and suggestion.category_id:
        values = dict(category_id=suggestion.category_id, category_source=suggestion.source,
                      category_confidence=suggestion.confidence, category_was_auto=True)
    txn = Transaction(user_id=wallet.user_id, wallet_entry_id=evidence.id, account_id=None,
        type=kind, kind='NORMAL', source='WALLET', amount=evidence.amount,
        transaction_date=(evidence.created_at + timedelta(hours=7)).date(),
        created_at=evidence.created_at, description=description, note=evidence.note,
        include_in_reports=included, **values)
    db.add(txn)
    db.flush()
    if notify_budget and included and kind == 'EXPENSE':
        enqueue(db, 'BUDGET', {'user_id': str(wallet.user_id), 'transaction_id': str(txn.id)},
                'budget-check:wallet-entry:' + str(evidence.id))
    return txn


def backfill_wallet_records(db, user_id=None):
    """Add missing rows once; preserve dates, balances and all existing user choices."""
    query = select(WalletEntry).where(~select(Transaction.id).where(
        Transaction.wallet_entry_id == WalletEntry.id).exists()).order_by(WalletEntry.id)
    if user_id is not None:
        query = query.where(WalletEntry.wallet_id.in_(select(Wallet.id).where(Wallet.user_id == user_id)))
    entries = db.scalars(query.with_hint(WalletEntry, 'WITH (UPDLOCK, HOLDLOCK)', dialect_name='mssql')).all()
    for evidence in entries:
        record_wallet_entry(db, evidence, db.get(Wallet, evidence.wallet_id), notify_budget=False)
    return len(entries)
