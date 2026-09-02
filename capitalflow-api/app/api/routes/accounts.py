import uuid
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session
from app.api.dependencies import get_current_user, get_db
from app.models.account import Account
from app.models.user import User
from app.schemas.account import AccountCreate, AccountOut, AccountUpdate

router = APIRouter(prefix="/accounts", tags=["Accounts"])

@router.get("", response_model=list[AccountOut])
def list_accounts(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    accounts = db.scalars(select(Account).where(Account.user_id == user.id, Account.is_active == True).order_by(Account.created_at.desc())).all()
    return accounts

@router.post("", response_model=AccountOut, status_code=201)
def create_account(payload: AccountCreate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    acc = Account(user_id=user.id, **payload.model_dump())
    db.add(acc)
    db.commit()
    db.refresh(acc)
    return acc

@router.patch("/{acc_id}", response_model=AccountOut)
def update_account(acc_id: uuid.UUID, payload: AccountUpdate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    acc = db.scalar(select(Account).where(Account.id == acc_id, Account.user_id == user.id))
    if not acc:
        raise HTTPException(status_code=404, detail="Không tìm thấy tài khoản")
    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(acc, k, v)
    db.commit()
    db.refresh(acc)
    return acc

@router.delete("/{acc_id}", status_code=204)
def delete_account(acc_id: uuid.UUID, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """Soft delete: đánh dấu is_active=False thay vì xóa khỏi DB."""
    acc = db.scalar(select(Account).where(Account.id == acc_id, Account.user_id == user.id))
    if not acc:
        raise HTTPException(status_code=404, detail="Không tìm thấy tài khoản")
    acc.is_active = False
    db.commit()
