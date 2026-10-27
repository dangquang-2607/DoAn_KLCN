"""Preflight OCR stays in memory; only reviewed, distinct documents reach storage."""
import asyncio
import json
import uuid
from datetime import datetime
from decimal import Decimal
from cryptography.fernet import Fernet, InvalidToken
from fastapi import HTTPException
from fastapi.encoders import jsonable_encoder
from sqlalchemy import select, or_
from app.dung_chung.config import settings
from app.chuc_nang.nguoi_dung.hoa_don_ai.ha_tang.gemini import run_gemini_ocr
from app.chuc_nang.nguoi_dung.hoa_don_ai.luu_tru.invoice import Invoice
from .phan_tich_du_lieu import parse_amount, parse_date
from .chuan_hoa_hoa_don import parse_invoice_time, refresh_identity
from .doi_chieu_ban_le import basket_signature

TICKET_TTL = 1800


def amount(value, quantity=False):
    result = Decimal(str(value or 0).replace(',', '.')) if quantity else parse_amount(value)
    limit = Decimal('99999999999999.9999' if quantity else '99999999999999999.99')
    if not result.is_finite() or not 0 <= result <= limit:
        raise ValueError('Invalid amount')
    return result.quantize(Decimal('.0001' if quantity else '.01'))


def normalize(result, xml=False):
    if not isinstance(result, dict) or not isinstance(result.get('items', []), list) or len(result.get('items', [])) > 200:
        raise ValueError('Invalid OCR structure')
    fields = {}
    for field, key, length in [('merchant_name', 'ten_nguoi_ban', 255), ('merchant_address', 'dia_chi_nguoi_ban', 500),
            ('merchant_tax_code', 'ma_so_thue', 100), ('invoice_number', 'so_hoa_don', 100),
            ('invoice_symbol', 'mau_so_ky_hieu', 100), ('vat_rate', 'thue_suat_gtgt', 50),
            ('payment_method', 'hinh_thuc_thanh_toan', 50)]:
        fields[field] = str(result.get(field if xml else key) or '')[:length].strip()
    if not fields['merchant_name'] and not xml:
        fields['merchant_name'] = str(result.get('ten_nguoi_ban_mua') or '')[:255].strip()
    fields['invoice_date'] = parse_date(str(result.get('invoice_date' if xml else 'ngay_lap') or ''))
    fields['invoice_time'] = parse_invoice_time(result.get('invoice_time' if xml else 'gio_lap'))
    fields['currency'] = 'VND'
    for field, key in [('subtotal_amount', 'doanh_so_chua_thue'), ('tax_amount', 'tien_thue_gtgt'), ('total_amount', 'tong_thanh_toan')]:
        fields[field] = amount(result.get(field if xml else key))
    confidence = result.get('do_tin_cay')
    if confidence is not None and not xml:
        confidence = Decimal(str(confidence))
        if not confidence.is_finite() or not 0 <= confidence <= 1:
            raise ValueError('Invalid confidence')
        fields['ocr_confidence'] = confidence
    fields['extracted_json'] = json.dumps(jsonable_encoder(result), ensure_ascii=False)
    items = []
    for item in result.get('items', []):
        if not isinstance(item, dict):
            raise ValueError('Invalid line')
        row = {'name': str(item.get('name' if xml else 'ten_hang') or 'Hàng hóa')[:500]}
        for field, key, size in [('sku', 'ma_hang', 100), ('unit', 'don_vi', 50), ('raw_text', 'raw_text', 1000)]:
            row[field] = str(item.get(field if xml else key) or '')[:size] or None
        for field, key in [('quantity', 'so_luong'), ('unit_price', 'don_gia'), ('discount_amount', 'giam_gia'), ('tax_amount', 'thue'), ('line_total', 'thanh_tien')]:
            row[field] = amount(item.get(field if xml else key), quantity=field == 'quantity')
        items.append(row)
    return fields, items


def require_readable(fields, items):
    # Missing identifiers are not evidence of uniqueness. Fail closed before insertion.
    if not (fields['merchant_name'] and fields['invoice_date'] and fields['total_amount'] > 0
            and (fields['invoice_number'] or basket_signature(items))):
        raise HTTPException(422, detail={'code': 'UPLOAD_INSUFFICIENT_DATA', 'message':
            'Chưa đọc đủ người bán, ngày, tổng tiền và số hóa đơn hoặc chi tiết hàng. Chưa tạo hóa đơn; hãy chọn ảnh rõ, đầy đủ hơn.'})


def require_comparable_history(db, user_id):
    blockers = db.scalars(select(Invoice).where(Invoice.user_id == user_id, Invoice.deleted_at.is_(None),
        Invoice.duplicate_of_invoice_id.is_(None), or_(Invoice.status.in_(['UPLOADED', 'PROCESSING', 'FAILED']),
        Invoice.invoice_date.is_(None), Invoice.total_amount.is_(None), Invoice.merchant_name.is_(None),
        Invoice.merchant_name == '', Invoice.total_amount <= 0)).order_by(Invoice.created_at).limit(20)).all()
    if blockers:
        raise HTTPException(409, detail={'code': 'UPLOAD_HISTORY_INCOMPLETE', 'message':
            'Có hóa đơn cũ chưa đủ dữ liệu đối chiếu. Hãy quét/hoàn tất các bản này rồi tải lại; chưa tạo bản mới.',
            'blockers': [{'id': str(i.id), 'filename': i.original_filename, 'status': i.status} for i in blockers]})


def prepare(user, contents, mime, file_hash, source, xml_data, ticket):
    reviewed = None
    if ticket:
        try:
            payload = json.loads(Fernet(settings.job_encryption_key.encode()).decrypt(ticket.encode(), ttl=TICKET_TTL))
            if [payload['user'], payload['version'], payload['hash'], payload['source']] != [str(user.id), user.token_version, file_hash, source]:
                raise ValueError('Ticket binding mismatch')
            raw, is_xml, preview_id = payload['raw'], payload['xml'], payload['preview_id']
            reviewed = payload['reviewed']
        except (InvalidToken, ValueError, KeyError, TypeError):
            raise HTTPException(409, detail={'code': 'UPLOAD_TICKET_EXPIRED', 'message': 'Phiên đối chiếu hết hạn hoặc không hợp lệ. Hãy tải lại để kiểm tra.'}) from None
    else:
        preview_id, is_xml = str(uuid.uuid4()), xml_data is not None
        if is_xml:
            raw = xml_data
        else:
            async def bounded():
                return await asyncio.wait_for(run_gemini_ocr(contents, mime), timeout=90)
            try:
                raw = asyncio.run(bounded())
            except Exception:
                raise HTTPException(503, detail={'code': 'UPLOAD_OCR_UNAVAILABLE', 'message':
                    'Chưa kiểm tra được hóa đơn do OCR bận, hết hạn mức hoặc mất kết nối. Chưa tạo bản mới; hãy thử lại sau.'}) from None
    try:
        fields, items = normalize(raw, is_xml)
    except (ValueError, TypeError, ArithmeticError):
        raise HTTPException(422, detail={'code': 'UPLOAD_INVALID_OCR', 'message': 'Kết quả nhận diện chưa hợp lệ. Chưa tạo hóa đơn; hãy chọn ảnh rõ hơn hoặc thử lại.'}) from None
    require_readable(fields, items)
    preview = Invoice(id=uuid.UUID(preview_id), user_id=user.id, revision=1, status='REVIEW_REQUIRED',
        file_sha256=file_hash, source='IMPORT' if is_xml else source, **fields)
    # A transient candidate must compare against every persisted draft, including
    # one committed by a concurrent upload after this request began OCR.
    preview.created_at = datetime.max
    preview._duplicate_items = items
    refresh_identity(preview)
    payload = {'user': str(user.id), 'version': user.token_version, 'hash': file_hash, 'source': source,
        'raw': raw, 'xml': is_xml, 'preview_id': preview_id, 'reviewed': reviewed}
    return preview, items, payload


def require_review(check, payload, accept_distinct):
    if check['level'] == 'NONE':
        return
    if accept_distinct and payload['reviewed'] == check['review_token']:
        return
    payload = {**payload, 'reviewed': check['review_token']}
    # Keep Decimal/XML values exact across review; do not round-trip via floats.
    ticket = Fernet(settings.job_encryption_key.encode()).encrypt(json.dumps(payload, default=str).encode()).decode()
    raise HTTPException(409, detail={'code': 'UPLOAD_REVIEW_REQUIRED', 'message':
        'Nghi trùng hóa đơn. Chưa tạo bản mới; hãy đối chiếu bản cũ trước khi xác nhận đây là hóa đơn khác.',
        'duplicate_check': check, 'upload_ticket': ticket})
