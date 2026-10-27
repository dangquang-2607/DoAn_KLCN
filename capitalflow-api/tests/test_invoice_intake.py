import json
import time
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch
from uuid import uuid4
from cryptography.fernet import Fernet
import pytest
from fastapi import HTTPException
from app.dung_chung.config import settings
from app.chuc_nang.nguoi_dung.hoa_don_ai.nghiep_vu import kiem_tra_tai_len as intake

RAW = {'ten_nguoi_ban': 'Cửa hàng kiểm thử', 'so_hoa_don': 'INV123', 'ngay_lap': '2026-10-20',
       'tong_thanh_toan': '114000', 'items': []}


@pytest.mark.parametrize('value', ['NaN', 'Infinity', '-1', '1e100'])
def test_invalid_amount(value):
    with pytest.raises((ValueError, ArithmeticError)):
        intake.amount(value)


@pytest.mark.parametrize('field,value', [('ngay_lap', ''), ('ten_nguoi_ban', ''), ('so_hoa_don', ''), ('tong_thanh_toan', 0)])
def test_missing_identity_never_means_unique(field, value):
    fields, items = intake.normalize({**RAW, field: value})
    with pytest.raises(HTTPException) as exc:
        intake.require_readable(fields, items)
    assert exc.value.detail['code'] == 'UPLOAD_INSUFFICIENT_DATA'


def test_quantity_precision_and_invalid_confidence():
    fields, items = intake.normalize({**RAW, 'items': [{'ten_hang': 'Su su', 'so_luong': '0,602', 'don_gia': 8800, 'thanh_tien': 5298}]})
    assert str(items[0]['quantity']) == '0.6020'
    with pytest.raises(ValueError):
        intake.normalize({**RAW, 'do_tin_cay': 1.2})


def test_expired_ticket_does_not_call_provider():
    user = SimpleNamespace(id=uuid4(), token_version=1)
    payload = dict(user=str(user.id), version=1, hash='hash', source='UPLOAD', raw=RAW, xml=False, preview_id=str(uuid4()), reviewed='review')
    ticket = Fernet(settings.job_encryption_key.encode()).encrypt_at_time(json.dumps(payload).encode(), int(time.time())-intake.TICKET_TTL-10).decode()
    with patch.object(intake, 'run_gemini_ocr', new_callable=AsyncMock) as ocr, pytest.raises(HTTPException) as exc:
        intake.prepare(user, b'file', 'image/jpeg', 'hash', 'UPLOAD', None, ticket)
    assert exc.value.detail['code'] == 'UPLOAD_TICKET_EXPIRED'
    ocr.assert_not_called()


def test_bare_acceptance_cannot_bypass_review():
    with pytest.raises(HTTPException) as exc:
        intake.require_review({'level': 'SUSPECTED', 'review_token': 'current'}, {'reviewed': None}, True)
    assert exc.value.detail['code'] == 'UPLOAD_REVIEW_REQUIRED'
