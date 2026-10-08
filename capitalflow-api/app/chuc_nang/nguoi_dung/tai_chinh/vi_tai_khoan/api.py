"""Cung cấp REST API quản lý tài khoản tài chính của người dùng.

Vai trò: điều phối tạo, đọc, sửa và xóa vĩnh viễn ví qua service/ORM.
Đầu vào: DTO account, current user và DB session.
Đầu ra: response schema hoặc HTTP error nhất quán.
Ràng buộc: mọi truy cập phải giới hạn theo chủ sở hữu và cập nhật ví đối ứng khi xóa chuyển tiền.
"""

from app.chuc_nang.nguoi_dung.tai_chinh.giao_dich.luy_dang import idempotent_money
import uuid
from decimal import Decimal
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.dung_chung.http.phu_thuoc import get_current_user, get_db
from app.chuc_nang.nguoi_dung.tai_chinh.vi_tai_khoan.luu_tru.account import Account
from app.chuc_nang.nguoi_dung.dang_nhap.luu_tru.nguoi_dung import User
from app.chuc_nang.nguoi_dung.tai_chinh.giao_dich.so_cai import record_balance_adjustment
from app.chuc_nang.nguoi_dung.tai_chinh.vi_tai_khoan.schemas import AccountCreate, AccountOut, AccountUpdate
from app.chuc_nang.nguoi_dung.tai_chinh.vi_tai_khoan.deletion import deletion_preview, delete_wallet

def validate_wallet(values):
    kind = values.get("account_type")
    if kind == "LINKED" and not values.get("institution_name"):
        raise HTTPException(422, "Vui lòng chọn ngân hàng")
    if kind == "SAVINGS" and (not values.get("target_amount") or not values.get("target_date")):
        raise HTTPException(422, "Ví tiết kiệm cần mục tiêu và ngày hoàn thành")
    if kind in ("BASIC", "LINKED", "SAVINGS") and Decimal(values.get("balance") or 0) < 0:
        raise HTTPException(422, "Số dư của ba loại ví mới không được âm")
    for key in ("exclude_from_total", "is_notification_enabled"):
        if values.get(key) is None:
            raise HTTPException(422, "Switch không được null")
    if kind != "SAVINGS":
        values["target_amount"] = None
        values["target_date"] = None
    if kind not in ("LINKED", "BANK", "E_WALLET"):
        values["account_number_masked"] = None
    if kind not in ("LINKED", "BANK", "E_WALLET"):
        values["institution_name"] = None
    return values


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
    values = validate_wallet(payload.model_dump())
    opening_balance = values.pop("balance")
    acc = Account(user_id=user.id, balance=Decimal("0"), **values)
    db.add(acc)
    db.flush()
    record_balance_adjustment(db, acc, user.id, opening_balance)
    db.flush()
    db.refresh(acc)
    return AccountOut.model_validate(acc).model_dump()


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
    if "is_active" in values:
        raise HTTPException(422, "Không thể đổi trạng thái ví qua chức năng sửa; hãy dùng chức năng xóa ví")
    if acc.bank_state:
        import json
        if json.loads(acc.bank_state).get("external_account"):
            protected = {"balance": acc.balance, "account_type": acc.account_type,
                         "institution_name": acc.institution_name,
                         "account_number_masked": acc.account_number_masked}
            if any(k in values and values[k] != v for k, v in protected.items()):
                raise HTTPException(409, "Ví ngân hàng được quản lý bởi nguồn mô phỏng")
    merged = {k: getattr(acc, k) for k in AccountCreate.model_fields}
    merged.update(values)
    checked = validate_wallet(merged)
    for key in ("target_amount", "target_date", "institution_name", "account_number_masked"):
        values[key] = checked[key]
    if "balance" in values:
        if values["balance"] is None:
            raise HTTPException(status_code=422, detail="Số dư không được null")
        record_balance_adjustment(db, acc, user.id, values.pop("balance"))
    for k, v in values.items():
        setattr(acc, k, v)
    db.flush()
    db.refresh(acc)
    return AccountOut.model_validate(acc).model_dump()


@router.get("/{acc_id}/deletion-preview", summary="Xem dữ liệu sẽ bị xóa cùng ví")
def get_deletion_preview(
    acc_id: uuid.UUID,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    acc = db.scalar(select(Account).where(Account.id == acc_id, Account.user_id == user.id))
    if not acc:
        raise HTTPException(status_code=404, detail="Không tìm thấy ví")
    return deletion_preview(db, acc, user.id)


@router.delete(
    "/{acc_id}",
    status_code=204,
    summary="Xóa vĩnh viễn ví và dữ liệu liên quan",
    description="Xóa ví, giao dịch, cả hai vế chuyển tiền và hóa đơn gắn với ví trong một transaction.",
)
@idempotent_money
def delete_account(
    acc_id: uuid.UUID,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    acc = db.scalar(select(Account).where(Account.id == acc_id, Account.user_id == user.id).with_hint(Account, "WITH (UPDLOCK, ROWLOCK)", dialect_name="mssql").execution_options(populate_existing=True))
    if not acc:
        raise HTTPException(status_code=404, detail="Không tìm thấy ví")
    delete_wallet(db, acc, user.id)
