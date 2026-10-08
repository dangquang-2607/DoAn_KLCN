"""
Dịch vụ sổ cái xử lý nghiệp vụ tạo, sửa và xóa giao dịch.
Tự động cập nhật số dư tài khoản và truyền source (MANUAL/OCR/IMPORT/SYSTEM).
Cải tiến:
  - IDOR Guard: kiểm tra quyền sở hữu account_id và category_id trước khi xử lý.
  - Non-blocking: cảnh báo ngân sách chạy qua BackgroundTasks, không chặn API response.
"""
import uuid
import json
from functools import wraps
from decimal import Decimal
from datetime import date
from fastapi import HTTPException
from sqlalchemy import select, func, or_
from sqlalchemy.orm import Session

from app.chuc_nang.nguoi_dung.tai_chinh.vi_tai_khoan.luu_tru.account import Account
from app.chuc_nang.nguoi_dung.tai_chinh.giao_dich.luu_tru.giao_dich import Transaction, TransactionType, TransactionSource
from app.chuc_nang.nguoi_dung.tai_chinh.ngan_sach.luu_tru.ngan_sach import Budget
from app.chuc_nang.nguoi_dung.hoa_don_ai.luu_tru.invoice import Invoice
from app.chuc_nang.nguoi_dung.danh_muc.luu_tru.danh_muc import Category
from app.chuc_nang.nguoi_dung.dang_nhap.luu_tru.nguoi_dung import User
from app.chuc_nang.nguoi_dung.tai_chinh.giao_dich.schemas import TransactionUpdate
from app.dung_chung.email.dich_vu import EmailService
from app.dung_chung.tac_vu_nen.hang_doi import enqueue_email
from app.chuc_nang.nguoi_dung.tai_chinh.thong_bao.dich_vu import emit_notification, maybe_emit_unusual_transaction



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
    """Xác minh tài khoản thuộc user hiện tại; trả lỗi 400 nếu không hợp lệ."""
    acc = db.scalar(
        select(Account).where(Account.id == account_id, Account.user_id == user_id, Account.is_active == True).with_hint(Account, "WITH (UPDLOCK, ROWLOCK)", dialect_name="mssql").execution_options(populate_existing=True)
    )
    if not acc:
        raise HTTPException(
            status_code=400,
            detail="Tài khoản ví không hợp lệ hoặc không thuộc quyền sở hữu của bạn"
        )
    if acc.bank_state:
        import json
        if json.loads(acc.bank_state).get("external_account"):
            raise HTTPException(409, "Ví ngân hàng mô phỏng chỉ nhận giao dịch đồng bộ")
    return acc


def _verify_category_ownership(db: Session, category_id: uuid.UUID, user_id: uuid.UUID, tx_type=None, *, allow_inactive: bool = False) -> None:
    """Kiểm tra quyền/loại; chỉ cho giữ danh mục đã ẩn trên chính giao dịch lịch sử."""
    query = select(Category).where(
        Category.id == category_id,
        or_(Category.owner_user_id == user_id, Category.owner_user_id.is_(None))
    )
    if not allow_inactive:
        # SQL Server bit không hỗ trợ cú pháp "IS 1" do .is_(True) sinh ra.
        query = query.where(Category.is_active == True)
    cat = db.scalar(query.with_hint(Category, "WITH (UPDLOCK, ROWLOCK)", dialect_name="mssql").execution_options(populate_existing=True))
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
    if acc.bank_managed:
        raise HTTPException(409, "Ví ngân hàng chỉ cập nhật số dư qua đồng bộ")

    # Rule CSDL: INCOME >= 0, EXPENSE <= 0
    actual_amount = abs(amount) if tx_type == TransactionType.INCOME else -abs(amount)

    if is_revert:
        acc.balance -= actual_amount
    else:
        acc.balance += actual_amount
    # Ghi thay đổi tạm trước lần đọc có khóa thứ hai trong cùng một unit of work.
    db.flush([acc])


def check_budget_alerts_background(db: Session, user_id: uuid.UUID, txn: Transaction):
    """
    Kiểm tra và kích hoạt cảnh báo ngân sách nếu chi tiêu chạm ngưỡng >= 80% hoặc >= 100%.
    Được gọi từ BackgroundTasks — KHÔNG chặn API response.
    """
    if txn.type != TransactionType.EXPENSE or txn.kind != "NORMAL":
        return

    tx_date = txn.transaction_date.date() if hasattr(txn.transaction_date, 'date') else txn.transaction_date
    from app.chuc_nang.nguoi_dung.tai_chinh.ngan_sach.ky_han import period_bounds, progress_for_period, settings_on, today_vn

    # Tìm các ngân sách đang hoạt động bao quát ngày giao dịch này
    q = select(Budget).where(
        Budget.user_id == user_id,
        Budget.start_date <= tx_date,
        ((Budget.is_recurring == True) & (
            (Budget.recurrence_end_date == None) | (Budget.recurrence_end_date >= tx_date)
        )) | ((Budget.is_recurring == False) & (Budget.end_date >= tx_date)),
    )
    if txn.category_id:
        q = q.where((Budget.category_id == txn.category_id) | (Budget.category_id == None))
    else:
        q = q.where(Budget.category_id == None)

    budgets = db.scalars(q).all()
    if not budgets:
        return

    user = db.get(User, user_id)

    for b in budgets:
        try:
            if b.is_recurring and b.recurrence_end_date == today_vn() and not b.is_active:
                continue
            if not settings_on(b, tx_date).is_active:
                continue
            bounds = period_bounds(b, tx_date)
            if not bounds:
                continue
            progress = progress_for_period(db, b, *bounds, max(tx_date, today_vn()))
            total_spent = Decimal(progress["spent_amount"])
            limit = Decimal(progress["amount_limit"])

            if limit > 0:
                pct = float((total_spent / limit) * 100)
                warn_thresh = float(progress["warning_percent"])

                if pct >= warn_thresh or pct >= 100.0:
                    threshold = "100" if pct >= 100 else str(progress["warning_percent"])
                    emit_notification(db, user_id=user_id, kind="BUDGET", severity="WARNING",
                                      title="Ngân sách đã vượt hạn mức" if pct >= 100 else "Ngân sách gần chạm hạn mức",
                                      message=f"{progress['budget_name']}: đã chi {total_spent} / {limit} VND ({pct:.0f}%).",
                                      source_type="BUDGET", source_id=b.id, action_url="/budgets",
                                      metadata={"spent": str(total_spent), "limit": str(limit), "percent": round(pct, 2)},
                                      dedupe_key=f"budget:{b.id}:{bounds[0]}:{bounds[1]}:{threshold}")
                    if user and user.email:
                        enqueue_email(db, EmailService.send_budget_alert_email,
                            recipient=user.email,
                            full_name=user.full_name or "Quý khách",
                            category_name=progress["budget_name"],
                            budget_amount=float(limit),
                            spent_amount=float(total_spent),
                            percentage=pct,
                            owner_user_id=user.id,
                            dedupe_key=f"budget:{b.id}:{bounds[0]}:{bounds[1]}:{threshold}"
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

    if not isinstance(account_id, uuid.UUID):
        raise HTTPException(status_code=422, detail="account_id không hợp lệ")
    amount_exponent = amount.as_tuple().exponent if isinstance(amount, Decimal) else None
    if (
        not isinstance(amount, Decimal)
        or not amount.is_finite()
        or amount <= 0
        or not isinstance(amount_exponent, int)
        or amount_exponent < -2
    ):
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
    db.flush()
    maybe_emit_unusual_transaction(db, txn)

    if commit:
        db.commit()
        db.refresh(txn)
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

    if txn.bank_reference:
        changes = payload.model_dump(exclude_unset=True)
        if set(changes) - {"note", "category_id"}:
            raise HTTPException(409, "Giao dịch ngân hàng chỉ cho sửa danh mục và ghi chú")
        if payload.category_id:
            _verify_category_ownership(db, payload.category_id, user_id, txn.type,
                                       allow_inactive=payload.category_id == txn.category_id)
        for key, value in changes.items():
            setattr(txn, key, value)
        if "category_id" in changes:
            txn.category_confidence = Decimal("1.0000") if txn.category_id else None
            txn.category_source = "MANUAL" if txn.category_id else None
            txn.category_was_auto = False
        if commit: db.commit()
        else: db.flush()
        db.refresh(txn)
        return txn
    _require_editable(txn)

    # IDOR Guard: kiểm tra quyền sở hữu ví mới (nếu thay đổi)
    new_account_id = payload.account_id or txn.account_id

    # IDOR Guard: kiểm tra quyền sở hữu danh mục mới (nếu thay đổi)
    effective_category = payload.category_id if "category_id" in payload.model_fields_set else txn.category_id
    if effective_category:
        effective_type = payload.type or txn.type
        _verify_category_ownership(db, effective_category, user_id, effective_type,
                                   allow_inactive=effective_category == txn.category_id and effective_type == txn.type)

    # Khóa mọi ví bị tác động theo thứ tự xác định trước khi cập nhật bất kỳ số dư nào.
    for account_id in sorted({txn.account_id, new_account_id}, key=str):
        _verify_account_ownership(db, account_id, user_id)
    # Hoàn nguyên số dư cũ
    _adjust_balance(db, txn.account_id, txn.amount, txn.type, is_revert=True)

    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(txn, k, v)
    if "category_id" in payload.model_fields_set:
        txn.category_confidence = Decimal("1.0000") if txn.category_id else None
        txn.category_source = "MANUAL" if txn.category_id else None
        txn.category_was_auto = False

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
def delete_transactions(db: Session, tx_ids: list[uuid.UUID], user_id: uuid.UUID, commit: bool = True) -> int:
    """Xóa nguyên tử các dòng đã chọn, mở rộng cả cặp chuyển tiền và giữ đối soát ngân hàng."""
    selected_ids = sorted(set(tx_ids), key=str)
    if not selected_ids:
        raise HTTPException(status_code=422, detail="Cần chọn ít nhất một giao dịch")
    selected = db.scalars(select(Transaction).where(
        Transaction.id.in_(selected_ids), Transaction.user_id == user_id,
    ).order_by(Transaction.id).with_hint(Transaction, "WITH (UPDLOCK, ROWLOCK)", dialect_name="mssql")
        .execution_options(populate_existing=True)).all()
    if len(selected) != len(selected_ids):
        raise HTTPException(status_code=404, detail="Có giao dịch không tồn tại hoặc không thuộc tài khoản của bạn")

    transactions = {txn.id: txn for txn in selected}
    pair_ids = {txn.transfer_id for txn in selected if txn.kind == "TRANSFER" and txn.transfer_id}
    if any(txn.kind == "TRANSFER" and not txn.transfer_id for txn in selected):
        raise HTTPException(status_code=409, detail="Cặp chuyển tiền thiếu mã liên kết")
    if pair_ids:
        partners = db.scalars(select(Transaction).where(
            Transaction.transfer_id.in_(pair_ids), Transaction.user_id == user_id,
        ).order_by(Transaction.id).with_hint(Transaction, "WITH (UPDLOCK, ROWLOCK)", dialect_name="mssql")
            .execution_options(populate_existing=True)).all()
        for pair_id in pair_ids:
            legs = [txn for txn in partners if txn.transfer_id == pair_id]
            if len(legs) != 2 or {txn.type for txn in legs} != {TransactionType.INCOME, TransactionType.EXPENSE}:
                raise HTTPException(status_code=409, detail="Cặp chuyển tiền không đầy đủ; chưa xóa giao dịch nào")
        transactions.update((txn.id, txn) for txn in partners)

    account_ids = sorted({txn.account_id for txn in transactions.values()}, key=str)
    accounts = {account.id: account for account in db.scalars(select(Account).where(
        Account.id.in_(account_ids), Account.user_id == user_id,
    ).order_by(Account.id).with_hint(Account, "WITH (UPDLOCK, ROWLOCK)", dialect_name="mssql")
        .execution_options(populate_existing=True)).all()}
    if len(accounts) != len(account_ids):
        raise HTTPException(status_code=409, detail="Tài khoản của giao dịch không còn hợp lệ")

    invoice_ids = sorted({txn.invoice_id for txn in transactions.values() if txn.invoice_id}, key=str)
    invoices = {invoice.id: invoice for invoice in db.scalars(select(Invoice).where(
        Invoice.id.in_(invoice_ids), Invoice.user_id == user_id,
    ).order_by(Invoice.id).with_hint(Invoice, "WITH (UPDLOCK, ROWLOCK)", dialect_name="mssql")
        .execution_options(populate_existing=True)).all()} if invoice_ids else {}
    if len(invoices) != len(invoice_ids):
        raise HTTPException(status_code=409, detail="Hóa đơn liên kết không còn hợp lệ")

    for txn in sorted(transactions.values(), key=lambda row: str(row.id)):
        account = accounts[txn.account_id]
        if not txn.bank_reference and not account.bank_managed:
            account.balance -= txn.amount
        elif txn.bank_reference and account.bank_state:
            # Nguồn demo vẫn giữ biến động tiền; ghi dấu ref để lần đồng bộ sau không nhập lại.
            state = json.loads(account.bank_state)
            imported = state.setdefault("imported", [])
            if txn.bank_reference not in imported:
                imported.append(txn.bank_reference)
                account.bank_state = json.dumps(state, ensure_ascii=True)
        if txn.invoice_id:
            invoice = invoices[txn.invoice_id]
            invoice.status = "REVIEW_REQUIRED"
            invoice.confirmed_at = None
        db.delete(txn)
    db.flush()
    if commit: db.commit()
    return len(transactions)


def delete_transaction(db: Session, tx_id: uuid.UUID, user_id: uuid.UUID, commit: bool = True) -> None:
    delete_transactions(db, [tx_id], user_id, commit=commit)


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

    if acc_from is None or acc_to is None:
        raise HTTPException(status_code=404, detail="Tài khoản nguồn hoặc tài khoản đích không còn tồn tại")

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
    if txn.bank_reference:
        raise HTTPException(409, "Không được xóa giao dịch ngân hàng đã đồng bộ")
    if txn.kind != "NORMAL" or txn.source == TransactionSource.SYSTEM:
        raise HTTPException(status_code=409, detail="Không được sửa hoặc xóa riêng giao dịch chuyển tiền/điều chỉnh số dư")


def record_balance_adjustment(db: Session, account: Account, user_id: uuid.UUID, new_balance: Decimal):
    """Thêm điều chỉnh bất biến trong cùng transaction với thay đổi số dư."""
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
