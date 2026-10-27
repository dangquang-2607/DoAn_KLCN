"""Account-free income/expense API, staged separately from legacy money routes."""
import uuid
from typing import Literal
from datetime import date
from decimal import Decimal
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, ConfigDict, Field, model_validator
from sqlalchemy import select, func
from sqlalchemy.orm import Session
from app.dung_chung.http.phu_thuoc import get_db, get_current_user
from app.chuc_nang.nguoi_dung.dang_nhap.luu_tru.nguoi_dung import User
from app.chuc_nang.nguoi_dung.danh_muc.phan_loai import suggest_category
from app.chuc_nang.nguoi_dung.hoa_don_ai.schemas.invoice import InvoiceConfirm
from app.chuc_nang.nguoi_dung.hoa_don_ai.luu_tru.invoice import Invoice
from app.chuc_nang.nguoi_dung.hoa_don_ai.nghiep_vu.vong_doi import transaction_removed
from app.chuc_nang.nguoi_dung.tai_chinh.vi_tai_khoan.luu_tru.wallet import Wallet
from app.chuc_nang.nguoi_dung.tai_chinh.bao_cao_tai_chinh.dich_vu import cashflow_range
from app.chuc_nang.nguoi_dung.tai_chinh.ngan_sach.ky_han import today_vn
from app.dung_chung.tac_vu_nen.hang_doi import enqueue
from .api import _filtered_transactions
from .schemas import TransactionOut, TransactionBatchDelete
from .luu_tru.giao_dich import Transaction, TransactionType, TransactionSource
from .so_cai import _verify_category_ownership
from .luy_dang import idempotent_money

router = APIRouter(prefix='/bookkeeping', tags=['Independent bookkeeping'])

class RecordCreate(BaseModel):
    model_config = ConfigDict(extra='forbid')
    category_id: uuid.UUID | None = None
    amount: Decimal = Field(gt=0, max_digits=19, decimal_places=2)
    type: TransactionType
    transaction_date: date
    description: str = Field(default='', max_length=255)
    note: str | None = Field(default=None, max_length=1000)
    include_in_reports: Literal[True] = True
    wallet_entry_id: uuid.UUID | None = None
    accept_separate_record: bool = False

class RecordUpdate(BaseModel):
    model_config = ConfigDict(extra='forbid')
    category_id: uuid.UUID | None = None
    amount: Decimal | None = Field(default=None, gt=0, max_digits=19, decimal_places=2)
    type: TransactionType | None = None
    transaction_date: date | None = None
    description: str | None = Field(default=None, max_length=255)
    note: str | None = Field(default=None, max_length=1000)
    include_in_reports: bool | None = None
    @model_validator(mode='before')
    @classmethod
    def nonnull(cls, data):
        if isinstance(data, dict) and any(k in data and data[k] is None for k in ('amount','type','transaction_date','description','include_in_reports')):
            raise ValueError('Thông tin thu chi không được null')
        return data

class RecordOut(TransactionOut):
    account_id: uuid.UUID | None = None
    wallet_entry_id: uuid.UUID | None = None
    include_in_reports: bool = True

class InvoiceRecord(InvoiceConfirm):
    account_id: None = None
    include_in_reports: Literal[True] = True
    wallet_entry_id: uuid.UUID | None = None
    accept_separate_record: bool = False

def create_record(db, user_id, source=TransactionSource.MANUAL, commit=False, **values):
    values.pop('account_id', None)
    category = values.get('category_id')
    if category:
        _verify_category_ownership(db, category, user_id, values['type'])
    amount = Decimal(values['amount'])
    if not amount.is_finite() or amount <= 0 or amount.as_tuple().exponent < -2:
        raise HTTPException(422, 'Số tiền phải dương và có tối đa 2 chữ số thập phân')
    values['amount'] = -amount if values['type'] == 'EXPENSE' else amount
    txn = Transaction(user_id=user_id, account_id=None, kind='NORMAL', source=source, **values)
    db.add(txn); db.flush()
    from app.chuc_nang.nguoi_dung.tai_chinh.thong_bao.dich_vu import maybe_emit_unusual_transaction
    maybe_emit_unusual_transaction(db, txn)
    if commit:
        db.commit()
    return txn

@router.get('')
def records(page: int = Query(1, ge=1), page_size: int = Query(20, ge=1, le=1000),
            included: bool | None = None, origin: str | None = Query(None, pattern='^(WALLET|OCR|MANUAL)$'),
            q=Depends(_filtered_transactions), db: Session = Depends(get_db)):
    q = q.where(Transaction.kind == 'NORMAL', Transaction.include_in_reports == True)
    if included is not None: q=q.where(Transaction.include_in_reports==included)
    if origin is not None: q=q.where(Transaction.source==origin)
    total = db.scalar(select(func.count()).select_from(q.subquery()))
    rows = db.scalars(q.order_by(Transaction.transaction_date.desc(), Transaction.created_at.desc(), Transaction.id.desc())
        .offset((page-1)*page_size).limit(page_size))
    return {'items': [RecordOut.model_validate(row).model_dump(mode='json') for row in rows],
            'total': total, 'page': page, 'page_size': page_size}

@router.get('/export-data')
def export(included: bool | None = None, origin: str | None = Query(None, pattern='^(WALLET|OCR|MANUAL)$'),
           q=Depends(_filtered_transactions), db: Session = Depends(get_db)):
    if included is not None: q=q.where(Transaction.include_in_reports==included)
    if origin is not None: q=q.where(Transaction.source==origin)
    return [RecordOut.model_validate(row).model_dump(mode='json') for row in db.scalars(
        q.where(Transaction.kind == 'NORMAL', Transaction.include_in_reports == True).order_by(Transaction.transaction_date.desc(), Transaction.id))]

@router.get('/dashboard')
def dashboard(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    today = today_vn()
    cf = cashflow_range(db, user.id, today.replace(day=1), today)
    balance = db.scalar(select(func.coalesce(func.sum(Wallet.balance),0)).where(Wallet.user_id == user.id, Wallet.is_active == True))
    recent = db.scalars(select(Transaction).where(Transaction.user_id == user.id, Transaction.kind == 'NORMAL', Transaction.include_in_reports == True)
        .order_by(Transaction.transaction_date.desc(), Transaction.created_at.desc()).limit(5))
    return {'net_worth': str(balance), 'income_this_month': cf['income'], 'expense_this_month': cf['expense'],
            'net_cash_flow': cf['net'], 'period': {'month': today.month,'year': today.year},
            'recent_transactions': [RecordOut.model_validate(t).model_dump(mode='json') for t in recent]}

@router.get('/payments')
def payments(amount: Decimal | None = Query(None, gt=0), paid_on: date | None = None,
             db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    from .payment_records import payment_records
    return payment_records(db,user.id,amount,paid_on)

@router.post('', status_code=201)
@idempotent_money
def create(payload: RecordCreate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    from .payment_records import linked_record, check_possible_payment
    values = payload.model_dump(exclude={'wallet_entry_id','accept_separate_record'})
    if payload.wallet_entry_id:
        existing,evidence=linked_record(db,user.id,payload.wallet_entry_id)
        if payload.type!='EXPENSE' or payload.amount>-evidence.amount:
            raise HTTPException(422,'Khoản ghi nhận phải là chi tiêu, không vượt số tiền thanh toán')
        # Reuse the existing record. Its invoice/source/evidence remain intact.
        values.pop('include_in_reports',None)
        return update.__wrapped__(tx_id=existing.id,payload=RecordUpdate(**values),db=db,user=user)
    if payload.type=='EXPENSE':
        check_possible_payment(db,user.id,payload.amount,payload.transaction_date,payload.accept_separate_record)
    if payload.category_id:
        values.update(category_source='MANUAL', category_confidence=Decimal('1.0000'), category_was_auto=False)
    else:
        suggestion = suggest_category(db, user.id, payload.type, description=payload.description, note=payload.note)
        if suggestion.auto_apply:
            values.update(category_id=suggestion.category_id, category_source=suggestion.source,
                          category_confidence=suggestion.confidence, category_was_auto=True)
    txn = create_record(db, user.id, **values)
    enqueue(db, 'BUDGET', {'user_id': str(user.id), 'transaction_id': str(txn.id)}, 'budget-check:'+str(txn.id))
    return RecordOut.model_validate(txn).model_dump(mode='json')

@router.patch('/{tx_id}')
@idempotent_money
def update(tx_id: uuid.UUID, payload: RecordUpdate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    txn = db.scalar(select(Transaction).where(Transaction.id == tx_id, Transaction.user_id == user.id,
        Transaction.kind == 'NORMAL').with_hint(Transaction, 'WITH (UPDLOCK, ROWLOCK)', dialect_name='mssql'))
    if txn is None:
        raise HTTPException(404, 'Không tìm thấy khoản thu chi')
    if not txn.wallet_entry_id and payload.include_in_reports is False:
        raise HTTPException(422,'Tính vào chi tiêu chỉ áp dụng cho khoản đã thanh toán bằng ví')
    if txn.wallet_entry_id:
        from .payment_records import linked_record
        _,evidence=linked_record(db,user.id,txn.wallet_entry_id)
        if (payload.type or txn.type)!='EXPENSE' or (payload.amount or abs(txn.amount))>-evidence.amount:
            raise HTTPException(422,'Khoản ghi nhận phải là chi tiêu, không vượt số tiền thanh toán')
    category = payload.category_id if 'category_id' in payload.model_fields_set else txn.category_id
    kind = payload.type or txn.type
    if category:
        _verify_category_ownership(db, category, user.id, kind, allow_inactive=category == txn.category_id and kind == txn.type)
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(txn, key, value)
    txn.amount = -abs(txn.amount) if txn.type == 'EXPENSE' else abs(txn.amount)
    if 'category_id' in payload.model_fields_set:
        txn.category_source = 'MANUAL' if category else None
        txn.category_confidence = Decimal('1.0000') if category else None
        txn.category_was_auto = False
    db.flush()
    if {'amount','transaction_date','category_id','type','include_in_reports'} & payload.model_fields_set:
        enqueue(db, 'BUDGET', {'user_id': str(user.id), 'transaction_id': str(txn.id)}, 'budget-check:record-update:'+uuid.uuid4().hex)
    return RecordOut.model_validate(txn).model_dump(mode='json')

def remove_records(db, user, ids):
    rows = db.scalars(select(Transaction).where(Transaction.user_id == user.id, Transaction.id.in_(ids),
        Transaction.kind == 'NORMAL').order_by(Transaction.id).with_hint(Transaction,'WITH (UPDLOCK, ROWLOCK)',dialect_name='mssql')).all()
    if len(rows) != len(ids):
        raise HTTPException(404, 'Có khoản thu chi không tồn tại hoặc không thuộc bạn')
    if any(row.wallet_entry_id for row in rows):
        raise HTTPException(409,'Khoản liên kết thanh toán ví được giữ để đối chiếu. Hãy tắt Tính vào chi tiêu thay vì xóa.')
    for row in rows:
        if row.invoice_id:
            invoice = db.scalar(select(Invoice).where(Invoice.id == row.invoice_id, Invoice.user_id == user.id)
                .with_hint(Invoice,'WITH (UPDLOCK, ROWLOCK)',dialect_name='mssql'))
            if invoice is None:
                raise HTTPException(409,'Hóa đơn liên kết không hợp lệ')
            transaction_removed(db, invoice, row.id)
        db.delete(row)
    db.flush()
    return {'deleted_count': len(rows)}

@router.post('/batch-delete')
@idempotent_money
def batch_delete(payload: TransactionBatchDelete, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return remove_records(db,user,payload.transaction_ids)

@router.delete('/{tx_id}')
@idempotent_money
def delete(tx_id: uuid.UUID, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return remove_records(db,user,[tx_id])

@router.post('/invoices/{invoice_id}/confirm', status_code=201)
def record_invoice(invoice_id: uuid.UUID, payload: InvoiceRecord, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    from app.chuc_nang.nguoi_dung.hoa_don_ai.nghiep_vu.xac_nhan_hoa_don import confirm
    return confirm(db, user, invoice_id, payload, record_only=True)
