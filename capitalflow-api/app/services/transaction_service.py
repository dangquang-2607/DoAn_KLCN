"""
Transaction Service — xử lý nghiệp vụ tạo/sửa/xóa giao dịch.
Tự động cập nhật số dư tài khoản và truyền source (MANUAL/OCR/IMPORT/SYSTEM).
"""
import uuid
from decimal import Decimal
from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.account import Account
from app.models.transaction import Transaction, TransactionType, TransactionSource
from app.schemas.transaction import TransactionUpdate


def _adjust_balance(
    db: Session,
    account_id: uuid.UUID,
    amount: Decimal,
    tx_type: TransactionType,
    is_revert: bool = False,
) -> None:
    """Cập nhật số dư tài khoản. Dùng FOR UPDATE để tránh race condition."""
    acc = db.scalar(select(Account).where(Account.id == account_id).with_for_update())
    if not acc:
        raise HTTPException(status_code=404, detail="Tài khoản không tồn tại")

    # Rule CSDL: INCOME >= 0, EXPENSE <= 0
    actual_amount = abs(amount) if tx_type == TransactionType.INCOME else -abs(amount)

    if is_revert:
        acc.balance -= actual_amount
    else:
        acc.balance += actual_amount


def create_transaction(
    db: Session,
    user_id: uuid.UUID,
    source: TransactionSource = TransactionSource.MANUAL,
    **kwargs,
) -> Transaction:
    """Tạo giao dịch mới và cập nhật số dư tài khoản."""
    amount = kwargs.get("amount", Decimal("0"))
    tx_type = kwargs.get("type", TransactionType.EXPENSE)

    # Đảm bảo dấu số tiền đúng với quy tắc DB
    if tx_type == TransactionType.EXPENSE and amount > 0:
        kwargs["amount"] = -amount
    elif tx_type == TransactionType.INCOME and amount < 0:
        kwargs["amount"] = abs(amount)

    txn = Transaction(user_id=user_id, source=source, **kwargs)
    db.add(txn)

    _adjust_balance(db, txn.account_id, txn.amount, txn.type)

    db.commit()
    db.refresh(txn)
    return txn


def update_transaction(
    db: Session,
    tx_id: uuid.UUID,
    user_id: uuid.UUID,
    payload: TransactionUpdate,
) -> Transaction:
    """Cập nhật giao dịch: hoàn nguyên số dư cũ rồi áp dụng số dư mới."""
    txn = db.scalar(
        select(Transaction).where(
            Transaction.id == tx_id, Transaction.user_id == user_id
        )
    )
    if not txn:
        raise HTTPException(status_code=404, detail="Không tìm thấy giao dịch")

    # Hoàn nguyên số dư cũ
    _adjust_balance(db, txn.account_id, txn.amount, txn.type, is_revert=True)

    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(txn, k, v)

    # Đảm bảo dấu số tiền sau khi cập nhật
    if txn.type == TransactionType.EXPENSE and txn.amount > 0:
        txn.amount = -txn.amount
    elif txn.type == TransactionType.INCOME and txn.amount < 0:
        txn.amount = abs(txn.amount)

    # Áp dụng số dư mới
    _adjust_balance(db, txn.account_id, txn.amount, txn.type)

    db.commit()
    db.refresh(txn)
    return txn


def delete_transaction(db: Session, tx_id: uuid.UUID, user_id: uuid.UUID) -> None:
    """Xóa giao dịch và hoàn nguyên số dư tài khoản."""
    txn = db.scalar(
        select(Transaction).where(
            Transaction.id == tx_id, Transaction.user_id == user_id
        )
    )
    if not txn:
        raise HTTPException(status_code=404, detail="Không tìm thấy giao dịch")

    _adjust_balance(db, txn.account_id, txn.amount, txn.type, is_revert=True)
    db.delete(txn)
    db.commit()
