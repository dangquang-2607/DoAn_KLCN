import uuid
from datetime import date
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select, desc
from sqlalchemy.orm import Session
from app.api.dependencies import get_current_user, get_db
from app.models.transaction import Transaction
from app.models.user import User
from app.schemas.transaction import TransactionCreate, TransactionOut, TransactionPage, TransactionUpdate
from app.services.transaction_service import create_transaction, update_transaction, delete_transaction

router = APIRouter(prefix="/transactions", tags=["Transactions"])

@router.get("", response_model=TransactionPage)
def list_transactions(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=1000),
    type: str | None = None,
    account_id: uuid.UUID | None = None,
    category_id: uuid.UUID | None = None,
    start_date: date | None = None,
    end_date: date | None = None,
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
    
    # FIX: dùng subquery count thay vì load toàn bộ records (N+1 bug)
    count_q = select(func.count()).select_from(q.subquery())
    total = db.scalar(count_q) or 0
    items = db.scalars(q.offset((page - 1) * page_size).limit(page_size)).all()
    
    return TransactionPage(
        items=items,
        total=total,
        page=page,
        page_size=page_size
    )

@router.post("", response_model=TransactionOut, status_code=201)
def create_tx(
    payload: TransactionCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    txn = create_transaction(db, user.id, **payload.model_dump())
    return txn

@router.patch("/{tx_id}", response_model=TransactionOut)
def update_tx(
    tx_id: uuid.UUID,
    payload: TransactionUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    txn = update_transaction(db, tx_id, user.id, payload)
    return txn

@router.delete("/{tx_id}", status_code=204)
def delete_tx(
    tx_id: uuid.UUID,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    delete_transaction(db, tx_id, user.id)
