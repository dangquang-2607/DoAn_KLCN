"""
Transaction Service — xử lý nghiệp vụ tạo/sửa/xóa giao dịch.
Tự động cập nhật số dư tài khoản và truyền source (MANUAL/OCR/IMPORT/SYSTEM).
Cải tiến:
  - IDOR Guard: kiểm tra quyền sở hữu account_id và category_id trước khi xử lý.
  - Non-blocking: cảnh báo ngân sách chạy qua BackgroundTasks, không chặn API response.
"""
import uuid
from functools import wraps
from decimal import Decimal
from datetime import date
from fastapi import HTTPException
from sqlalchemy import select, func, or_
from sqlalchemy.orm import Session

from app.models.account import Account
from app.models.transaction import Transaction, TransactionType, TransactionSource
from app.models.budget import Budget
from app.models.category import Category
from app.models.user import User
from app.schemas.transaction import TransactionUpdate
from app.services.email_service import EmailService
from app.services.jobs import enqueue_email



def atomic_money_operation(fn):
    @wraps(fn)
    def wrapped(db, *args, **kwargs):
        try:
            return fn(db, *args, **kwargs)
        except Exception:
            db.rollback()
            raise
    return wrapped


def _verify_account_ownership(db: Session, account_id: uuid.UUID, user_id: uuid.UUID) -> Account:
    """Xác minh tài khoản ví thuộc về user hiện tại. Raise 400 nếu không hợp lệ."""
    acc = db.scalar(
        select(Account).where(Account.id == account_id, Account.user_id == user_id, Account.is_active == True).with_hint(Account, "WITH (UPDLOCK, ROWLOCK)", dialect_name="mssql").execution_options(populate_existing=True)
    )
    if not acc:
        raise HTTPException(
            status_code=400,
            detail="Tài khoản ví không hợp lệ hoặc không thuộc quyền sở hữu của bạn"
        )
    return acc


def _verify_category_ownership(db: Session, category_id: uuid.UUID, user_id: uuid.UUID, tx_type=None) -> None:
    """Xác minh danh mục thuộc về user hiện tại hoặc là danh mục hệ thống dùng chung."""
    cat = db.scalar(
        select(Category).where(
            Category.id == category_id,
            Category.is_active == True,
            or_(Category.owner_user_id == user_id, Category.owner_user_id.is_(None))
        ).with_hint(Category, "WITH (UPDLOCK, ROWLOCK)", dialect_name="mssql").execution_options(populate_existing=True)
    )
    if not cat:
        raise HTTPException(
            status_code=400,
            detail="Danh mục không hợp lệ hoặc không thuộc quyền sở hữu của bạn"
        )
    if tx_type is not None and cat.type != tx_type:
        raise HTTPException(status_code=422, detail="Loại danh mục không khớp loại giao dịch")


def _adjust_balance(
    db: Session,
    account_id: uuid.UUID,
    amount: Decimal,
    tx_type: TransactionType,
    is_revert: bool = False,
) -> None:
    """Cập nhật số dư tài khoản. Dùng UPDLOCK, ROWLOCK (MSSQL) để tránh race condition."""
    acc = db.scalar(select(Account).where(Account.id == account_id).with_hint(Account, "WITH (UPDLOCK, ROWLOCK)", dialect_name="mssql").execution_options(populate_existing=True))
    if not acc:
        raise HTTPException(status_code=404, detail="Tài khoản không tồn tại")

    # Rule CSDL: INCOME >= 0, EXPENSE <= 0
    actual_amount = abs(amount) if tx_type == TransactionType.INCOME else -abs(amount)

    if is_revert:
        acc.balance -= actual_amount
    else:
        acc.balance += actual_amount
    # Persist before a second locked read in the same unit of work.
    db.flush([acc])


def check_budget_alerts_background(db: Session, user_id: uuid.UUID, txn: Transaction):
    """
    Kiểm tra và kích hoạt cảnh báo ngân sách nếu chi tiêu chạm ngưỡng >= 80% hoặc >= 100%.
    Được gọi từ BackgroundTasks — KHÔNG chặn API response.
    """
    if txn.type != TransactionType.EXPENSE or txn.kind != "NORMAL":
        return

    tx_date = txn.transaction_date.date() if hasattr(txn.transaction_date, 'date') else txn.transaction_date

    # Tìm các ngân sách đang hoạt động bao quát ngày giao dịch này
    q = select(Budget).where(
        Budget.user_id == user_id,
        Budget.is_active == True,
        Budget.start_date <= tx_date,
        Budget.end_date >= tx_date
    )
    if txn.category_id:
        q = q.where((Budget.category_id == txn.category_id) | (Budget.category_id == None))
    else:
        q = q.where(Budget.category_id == None)

    budgets = db.scalars(q).all()
    if not budgets:
        return

    user = db.get(User, user_id)
    if not user or not user.email:
        return

    for b in budgets:
        spend_q = select(func.coalesce(func.sum(Transaction.amount), 0)).where(
            Transaction.user_id == user_id,
            Transaction.type == TransactionType.EXPENSE,
            Transaction.kind == "NORMAL",
            Transaction.transaction_date >= b.start_date,
            Transaction.transaction_date <= b.end_date,
        )
        if b.category_id:
            spend_q = spend_q.where(Transaction.category_id == b.category_id)

        try:
            total_spent_raw = db.scalar(spend_q) or 0
            total_spent = abs(Decimal(str(total_spent_raw)))
            limit = Decimal(str(b.amount_limit))

            if limit > 0:
                pct = float((total_spent / limit) * 100)
                warn_thresh = float(b.warning_percent or 80.0)

                if pct >= warn_thresh or pct >= 100.0:
                    enqueue_email(db, EmailService.send_budget_alert_email,
                        recipient=user.email,
                        full_name=user.full_name or "Quý khách",
                        category_name=b.name,
                        budget_amount=float(limit),
                        spent_amount=float(total_spent),
                        percentage=pct,
                        dedupe_key=f"budget:{b.id}:{b.start_date}:{b.end_date}:{100 if pct >= 100 else warn_thresh}"
                    )
        except Exception as e:
            raise RuntimeError("Budget alert scheduling failed") from None


@atomic_money_operation
def create_transaction(
    db: Session,
    user_id: uuid.UUID,
    source: TransactionSource = TransactionSource.MANUAL,
    commit: bool = True,
    **kwargs,
) -> Transaction:
    """
    Tạo giao dịch mới và cập nhật số dư tài khoản.
    Có IDOR Guard: kiểm tra quyền sở hữu account_id và category_id.
    Cảnh báo ngân sách sẽ được route gọi qua BackgroundTasks (non-blocking).
    """
    account_id = kwargs.get("account_id")
    category_id = kwargs.get("category_id")
    amount = kwargs.get("amount", Decimal("0"))
    tx_type = kwargs.get("type", TransactionType.EXPENSE)

    if not amount.is_finite() or amount <= 0 or amount.as_tuple().exponent < -2:
        raise HTTPException(status_code=422, detail="Số tiền phải dương và có tối đa 2 chữ số thập phân")

    # IDOR Guard: kiểm tra quyền sở hữu ví
    _verify_account_ownership(db, account_id, user_id)

    # IDOR Guard: kiểm tra quyền sở hữu danh mục (nếu có)
    if category_id:
        _verify_category_ownership(db, category_id, user_id, tx_type)

    # Đảm bảo dấu số tiền đúng với quy tắc DB
    if tx_type == TransactionType.EXPENSE and amount > 0:
        kwargs["amount"] = -amount
    elif tx_type == TransactionType.INCOME and amount < 0:
        kwargs["amount"] = abs(amount)

    txn = Transaction(user_id=user_id, source=source, **kwargs)
    db.add(txn)

    _adjust_balance(db, txn.account_id, txn.amount, txn.type)

    if commit:
        db.commit()
        db.refresh(txn)
    else:
        db.flush()
    return txn


@atomic_money_operation
def update_transaction(
    db: Session,
    tx_id: uuid.UUID,
    user_id: uuid.UUID,
    payload: TransactionUpdate,
    commit: bool = True,
) -> Transaction:
    """Cập nhật giao dịch: hoàn nguyên số dư cũ rồi áp dụng số dư mới."""
    txn = db.scalar(
        select(Transaction).where(
            Transaction.id == tx_id, Transaction.user_id == user_id
        ).with_hint(Transaction, "WITH (UPDLOCK, ROWLOCK)", dialect_name="mssql").execution_options(populate_existing=True)
    )
    if not txn:
        raise HTTPException(status_code=404, detail="Không tìm thấy giao dịch")

    _require_editable(txn)

    # IDOR Guard: kiểm tra quyền sở hữu ví mới (nếu thay đổi)
    new_account_id = payload.account_id or txn.account_id

    # IDOR Guard: kiểm tra quyền sở hữu danh mục mới (nếu thay đổi)
    effective_category = payload.category_id if "category_id" in payload.model_fields_set else txn.category_id
    if effective_category:
        _verify_category_ownership(db, effective_category, user_id, payload.type or txn.type)

    # Lock all touched wallets in deterministic order before updating either balance.
    for account_id in sorted({txn.account_id, new_account_id}, key=str):
        _verify_account_ownership(db, account_id, user_id)
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

    if commit: db.commit()
    else: db.flush()
    db.refresh(txn)
    return txn


@atomic_money_operation
def delete_transaction(db: Session, tx_id: uuid.UUID, user_id: uuid.UUID, commit: bool = True) -> None:
    """Xóa giao dịch và hoàn nguyên số dư tài khoản."""
    txn = db.scalar(
        select(Transaction).where(
            Transaction.id == tx_id, Transaction.user_id == user_id
        ).with_hint(Transaction, "WITH (UPDLOCK, ROWLOCK)", dialect_name="mssql").execution_options(populate_existing=True)
    )
    if not txn:
        raise HTTPException(status_code=404, detail="Không tìm thấy giao dịch")

    _require_editable(txn)
    _adjust_balance(db, txn.account_id, txn.amount, txn.type, is_revert=True)
    db.delete(txn)
    if commit: db.commit()
    else: db.flush()


@atomic_money_operation
def transfer_money(
    db: Session,
    user_id: uuid.UUID,
    from_account_id: uuid.UUID,
    to_account_id: uuid.UUID,
    amount: Decimal,
    transaction_date: date | None = None,
    note: str | None = None,
    commit: bool = True,
) -> tuple[Transaction, Transaction]:
    """
    Chuyển tiền nguyên tử (ACID) giữa 2 ví của cùng 1 người dùng.
    Tạo hai vế INCOME/EXPENSE, kind=TRANSFER, liên kết bằng transfer_id.
    Nếu có lỗi bất kỳ, toàn bộ sẽ rollback tự động.
    """
    from datetime import date as date_type
    from datetime import datetime

    if from_account_id == to_account_id:
        raise HTTPException(status_code=400, detail="Ví nguồn và ví đích không được trùng nhau")

    if amount <= 0:
        raise HTTPException(status_code=400, detail="Số tiền chuyển phải lớn hơn 0")

    # IDOR Guard: kiểm tra cả 2 ví
    for account_id in sorted((from_account_id, to_account_id), key=str):
        _verify_account_ownership(db, account_id, user_id)

    tx_date = transaction_date or datetime.now().date()

    # Tạo transfer_pair_id để liên kết cặp giao dịch
    transfer_pair_id = uuid.uuid4()
    desc_out = f"Chuyển tiền đi — Ref:{str(transfer_pair_id)[:8].upper()}"
    desc_in = f"Nhận chuyển tiền — Ref:{str(transfer_pair_id)[:8].upper()}"

    # Giao dịch chi (TRANSFER_OUT) ở ví nguồn
    txn_out = Transaction(
        user_id=user_id,
        account_id=from_account_id,
        amount=-abs(amount),
        type=TransactionType.EXPENSE,
        source=TransactionSource.SYSTEM,
        kind="TRANSFER",
        transfer_id=transfer_pair_id,
        transaction_date=tx_date,
        description=desc_out,
        note=note,
    )
    db.add(txn_out)

    # Giao dịch thu (TRANSFER_IN) ở ví đích
    txn_in = Transaction(
        user_id=user_id,
        account_id=to_account_id,
        amount=abs(amount),
        type=TransactionType.INCOME,
        source=TransactionSource.SYSTEM,
        kind="TRANSFER",
        transfer_id=transfer_pair_id,
        transaction_date=tx_date,
        description=desc_in,
        note=note,
    )
    db.add(txn_in)

    # Lock cả 2 ví theo thứ tự UUID nhất quán để ngăn ngừa triệt để deadlock
    first_id, second_id = (from_account_id, to_account_id) if str(from_account_id) < str(to_account_id) else (to_account_id, from_account_id)
    _acc_1 = db.scalar(select(Account).where(Account.id == first_id).with_hint(Account, "WITH (UPDLOCK, ROWLOCK)", dialect_name="mssql").execution_options(populate_existing=True))
    _acc_2 = db.scalar(select(Account).where(Account.id == second_id).with_hint(Account, "WITH (UPDLOCK, ROWLOCK)", dialect_name="mssql").execution_options(populate_existing=True))
    acc_from = _acc_1 if first_id == from_account_id else _acc_2
    acc_to = _acc_2 if first_id == from_account_id else _acc_1

    # Kiểm tra loại tiền tệ — hệ thống chỉ hỗ trợ VND
    if acc_from.currency != "VND" or acc_to.currency != "VND":
        raise HTTPException(
            status_code=400,
            detail="Hệ thống hiện chỉ hỗ trợ giao dịch bằng VND. Vui lòng kiểm tra lại loại tiền tệ của tài khoản."
        )

    # Kiểm tra số dư ví nguồn có đủ tiền không
    if acc_from.balance < abs(amount):
        raise HTTPException(
            status_code=400,
            detail=f"Số dư tài khoản '{acc_from.name}' ({acc_from.balance:,.0f}đ) không đủ để thực hiện chuyển {amount:,.0f}đ"
        )

    acc_from.balance -= abs(amount)
    acc_to.balance += abs(amount)

    if commit: db.commit()
    else: db.flush()
    db.refresh(txn_out)
    db.refresh(txn_in)

    return txn_out, txn_in


def _require_editable(txn: Transaction):
    if txn.kind != "NORMAL" or txn.source == TransactionSource.SYSTEM:
        raise HTTPException(status_code=409, detail="Không được sửa hoặc xóa riêng giao dịch chuyển tiền/điều chỉnh số dư")


def record_balance_adjustment(db: Session, account: Account, user_id: uuid.UUID, new_balance: Decimal):
    """Append an immutable adjustment in the same transaction as the balance change."""
    old_balance = Decimal(account.balance or 0)
    delta = new_balance - old_balance
    if not delta:
        return
    db.add(Transaction(
        user_id=user_id, account_id=account.id, amount=delta,
        type=TransactionType.INCOME if delta > 0 else TransactionType.EXPENSE,
        source=TransactionSource.SYSTEM, kind="ADJUSTMENT", transaction_date=date.today(),
        description="Điều chỉnh số dư", note=f"Số dư trước: {old_balance}; số dư sau: {new_balance}",
    ))
    account.balance = new_balance
