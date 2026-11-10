"""Simulated stored-value wallets, separate from bookkeeping and legacy accounts."""
import secrets
import math
import re
import uuid
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response
from pydantic import BaseModel, ConfigDict, Field, field_validator
from sqlalchemy import select, func
from sqlalchemy.orm import Session
from app.dung_chung.http.phu_thuoc import get_db, get_current_user
from app.dung_chung.text.unicode import normalize_unicode_text, validate_utf16_length
from app.dung_chung.money import format_vnd
from app.chuc_nang.nguoi_dung.dang_nhap.luu_tru.nguoi_dung import User
from app.chuc_nang.nguoi_dung.dang_nhap.luu_tru.dat_lai_mat_khau import PasswordResetOTP
from app.chuc_nang.nguoi_dung.dang_nhap.nghiep_vu.session_management import locked_user
from app.chuc_nang.nguoi_dung.tai_chinh.giao_dich.luy_dang import idempotent_money
from app.chuc_nang.nguoi_dung.tai_chinh.thong_bao.dich_vu import emit_notification
from .luu_tru.wallet import Wallet, DemoBankBalance, UserBankLink, WalletEntry
from .bill_qr import BillQRInput, parse_bill_qr
from .user_banks import provision, owned_bank
from .number_rules import NUMBER_RULES
from .link_otp import purpose_for, code_hash, consume_otp
from app.dung_chung.gui_mail import send_otp_email
from app.dung_chung.http.gioi_han_tan_suat import limiter
from .receiving import ensure_default_wallet, resolve_recipient, receive_info
from .wallet_codes import insert_wallet

router = APIRouter(prefix='/wallets', tags=['Independent wallets'])
MAX_MONEY = Decimal('99999999999999999.99')
BANK_OTP_RESEND_SECONDS = 120


def now():
    return datetime.now(timezone.utc).replace(tzinfo=None)

class StrictBody(BaseModel):
    model_config = ConfigDict(extra='forbid')

class WalletName(StrictBody):
    name: str = Field(min_length=1, max_length=150)
    @field_validator('name')
    @classmethod
    def normalized(cls, value):
        value = normalize_unicode_text(value, strip=True)
        if not value:
            raise ValueError('Tên ví không được rỗng')
        return validate_utf16_length(value, 150, 'Tên ví')

class BankRequest(StrictBody):
    provider: str
    account_number: str = Field(pattern=r'^[0-9]{6,20}$')

    @field_validator('account_number', mode='before')
    @classmethod
    def clean_account_number(cls, value):
        if not isinstance(value, str):
            raise ValueError('Số tài khoản phải là chuỗi chữ số, giữ nguyên số 0 ở đầu.')
        value = re.sub(r'[\s\u200b-\u200d\ufeff]', '', normalize_unicode_text(value))
        if re.fullmatch(r'[0-9]{6,20}', value) is None:
            raise ValueError('Số tài khoản chỉ được gồm 6–20 chữ số. Hãy dùng số tài khoản được cấp của ngân hàng đã chọn.')
        return value

class BankConfirm(BankRequest):
    otp_request_id: uuid.UUID
    otp: str = Field(pattern=r'^\d{6}$')

class BankMoney(StrictBody):
    link_id: uuid.UUID
    amount: Decimal = Field(gt=Decimal('0'), max_digits=19, decimal_places=2)

class Transfer(StrictBody):
    to_wallet_id: uuid.UUID
    amount: Decimal = Field(gt=Decimal('0'), max_digits=19, decimal_places=2)
    note: str = Field(default='', max_length=200)

    @field_validator('note')
    @classmethod
    def clean_note(cls, value):
        value = normalize_unicode_text(value, strip=True)
        return validate_utf16_length(value, 200, 'Nội dung chuyển tiền')

class RecipientLookup(StrictBody):
    recipient: str = Field(min_length=1, max_length=512)

class BillPayment(BillQRInput):
    category_id: uuid.UUID | None = None
    bookkeeping_id: uuid.UUID | None = None

def owned(db, user, wallet_id):
    wallet = db.scalar(select(Wallet).where(Wallet.id == wallet_id, Wallet.user_id == user.id,
        Wallet.is_active == True).with_hint(Wallet, 'WITH (UPDLOCK, ROWLOCK)', dialect_name='mssql')
        .execution_options(populate_existing=True))
    if wallet is None:
        raise HTTPException(404, 'Không tìm thấy ví')
    return wallet

def wallet_out(wallet, user=None):
    return {'id': str(wallet.id), 'name': wallet.name, 'balance': str(wallet.balance), 'currency': 'VND',
            'is_active': wallet.is_active, 'is_default': wallet.is_default,
            'receive_code': user.email if wallet.is_default and user else wallet.short_code,
            'created_at': wallet.created_at.isoformat(), 'demo': True}

@router.post('/recipients/resolve')
@limiter.limit('30/minute')
def lookup_recipient(request: Request, response: Response, payload: RecipientLookup, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    response.headers['Cache-Control'] = 'no-store'
    return resolve_recipient(db, user, payload.recipient)

@router.get('/{wallet_id}/receive')
def receiving_code(wallet_id: uuid.UUID, response: Response, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    wallet = owned(db, user, wallet_id)
    response.headers['Cache-Control'] = 'no-store'
    return receive_info(wallet, user)

@router.get('/providers')
def providers(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    locked_user(db, user.id, user.token_version)
    banks = provision(db, user)
    result = {key: {**NUMBER_RULES[key], 'demo_number': bank.account_number,
                   'demo': True, 'opening_balance': format(bank.opening_balance, '.2f')} for key, bank in banks.items()}
    db.commit()
    return result

@router.get('')
def list_wallets(include_closed: bool = False, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    ensure_default_wallet(db, user)
    db.commit()
    query = select(Wallet).where(Wallet.user_id == user.id)
    if not include_closed:
        query = query.where(Wallet.is_active == True)
    return [wallet_out(w, user) for w in db.scalars(query.order_by(Wallet.is_default.desc(), Wallet.created_at, Wallet.id))]

@router.post('', status_code=201)
@idempotent_money
def create_wallet(payload: WalletName, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    from app.chuc_nang.nguoi_dung.goi_dich_vu.han_muc import require_capacity
    ensure_default_wallet(db, user)
    require_capacity(db, user.id, "wallets")
    wallet = insert_wallet(db, user_id=user.id, name=payload.name, balance=Decimal(0))
    return wallet_out(wallet, user)

@router.patch('/{wallet_id}')
@idempotent_money
def rename(wallet_id: uuid.UUID, payload: WalletName, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    wallet = owned(db, user, wallet_id); wallet.name = payload.name
    return wallet_out(wallet, user)

@router.delete('/{wallet_id}')
@idempotent_money
def archive(wallet_id: uuid.UUID, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    wallet = owned(db, user, wallet_id)
    if wallet.is_default:
        raise HTTPException(409, 'Không thể đóng ví mặc định của tài khoản')
    if wallet.balance != 0:
        raise HTTPException(409, 'Rút hoặc chuyển hết tiền trước khi đóng ví')
    wallet.is_active = False
    return {'success': True}

@router.get('/history')
def all_history(wallet_id: uuid.UUID | None = None, page: int = Query(1, ge=1),
                page_size: int = Query(20, ge=1, le=100),
                db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return _wallet_history(db, user, wallet_id, page, page_size)


@router.get('/{wallet_id}/history')
def history(wallet_id: uuid.UUID, page: int = Query(1, ge=1), page_size: int = Query(20, ge=1, le=100),
            db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return _wallet_history(db, user, wallet_id, page, page_size)


def _wallet_history(db, user, wallet_id, page, page_size):
    # Archived wallets keep their immutable history accessible by owner.
    if wallet_id is not None and not db.scalar(select(Wallet.id).where(Wallet.id == wallet_id, Wallet.user_id == user.id)):
        raise HTTPException(404, 'Không tìm thấy ví')
    conditions = [Wallet.user_id == user.id]
    if wallet_id is not None:
        conditions.append(WalletEntry.wallet_id == wallet_id)
    query = select(WalletEntry).join(Wallet, Wallet.id == WalletEntry.wallet_id).where(*conditions)
    total = db.scalar(select(func.count()).select_from(query.subquery()))
    from ..giao_dich.luu_tru.giao_dich import Transaction
    from app.chuc_nang.nguoi_dung.danh_muc.luu_tru.danh_muc import Category
    entries = db.execute(select(WalletEntry,Transaction,Category.name,Wallet.name,Wallet.is_active)
        .join(Wallet,Wallet.id==WalletEntry.wallet_id)
        .outerjoin(Transaction,(Transaction.wallet_entry_id==WalletEntry.id) & (Transaction.user_id==user.id))
        .outerjoin(Category,Category.id==Transaction.category_id)
        .where(*conditions).order_by(WalletEntry.created_at.desc(),WalletEntry.id.desc())
        .offset((page-1)*page_size).limit(page_size))
    return {'total': total, 'page': page, 'page_size': page_size, 'items': [
        {'id': str(e.id), 'operation_id': str(e.operation_id), 'kind': e.kind, 'amount': str(e.amount),
         'wallet_id': str(e.wallet_id), 'wallet_name': wallet_name, 'wallet_is_active': wallet_is_active,
         'balance_after': str(e.balance_after), 'created_at': e.created_at.isoformat(),
         'merchant_name':e.merchant_name,'bill_reference':e.bill_reference,'note':e.note,
         'bookkeeping_id':str(t.id) if t else None,'recorded_amount':str(abs(t.amount)) if t else None,
         'include_in_reports':t.include_in_reports if t else None,
         'category_id':str(t.category_id) if t and t.category_id else None,'category_name':category_name,
         'counterparty_wallet_id': str(e.counterparty_wallet_id) if e.counterparty_wallet_id else None}
        for e,t,category_name,wallet_name,wallet_is_active in entries]}

@router.get('/banks')
def links( db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return [{'id': str(link.id), 'provider': bank.provider, 'account_number_masked': bank.account_number_masked,
             'is_active': link.is_active, 'expires_at': link.expires_at.isoformat(),
             'status': 'DISCONNECTED' if not link.is_active else 'EXPIRED' if link.expires_at <= now() else 'CONNECTED'}
            for link, bank in db.execute(select(UserBankLink, DemoBankBalance).join(DemoBankBalance).where(
                UserBankLink.user_id == user.id, DemoBankBalance.user_id == user.id))]

def available_bank_link(db, user, bank):
    # The caller holds the user lock so concurrent link requests cannot pass together.
    link = db.scalar(select(UserBankLink).where(
        UserBankLink.user_id == user.id, UserBankLink.bank_id == bank.id))
    if link is not None and link.is_active and link.expires_at > now():
        raise HTTPException(409, 'Tài khoản ngân hàng này đã được liên kết và có thể dùng cho tất cả ví của bạn.')
    return link


@router.post('/banks/send-otp')
async def send_otp( payload: BankRequest, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    locked_user(db, user.id, user.token_version)
    demo = owned_bank(db, user, payload)
    available_bank_link(db, user, demo)
    latest = db.scalar(select(PasswordResetOTP).where(PasswordResetOTP.user_id == user.id,
        PasswordResetOTP.purpose.like('LINK_BANK:%')).order_by(PasswordResetOTP.created_at.desc()))
    if latest:
        remaining = math.ceil((latest.created_at + timedelta(seconds=BANK_OTP_RESEND_SECONDS) - now()).total_seconds())
        if remaining > 0:
            raise HTTPException(429, f'Vui lòng chờ {remaining} giây trước khi gửi lại OTP',
                                headers={'Retry-After': str(remaining)})
    purpose = purpose_for('user-bank:' + str(demo.id), None)
    for old in db.scalars(select(PasswordResetOTP).where(PasswordResetOTP.user_id == user.id,
            PasswordResetOTP.purpose == purpose, PasswordResetOTP.is_used == False)):
        old.is_used = True
    code = f'{secrets.randbelow(1000000):06d}'; challenge = uuid.uuid4()
    otp = PasswordResetOTP(id=challenge, user_id=user.id, email=user.email, purpose=purpose,
        otp_code=code_hash(challenge, code), expires_at=now()+timedelta(minutes=5), is_used=False)
    db.add(otp); db.commit()
    try:
        await send_otp_email(to_email=user.email, otp_code=code, purpose_label='liên kết tài khoản ngân hàng')
    except Exception:
        otp.is_used = True; db.commit()
        raise HTTPException(503, 'Không gửi được OTP. Vui lòng thử lại') from None
    return {'otp_request_id': str(challenge), 'expires_in_seconds': 300,
            'resend_after_seconds': BANK_OTP_RESEND_SECONDS}

@router.post('/banks')
@idempotent_money
def link_bank( payload: BankConfirm, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    bank = owned_bank(db, user, payload)
    link = available_bank_link(db, user, bank)
    consume_otp(db, user, payload.otp_request_id, payload.otp, 'user-bank:' + str(bank.id))
    if link is None:
        link = UserBankLink(user_id=user.id, bank_id=bank.id)
        db.add(link)
    link.is_active = True; link.expires_at = now()+timedelta(days=90)
    db.flush()
    return {'id': str(link.id), 'status': 'CONNECTED'}

@router.delete('/banks/{link_id}')
@idempotent_money
def unlink( link_id: uuid.UUID, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    link = db.scalar(select(UserBankLink).where(UserBankLink.id == link_id, UserBankLink.user_id == user.id))
    if link is None:
        raise HTTPException(404, 'Không tìm thấy liên kết')
    link.is_active = False
    return {'success': True}

@router.get('/{wallet_id}/banks', deprecated=True)
def wallet_links(wallet_id: uuid.UUID, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    owned(db, user, wallet_id)
    return links(db=db, user=user)


def entry(db, wallet, operation_id, kind, amount, bank_id=None, other=None, note=None):
    if not 0 <= wallet.balance + amount <= MAX_MONEY:
        raise HTTPException(409, 'Số dư ví không đủ hoặc vượt giới hạn')
    wallet.balance += amount
    row = WalletEntry(operation_id=operation_id, wallet_id=wallet.id, bank_id=bank_id,
        counterparty_wallet_id=other, kind=kind, amount=amount, balance_after=wallet.balance, note=note)
    db.add(row)
    if kind != 'PAYMENT':
        # Payment records are created after merchant/reference are available in pay_bill.
        from ..giao_dich.wallet_records import record_wallet_entry
        db.flush()
        record_wallet_entry(db, row, wallet)
    emit_notification(db, user_id=wallet.user_id, kind='ACCOUNT', title='Biến động số dư ví',
        message=f'{wallet.name}: {format_vnd(amount, signed=True)}. Số dư: {format_vnd(wallet.balance)}.',
        source_type='WALLET', source_id=wallet.id, action_url='/accounts')
    return row

@router.post('/{wallet_id}/payments/create',status_code=201)
@idempotent_money
def pay_bill(wallet_id: uuid.UUID, payload: BillPayment, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    from ..giao_dich.bookkeeping import create_record
    from ..giao_dich.luu_tru.giao_dich import Transaction, TransactionSource
    from ..giao_dich.so_cai import _verify_category_ownership
    from ..ngan_sach.ky_han import today_vn
    from app.dung_chung.tac_vu_nen.hang_doi import enqueue
    bill = parse_bill_qr(payload.qr_payload)
    wallet=owned(db,user,wallet_id)
    previous=db.scalar(select(WalletEntry.id).join(Wallet,Wallet.id==WalletEntry.wallet_id).where(
        Wallet.user_id==user.id,WalletEntry.kind=='PAYMENT',
        WalletEntry.merchant_name==bill.merchant_name,WalletEntry.bill_reference==bill.bill_reference))
    if previous:
        raise HTTPException(409,'Mã hóa đơn này đã được thanh toán cho nhà cung cấp. Hãy xem Lịch sử giao dịch.')
    record: Transaction | None = None
    if payload.bookkeeping_id:
        record=db.scalar(select(Transaction).where(Transaction.id==payload.bookkeeping_id,Transaction.user_id==user.id)
            .with_hint(Transaction,'WITH (UPDLOCK, ROWLOCK)',dialect_name='mssql'))
        if record is None: raise HTTPException(404,'Không tìm thấy khoản ghi sổ')
        if record.wallet_entry_id or record.kind!='NORMAL' or record.type!='EXPENSE':
            raise HTTPException(409,'Khoản ghi sổ không phù hợp hoặc đã liên kết thanh toán')
        if abs(record.amount) != bill.amount:
            raise HTTPException(409,'Số tiền khoản ghi sổ phải khớp số tiền thanh toán hóa đơn')
        if record.invoice_id:
            from app.chuc_nang.nguoi_dung.hoa_don_ai.luu_tru.invoice import Invoice
            invoice=db.scalar(select(Invoice).where(Invoice.id==record.invoice_id,Invoice.user_id==user.id))
            if invoice is None or invoice.deleted_at or invoice.total_amount!=bill.amount or invoice.currency!='VND':
                raise HTTPException(409,'Hóa đơn đã ghi sổ phải còn hiển thị và khớp số tiền VND cần thanh toán')
        # Keep the selected record and its reporting preferences after matching the full payment.
    elif payload.category_id:
        _verify_category_ownership(db,payload.category_id,user.id,'EXPENSE')
    operation=uuid.uuid4()
    evidence=entry(db,wallet,operation,'PAYMENT',-bill.amount)
    evidence.merchant_name=bill.merchant_name
    evidence.bill_reference=bill.bill_reference
    sender_name = normalize_unicode_text(user.full_name or 'Người dùng CapitalFlow', strip=True)
    sender_name = sender_name.encode('utf-16-le')[:376].decode('utf-16-le', errors='ignore')
    evidence.note = bill.note or f'{sender_name} chuyển tiền'
    db.flush()
    if record is not None:
        record.wallet_entry_id=evidence.id; record.source=TransactionSource.WALLET
        record.note=evidence.note
    else:
        from app.chuc_nang.nguoi_dung.danh_muc.phan_loai import suggest_category
        category=payload.category_id; metadata={}
        if not category:
            suggestion=suggest_category(db,user.id,'EXPENSE',description=f'{bill.merchant_name} · {bill.bill_reference}',note=bill.note)
            if suggestion.auto_apply:
                category=suggestion.category_id
                metadata={'category_source':suggestion.source,'category_confidence':suggestion.confidence,'category_was_auto':True}
        record=create_record(db,user.id,source=TransactionSource.WALLET,amount=bill.amount,type='EXPENSE',
            transaction_date=today_vn(),description=f'{bill.merchant_name} · {bill.bill_reference}'[:255],
            note=evidence.note,category_id=category,wallet_entry_id=evidence.id,include_in_reports=True,**metadata)
    db.flush()
    enqueue(db,'BUDGET',{'user_id':str(user.id),'transaction_id':str(record.id)},'budget-check:payment:'+str(evidence.id))
    return {'operation_id':str(operation),'entry_id':str(evidence.id),'bookkeeping_id':str(record.id),
        'status':'SUCCEEDED','demo':True,'paid_amount':str(bill.amount),'balance':str(wallet.balance),
        'paid_at': evidence.created_at.replace(tzinfo=timezone.utc).isoformat()}

@router.post('/{wallet_id}/{action}')
@idempotent_money
def bank_money(wallet_id: uuid.UUID, action: str, payload: BankMoney, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    if action not in ('topup', 'withdraw'):
        raise HTTPException(404, 'Thao tác không hợp lệ')
    wallet = owned(db, user, wallet_id)
    link = db.scalar(select(UserBankLink).where(UserBankLink.id == payload.link_id,
        UserBankLink.user_id == user.id, UserBankLink.is_active == True))
    if link is None or link.expires_at <= now():
        raise HTTPException(409, 'Cần liên kết ngân hàng còn hiệu lực')
    bank = db.scalar(select(DemoBankBalance).where(DemoBankBalance.id == link.bank_id,
        DemoBankBalance.user_id == user.id).with_hint(DemoBankBalance, 'WITH (UPDLOCK, ROWLOCK)', dialect_name='mssql'))
    if bank is None:
        raise HTTPException(409, 'Liên kết ngân hàng không hợp lệ')
    delta = payload.amount if action == 'topup' else -payload.amount
    if not 0 <= bank.balance - delta <= MAX_MONEY:
        raise HTTPException(409, 'Số dư ngân hàng không đủ hoặc vượt giới hạn')
    op = uuid.uuid4()
    entry(db, wallet, op, 'TOPUP' if action == 'topup' else 'WITHDRAW', delta, bank_id=bank.id)
    bank.balance -= delta
    return {'operation_id': str(op), 'balance': str(wallet.balance)}

@router.post('/{wallet_id}/transfers/create')
@idempotent_money
def transfer(wallet_id: uuid.UUID, payload: Transfer, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    if wallet_id == payload.to_wallet_id:
        raise HTTPException(422, 'Chọn hai ví khác nhau')
    wallets = {w.id: w for w in db.scalars(select(Wallet).where(
        Wallet.id.in_([wallet_id, payload.to_wallet_id]), Wallet.is_active == True).order_by(Wallet.id)
        .with_hint(Wallet, 'WITH (UPDLOCK, ROWLOCK)', dialect_name='mssql')
        .execution_options(populate_existing=True))}
    if wallet_id not in wallets or wallets[wallet_id].user_id != user.id:
        raise HTTPException(404, 'Không tìm thấy ví gửi')
    target = wallets.get(payload.to_wallet_id)
    if target is None or not db.scalar(select(User.id).where(User.id == target.user_id, User.is_active == True)):
        raise HTTPException(404, 'Ví nhận không khả dụng')
    op = uuid.uuid4()
    sender_name = (user.full_name or 'Người dùng CapitalFlow').strip().encode('utf-16-le')[:376].decode('utf-16-le', errors='ignore')
    note = payload.note or f'{sender_name} chuyển tiền'
    entry(db, wallets[wallet_id], op, 'TRANSFER_OUT', -payload.amount, other=payload.to_wallet_id, note=note)
    entry(db, wallets[payload.to_wallet_id], op, 'TRANSFER_IN', payload.amount, other=wallet_id, note=note)
    return {'operation_id': str(op), 'balance': str(wallets[wallet_id].balance)}

@router.get('/recipients/{wallet_id}')
def recipient(wallet_id: uuid.UUID, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return resolve_recipient(db, user, str(wallet_id))
