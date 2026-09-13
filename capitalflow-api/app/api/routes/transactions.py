from app.services.idempotency import idempotent_money
import uuid
from datetime import date
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.api.dependencies import get_current_user, get_db
from app.models.transaction import Transaction
from app.models.user import User
from app.schemas.transaction import (
    TransactionCreate,
    TransactionOut,
    TransactionPage,
    TransactionTransfer,
    TransactionUpdate,
)
from app.services.transaction_service import (
    check_budget_alerts_background,
    create_transaction,
    delete_transaction,
    transfer_money,
    update_transaction,
)
from app.core.database import SessionLocal
from app.services.jobs import enqueue

router = APIRouter(prefix="/transactions", tags=["Transactions"])


@router.get(
    "",
    response_model=TransactionPage,
    summary="Danh sách giao dịch (List Transactions)",
    description=(
        "🇻🇳 **Mô tả**: Lấy danh sách giao dịch tài chính của người dùng có hỗ trợ phân trang "
        "và lọc đa điều kiện (loại thu/chi, tài khoản, danh mục, thời gian).\n\n"
        "🇬🇧 **Description**: Retrieve a paginated list of transactions with optional filters "
        "by type, account, category, and date range."
    ),
)
def list_transactions(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=1000),
    type: str | None = Query(None),
    account_id: uuid.UUID | None = Query(None),
    category_id: uuid.UUID | None = Query(None),
    start_date: date | None = Query(None),
    end_date: date | None = Query(None),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    q = select(Transaction).where(Transaction.user_id == user.id)

    if type:
        q = q.where(Transaction.type == type)
    if account_id:
        q = q.where(Transaction.account_id == account_id)
    if category_id:
        q = q.where(Transaction.category_id == category_id)
    if start_date:
        q = q.where(Transaction.transaction_date >= start_date)
    if end_date:
        q = q.where(Transaction.transaction_date <= end_date)

    q = q.order_by(Transaction.transaction_date.desc(), Transaction.created_at.desc())

    count_q = select(func.count()).select_from(q.subquery())
    total = db.scalar(count_q) or 0
    items = db.scalars(q.offset((page - 1) * page_size).limit(page_size)).all()

    return TransactionPage(items=items, total=total, page=page, page_size=page_size)


@router.post(
    "",
    response_model=TransactionOut,
    status_code=201,
    summary="Tạo giao dịch mới (Create Transaction)",
    description=(
        "🇻🇳 **Mô tả**: Tạo mới giao dịch thu hoặc chi và tự động cập nhật số dư tài khoản tương ứng. "
        "Cảnh báo ngân sách được gửi ngầm (non-blocking) sau khi phản hồi về client.\n\n"
        "🇬🇧 **Description**: Create a new income or expense transaction with automatic balance update. "
        "Budget alerts are sent asynchronously in the background."
    ),
)
@idempotent_money
def create_tx(
    payload: TransactionCreate,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    if payload.source != "MANUAL" or payload.invoice_id is not None:
        raise HTTPException(status_code=422, detail="Nguồn giao dịch và hóa đơn do hệ thống quản lý")
    txn = create_transaction(db, user.id, commit=False, **payload.model_dump())

    enqueue(db, "BUDGET", {"user_id": str(user.id), "transaction_id": str(txn.id)}, "budget-check:"+str(txn.id))
    db.flush()

    return txn


@router.post(
    "/transfer",
    status_code=201,
    summary="Chuyển tiền giữa các ví (Transfer Between Accounts)",
    description=(
        "🇻🇳 **Mô tả**: Chuyển tiền nguyên tử (ACID) giữa 2 ví của cùng 1 người dùng. "
        "Tạo hai vế thu/chi kind=TRANSFER có transfer_id chung. "
        "Nếu lỗi bất kỳ bước nào, toàn bộ sẽ tự rollback — không mất tiền.\n\n"
        "🇬🇧 **Description**: Atomically transfer funds between two accounts of the same user. "
        "Creates a linked pair with kind=TRANSFER. Full rollback on any error."
    ),
)
@idempotent_money
def transfer_tx(
    payload: TransactionTransfer,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    txn_out, txn_in = transfer_money(
        db=db,
        user_id=user.id,
        from_account_id=payload.from_account_id,
        to_account_id=payload.to_account_id,
        amount=payload.amount,
        transaction_date=payload.transaction_date,
        note=payload.note,
        commit=False,
    )
    return {
        "success": True,
        "transfer_out_id": str(txn_out.id),
        "transfer_in_id": str(txn_in.id),
        "from_account_id": str(payload.from_account_id),
        "to_account_id": str(payload.to_account_id),
        "amount": str(payload.amount),
    }


@router.patch(
    "/{tx_id}",
    response_model=TransactionOut,
    summary="Cập nhật giao dịch (Update Transaction)",
    description=(
        "🇻🇳 **Mô tả**: Chỉnh sửa thông tin giao dịch tài chính và tự động điều chỉnh hoàn ứng số dư.\n\n"
        "🇬🇧 **Description**: Update transaction details and automatically adjust affected account balances."
    ),
)
@idempotent_money
def update_tx(
    tx_id: uuid.UUID,
    payload: TransactionUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    txn = update_transaction(db, tx_id, user.id, payload, commit=False)
    return txn


@router.delete(
    "/{tx_id}",
    status_code=204,
    summary="Xóa giao dịch (Delete Transaction)",
    description=(
        "🇻🇳 **Mô tả**: Xóa một giao dịch tài chính và hoàn trả số dư tài khoản về trạng thái ban đầu.\n\n"
        "🇬🇧 **Description**: Delete a financial transaction and revert its balance adjustment on the account."
    ),
)
@idempotent_money
def delete_tx(
    tx_id: uuid.UUID,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    delete_transaction(db, tx_id, user.id, commit=False)
