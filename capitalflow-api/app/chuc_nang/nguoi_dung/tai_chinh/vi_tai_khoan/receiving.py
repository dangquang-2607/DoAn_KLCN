"""Stable wallet identities, default wallet and versioned QR receiving contract."""
import base64
import re
import uuid
from urllib.parse import urlsplit, parse_qs
from fastapi import HTTPException
from pydantic import EmailStr, TypeAdapter, ValidationError
from sqlalchemy import select
import qrcode
from qrcode.image.svg import SvgPathFillImage
from app.chuc_nang.nguoi_dung.dang_nhap.luu_tru.nguoi_dung import User
from app.chuc_nang.nguoi_dung.dang_nhap.nghiep_vu.session_management import locked_user
from .luu_tru.wallet import Wallet
from .wallet_codes import insert_wallet, CODE_ALPHABET


def ensure_default_wallet(db, user):
    # Serialize registration/login/list fallback: concurrent calls never mint funds.
    user = locked_user(db, user.id, user.token_version)
    if user.is_deleted:
        raise HTTPException(403, 'Tài khoản không còn hoạt động')
    wallet = db.scalar(select(Wallet).where(Wallet.user_id == user.id, Wallet.is_default == True))
    if wallet is None:
        wallet = insert_wallet(db, user_id=user.id, name='Ví mặc định', balance=0, is_default=True)
    return wallet


def qr_payload(wallet_id):
    return f'capitalflow://transfer?v=1&wallet_id={wallet_id}'


def parse_recipient(value):
    value = value.strip()
    if value.startswith('capitalflow:'):
        url = urlsplit(value)
        query = parse_qs(url.query, keep_blank_values=True)
        if (url.scheme != 'capitalflow' or url.netloc != 'transfer' or url.path or url.fragment
                or set(query) != {'v', 'wallet_id'} or query['v'] != ['1'] or len(query['wallet_id']) != 1):
            raise ValueError('QR CapitalFlow không hợp lệ hoặc không được hỗ trợ')
        value = query['wallet_id'][0]
    elif '@' in value:
        return 'email', str(TypeAdapter(EmailStr).validate_python(value)).lower()
    elif re.fullmatch(r'CF-[' + CODE_ALPHABET + r']{8}', value.upper()):
        return 'code', value.upper()
    if not re.fullmatch(r'[0-9a-fA-F]{8}-(?:[0-9a-fA-F]{4}-){3}[0-9a-fA-F]{12}', value):
        raise ValueError('Nhập email, mã ví hoặc nội dung QR CapitalFlow hợp lệ')
    return 'wallet', uuid.UUID(value)


def resolve_recipient(db, sender, value):
    try:
        kind, identity = parse_recipient(value)
    except (ValueError, ValidationError):
        raise HTTPException(422, 'Email, mã ví hoặc QR CapitalFlow không hợp lệ') from None
    query = select(Wallet, User.full_name).join(User).where(
        Wallet.is_active == True, User.is_active == True, User.is_deleted == False)
    if kind == 'email':
        query = query.where(User.email == identity, Wallet.is_default == True)
    elif kind == 'code':
        query = query.where(Wallet.short_code == identity, Wallet.is_default == False)
    else:
        query = query.where(Wallet.id == identity)
    row = db.execute(query).first()
    if row is None:
        raise HTTPException(404, 'Không tìm thấy ví nhận đang hoạt động')
    wallet, name = row
    return {'id': str(wallet.id), 'name': wallet.name, 'recipient_name': name or 'Người dùng CapitalFlow',
            'is_own': wallet.user_id == sender.id, 'is_default': wallet.is_default}


def receive_info(wallet, user):
    payload = qr_payload(wallet.id)
    qr = qrcode.QRCode(error_correction=qrcode.constants.ERROR_CORRECT_M, border=4, box_size=8)
    qr.add_data(payload); qr.make(fit=True)
    svg = qr.make_image(image_factory=SvgPathFillImage).to_string()
    return {'wallet_id': str(wallet.id), 'wallet_name': wallet.name, 'recipient_name': user.full_name,
            'receive_code': user.email if wallet.is_default else wallet.short_code, 'is_default': wallet.is_default,
            'qr_version': 1, 'qr_payload': payload,
            'qr_image_data_url': 'data:image/svg+xml;base64,' + base64.b64encode(svg).decode('ascii')}
