"""Cung cấp REST API quản lý tài khoản tài chính của người dùng.

Vai trò: điều phối tạo, đọc, sửa và đóng/xóa tài khoản qua service/ORM.
Đầu vào: DTO account, current user và DB session.
Đầu ra: response schema hoặc HTTP error nhất quán.
Ràng buộc: mọi truy cập phải giới hạn theo chủ sở hữu và bảo toàn quy tắc số dư.
"""

from app.modules.taichinh.idempotency import idempotent_money
import uuid
from decimal import Decimal
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.shared.http.dependencies import get_current_user, get_db
from app.modules.taichinh.persistence.account import Account
from app.modules.dangnhap.persistence.user import User
from app.modules.taichinh.ledger import record_balance_adjustment
from app.modules.taichinh.accounts.schemas import AccountCreate, AccountOut, AccountUpdate

router = APIRouter(prefix="/accounts", tags=["Accounts"])


@router.get(
    "",
    response_model=list[AccountOut],
    summary="Danh sách tài khoản (List Accounts)",
    description=(
        "🇻🇳 **Mô tả**: Lấy danh sách tất cả các tài khoản tài chính đang hoạt động của người dùng "
        "(tiền mặt, tài khoản ngân hàng, ví điện tử...).\n\n"
        "🇬🇧 **Description**: Retrieve all active financial accounts (cash, bank, e-wallets) "
        "belonging to the current user."
    ),
)
def list_accounts(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    accounts = db.scalars(
        select(Account)
        .where(Account.user_id == user.id, Account.is_active == True)
        .order_by(Account.created_at.desc())
    ).all()
    return accounts


@router.post(
    "",
    response_model=AccountOut,
    status_code=201,
    summary="Tạo tài khoản mới (Create Account)",
    description=(
        "🇻🇳 **Mô tả**: Tạo mới một tài khoản tài chính với số dư ban đầu, loại tài khoản và tiền tệ.\n\n"
        "🇬🇧 **Description**: Create a new financial account with initial balance, account type, and currency."
    ),
)
@idempotent_money
def create_account(payload: AccountCreate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    values = payload.model_dump()
    opening_balance = values.pop("balance")
    acc = Account(user_id=user.id, balance=Decimal("0"), **values)
    db.add(acc)
    db.flush()
    record_balance_adjustment(db, acc, user.id, opening_balance)
    db.flush()
    db.refresh(acc)
    return acc


@router.patch(
    "/{acc_id}",
    response_model=AccountOut,
    summary="Cập nhật tài khoản (Update Account)",
    description=(
        "🇻🇳 **Mô tả**: Cập nhật thông tin tài khoản tài chính theo ID (tên tài khoản, số dư, ghi chú).\n\n"
        "🇬🇧 **Description**: Update financial account details by ID (account name, balance, notes)."
    ),
)
@idempotent_money
def update_account(acc_id: uuid.UUID, payload: AccountUpdate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    acc = db.scalar(select(Account).where(Account.id == acc_id, Account.user_id == user.id).with_hint(Account, "WITH (UPDLOCK, ROWLOCK)", dialect_name="mssql").execution_options(populate_existing=True))
    if not acc:
        raise HTTPException(status_code=404, detail="Không tìm thấy tài khoản")
    values = payload.model_dump(exclude_unset=True)
    if "balance" in values:
        if values["balance"] is None:
            raise HTTPException(status_code=422, detail="Số dư không được null")
        record_balance_adjustment(db, acc, user.id, values.pop("balance"))
    for k, v in values.items():
        setattr(acc, k, v)
    db.flush()
    db.refresh(acc)
    return acc


@router.delete(
    "/{acc_id}",
    status_code=204,
    summary="Xóa tài khoản (Delete Account)",
    description=(
        "🇻🇳 **Mô tả**: Xóa mềm (is_active=False) tài khoản tài chính. "
        "Lịch sử giao dịch cũ được giữ nguyên. "
        "Nếu tài khoản còn số dư dương, trả về cảnh báo 409 để người dùng xác nhận.\n\n"
        "🇬🇧 **Description**: Soft delete (is_active=False) the account. "
        "Historical transactions are preserved. "
        "Returns 409 warning if the account still has a non-zero balance, "
        "requiring explicit confirmation via ?force=true."
    ),
)
@idempotent_money
def delete_account(
    acc_id: uuid.UUID,
    force: bool = False,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    acc = db.scalar(select(Account).where(Account.id == acc_id, Account.user_id == user.id).with_hint(Account, "WITH (UPDLOCK, ROWLOCK)", dialect_name="mssql").execution_options(populate_existing=True))
    if not acc:
        raise HTTPException(status_code=404, detail="Không tìm thấy tài khoản")

    # Cảnh báo nếu ví còn số dư (Option A: cảnh báo, cho phép override bằng ?force=true)
    if not force and acc.balance and Decimal(str(acc.balance)) != Decimal("0"):
        raise HTTPException(
            status_code=409,
            detail=(
                f"Tài khoản '{acc.name}' hiện còn số dư {acc.balance:,.0f}đ. "
                "Toàn bộ lịch sử giao dịch cũ sẽ được giữ nguyên. "
                "Nếu vẫn muốn xóa, vui lòng gọi lại với tham số ?force=true."
            ),
        )

    # Xóa mềm tài khoản để giữ nguyên toàn bộ lịch sử giao dịch.
    acc.is_active = False
    db.flush()
