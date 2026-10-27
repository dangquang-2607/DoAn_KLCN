"""Link a personal record to immutable wallet evidence; never move wallet money."""
from datetime import date
from decimal import Decimal
from fastapi import HTTPException
from sqlalchemy import select, cast, Date
from .luu_tru.giao_dich import Transaction
from ..vi_tai_khoan.luu_tru.wallet import Wallet, WalletEntry


def payment_records(db, user_id, amount=None, paid_on: date | None=None):
    query=select(WalletEntry,Transaction).join(Wallet,Wallet.id==WalletEntry.wallet_id).join(
        Transaction,Transaction.wallet_entry_id==WalletEntry.id).where(
        Wallet.user_id==user_id,Transaction.user_id==user_id,WalletEntry.kind=='PAYMENT')
    if amount is not None: query=query.where(WalletEntry.amount==-abs(Decimal(amount)))
    if paid_on is not None:
        # Entry timestamps are UTC, while bookkeeping dates use Vietnam time.
        from datetime import datetime, time, timedelta
        start=datetime.combine(paid_on,time.min)-timedelta(hours=7)
        query=query.where(WalletEntry.created_at>=start,WalletEntry.created_at<start+timedelta(days=1))
    rows=db.execute(query.order_by(WalletEntry.created_at.desc(),WalletEntry.id).limit(100)).all()
    return [{'wallet_entry_id':str(e.id),'transaction_id':str(t.id),'wallet_id':str(e.wallet_id),
        'merchant_name':e.merchant_name,'bill_reference':e.bill_reference,'paid_amount':str(-e.amount),
        'recorded_amount':str(abs(t.amount)),'include_in_reports':t.include_in_reports,
        'invoice_id':str(t.invoice_id) if t.invoice_id else None,'created_at':e.created_at.isoformat()} for e,t in rows]


def linked_record(db,user_id,entry_id):
    tx=db.scalar(select(Transaction).where(Transaction.user_id==user_id,Transaction.wallet_entry_id==entry_id)
        .with_hint(Transaction,'WITH (UPDLOCK, ROWLOCK)',dialect_name='mssql').execution_options(populate_existing=True))
    evidence=db.scalar(select(WalletEntry).join(Wallet,Wallet.id==WalletEntry.wallet_id).where(
        WalletEntry.id==entry_id,WalletEntry.kind=='PAYMENT',Wallet.user_id==user_id))
    if tx is None or evidence is None:
        raise HTTPException(404,'Không tìm thấy khoản thanh toán ví của bạn')
    return tx,evidence


def check_possible_payment(db,user_id,amount,paid_on,accept_separate):
    if accept_separate: return
    candidates=payment_records(db,user_id,amount,paid_on)
    if candidates:
        raise HTTPException(409,detail={'code':'PAYMENT_RECORD_REVIEW_REQUIRED',
            'message':'Có khoản thanh toán ví cùng ngày và số tiền. Hãy liên kết khoản đã có hoặc xác nhận đây là khoản khác.',
            'candidates':candidates})
