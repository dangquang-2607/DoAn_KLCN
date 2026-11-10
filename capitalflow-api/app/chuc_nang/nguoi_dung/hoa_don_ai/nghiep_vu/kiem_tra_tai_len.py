"""Preflight OCR stays in memory; only reviewed, distinct documents reach storage."""
import asyncio
import json
import uuid
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from time import perf_counter
from cryptography.fernet import Fernet, InvalidToken
from fastapi import HTTPException
from fastapi.encoders import jsonable_encoder
from sqlalchemy import select, update
from app.dung_chung.config import settings
from app.dung_chung.text.unicode import truncate_utf16
from app.chuc_nang.nguoi_dung.hoa_don_ai.ha_tang.gemini import run_gemini_ocr
from app.chuc_nang.nguoi_dung.hoa_don_ai.luu_tru.invoice import Invoice
from app.chuc_nang.nguoi_dung.hoa_don_ai.luu_tru.tac_vu_ocr import OcrJob
from .phan_tich_du_lieu import parse_amount, parse_date, draft_currency, UnsupportedInvoiceCurrency
from .chuan_hoa_hoa_don import parse_invoice_time, refresh_identity

TICKET_TTL = 1800
UPLOAD_OCR_TIMEOUT_SECONDS = 90
# Allow another 90 seconds for scheduling/DB delays before closing an orphan.
UPLOAD_ATTEMPT_STALE_SECONDS = UPLOAD_OCR_TIMEOUT_SECONDS + 90
INTERRUPTED_UPLOAD_MESSAGE = "Lượt nhận diện ảnh tải lên đã bị gián đoạn. Hãy thử lại ảnh tại màn Quét hóa đơn."


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
        fields[field] = truncate_utf16(str(result.get(field if xml else key) or ''), length).strip()
    if not fields['merchant_name'] and not xml:
        fields['merchant_name'] = truncate_utf16(str(result.get('ten_nguoi_ban_mua') or ''), 255).strip()
    fields['invoice_date'] = parse_date(str(result.get('invoice_date' if xml else 'ngay_lap') or ''))
    fields['invoice_time'] = parse_invoice_time(result.get('invoice_time' if xml else 'gio_lap'))
    fields['currency'] = draft_currency(result.get('currency' if xml else 'tien_te'))
    # XML numbers use canonical decimal syntax, including after ticket JSON round-trips.
    def money_value(value):
        return Decimal(str(value)) if xml and value is not None and value != '' else value

    for field, key in [('subtotal_amount', 'doanh_so_chua_thue'), ('tax_amount', 'tien_thue_gtgt'), ('total_amount', 'tong_thanh_toan')]:
        fields[field] = amount(money_value(result.get(field if xml else key)))
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
        row: dict[str, str | Decimal | None] = {'name': truncate_utf16(str(item.get('name' if xml else 'ten_hang') or 'Hàng hóa'), 500)}
        for field, key, size in [('sku', 'ma_hang', 100), ('unit', 'don_vi', 50), ('raw_text', 'raw_text', 1000)]:
            row[field] = truncate_utf16(str(item.get(field if xml else key) or ''), size) or None
        for field, key in [('quantity', 'so_luong'), ('unit_price', 'don_gia'), ('discount_amount', 'giam_gia'), ('tax_amount', 'thue'), ('line_total', 'thanh_tien')]:
            row[field] = amount(money_value(item.get(field if xml else key)), quantity=field == 'quantity')
        items.append(row)
    return fields, items


def prepare(db, user, contents, mime, file_hash, source, xml_data, ticket):
    reviewed = None
    attempt_id = None
    started = None
    job_id = None
    if ticket:
        try:
            payload = json.loads(Fernet(settings.job_encryption_key.encode()).decrypt(ticket.encode(), ttl=TICKET_TTL))
            if [payload['user'], payload['version'], payload['hash'], payload['source']] != [str(user.id), user.token_version, file_hash, source]:
                raise ValueError('Ticket binding mismatch')
            raw, is_xml, preview_id = payload['raw'], payload['xml'], payload['preview_id']
            reviewed = payload['reviewed']
            job_id = payload.get('ocr_job_id')
        except (InvalidToken, ValueError, KeyError, TypeError):
            raise HTTPException(409, detail={'code': 'UPLOAD_TICKET_EXPIRED', 'message': 'Phiên đối chiếu hết hạn hoặc không hợp lệ. Hãy tải lại để kiểm tra.'}) from None
    else:
        preview_id, is_xml = str(uuid.uuid4()), xml_data is not None
        if is_xml:
            raw = xml_data
        else:
            attempt_id = uuid.uuid4()
            from app.chuc_nang.nguoi_dung.goi_dich_vu.han_muc import reserve_ai
            reserve_ai(db, user.id, attempt_id)
            job = OcrJob(id=attempt_id, user_id=user.id, status="PROCESSING", provider="google_gemini",
                         model_name=settings.google_ai_model, attempt_count=1, progress_percent=0,
                         started_at=datetime.now(timezone.utc).replace(tzinfo=None))
            db.add(job)
            job_id = str(attempt_id)
            db.commit()
            started = perf_counter()
            async def bounded():
                return await asyncio.wait_for(run_gemini_ocr(contents, mime), timeout=UPLOAD_OCR_TIMEOUT_SECONDS)
            try:
                raw = asyncio.run(bounded())
            except Exception:
                _complete_attempt(db, attempt_id, started, "UPLOAD_OCR_UNAVAILABLE")
                raise HTTPException(503, detail={'code': 'UPLOAD_OCR_UNAVAILABLE', 'message':
                    'Chưa kiểm tra được hóa đơn do OCR bận, hết hạn mức hoặc mất kết nối. Chưa tạo bản mới; hãy thử lại sau.'}) from None
    try:
        fields, items = normalize(raw, is_xml)
    except UnsupportedInvoiceCurrency as exc:
        _complete_attempt(db, attempt_id, started, type(exc).__name__)
        raise HTTPException(422, detail={'code': type(exc).__name__, 'message': str(exc)}) from None
    except (ValueError, TypeError, ArithmeticError):
        _complete_attempt(db, attempt_id, started, "UPLOAD_INVALID_OCR")
        raise HTTPException(422, detail={'code': 'UPLOAD_INVALID_OCR', 'message': 'Kết quả nhận diện chưa hợp lệ. Chưa tạo hóa đơn; hãy chọn ảnh rõ hơn hoặc thử lại.'}) from None
    _complete_attempt(db, attempt_id, started)
    preview = Invoice(id=uuid.UUID(preview_id), user_id=user.id, revision=1, status='REVIEW_REQUIRED',
        file_sha256=file_hash, source='IMPORT' if is_xml else source, **fields)
    # A transient candidate must compare against every persisted draft, including
    # one committed by a concurrent upload after this request began OCR.
    preview.created_at = datetime.max
    setattr(preview, '_duplicate_items', items)
    refresh_identity(preview)
    payload = {'user': str(user.id), 'version': user.token_version, 'hash': file_hash, 'source': source,
        'raw': raw, 'xml': is_xml, 'preview_id': preview_id, 'reviewed': reviewed, 'ocr_job_id': job_id}
    return preview, items, payload


def _complete_attempt(db, attempt_id, started, error_code=None):
    if attempt_id is None:
        return
    from app.chuc_nang.nguoi_dung.goi_dich_vu.han_muc import lock_owner
    owner_id = db.scalar(select(OcrJob.user_id).where(OcrJob.id == attempt_id))
    if owner_id:
        lock_owner(db, owner_id)
    # Completion and orphan recovery compete on this row. A late provider
    # result cannot reopen a closed attempt or create an untracked invoice.
    completed = db.execute(update(OcrJob).where(
        OcrJob.id == attempt_id, OcrJob.status == "PROCESSING", OcrJob.invoice_id.is_(None),
    ).values(status="FAILED" if error_code else "COMPLETED",
             completed_at=datetime.now(timezone.utc).replace(tzinfo=None),
             processing_ms=max(1, int((perf_counter() - started) * 1000)), progress_percent=100,
             error_code=error_code,
             error_message="Chưa nhận diện được ảnh tải lên. Người dùng cần kiểm tra ảnh và thử lại." if error_code else None))
    if completed.rowcount == 1 and not error_code:
        from app.chuc_nang.nguoi_dung.goi_dich_vu.han_muc import consume_ai
        consume_ai(db, attempt_id)
    db.commit()
    if completed.rowcount != 1:
        raise HTTPException(503, detail={"code": "UPLOAD_OCR_INTERRUPTED", "message": INTERRUPTED_UPLOAD_MESSAGE})


def recover_interrupted_uploads(sessions, *, instant=None, limit=100):
    """Close stale synchronous uploads; never enqueue another provider call."""
    instant = instant or datetime.now(timezone.utc).replace(tzinfo=None)
    if instant.tzinfo is not None:
        instant = instant.astimezone(timezone.utc).replace(tzinfo=None)
    cutoff = instant - timedelta(seconds=UPLOAD_ATTEMPT_STALE_SECONDS)
    stale = (OcrJob.status == "PROCESSING", OcrJob.invoice_id.is_(None), OcrJob.started_at <= cutoff)
    with sessions() as db:
        ids = db.scalars(select(OcrJob.id).where(*stale)
                         .order_by(OcrJob.started_at, OcrJob.id).limit(limit)).all()
        if not ids:
            return 0
        closed = db.execute(update(OcrJob).where(OcrJob.id.in_(ids), *stale).values(
            status="FAILED", completed_at=instant, processing_ms=None, progress_percent=100,
            error_code="UPLOAD_OCR_INTERRUPTED", error_message=INTERRUPTED_UPLOAD_MESSAGE))
        db.commit()
        return closed.rowcount


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
