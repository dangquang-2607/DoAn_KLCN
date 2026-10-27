"""Real SQL/HTTP intake regression. Provider mocked; outer transaction rolled back."""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from tempfile import TemporaryDirectory
from unittest.mock import patch, AsyncMock
from uuid import uuid4, UUID
from fastapi import FastAPI, Request
from fastapi.testclient import TestClient
from sqlalchemy import select, func
from sqlalchemy.orm import Session
import app.dung_chung.database.dang_ky_mo_hinh
from app.dung_chung.database.ket_noi import engine
from app.dung_chung.config import settings
from app.dung_chung.http.phu_thuoc import get_db, get_current_user
from app.chuc_nang.nguoi_dung.dang_nhap.luu_tru.nguoi_dung import User
from app.chuc_nang.nguoi_dung.hoa_don_ai.luu_tru.invoice import Invoice
from app.chuc_nang.nguoi_dung.hoa_don_ai.luu_tru.invoice_item import InvoiceItem
from app.chuc_nang.nguoi_dung.hoa_don_ai.api.routes import router
from app.chuc_nang.nguoi_dung.hoa_don_ai.nghiep_vu import kiem_tra_tai_len as preflight

RAW = dict(ten_nguoi_ban='K Box Coffee Lê Trọng Tấn', dia_chi_nguoi_ban='119 Lê Trọng Tấn Sơn Kỳ Tân Phú',
    so_hoa_don='110069', ngay_lap='11/10/2026', gio_lap='09:14', tong_thanh_toan=45000, do_tin_cay=.99,
    items=[dict(ten_hang='Trà dưa lưới M', so_luong=1, don_gia=45000, thanh_tien=45000)])


def main():
    with engine.connect() as conn, TemporaryDirectory() as storage:
        before = conn.scalar(select(func.count()).select_from(Invoice))
        conn.rollback()
        outer = conn.begin()
        users = [uuid4(), uuid4()]
        active = [users[0]]
        sessions = []
        try:
            with Session(conn, join_transaction_mode='create_savepoint') as db:
                for uid in users:
                    db.add(User(id=uid, email=f'intake-{uid.hex}@example.invalid', full_name='Intake QA', password_hash='unusable', token_version=0))
                db.commit()
            app = FastAPI()
            app.include_router(router, prefix='/api/v1')
            def db_override(request: Request):
                with Session(conn, autoflush=False, join_transaction_mode='create_savepoint') as db:
                    db.info['request'] = request
                    sessions[:] = [db]
                    yield db
            app.dependency_overrides[get_db] = db_override
            app.dependency_overrides[get_current_user] = lambda: User(id=active[0], token_version=0)
            with patch.object(settings, 'upload_dir', storage), patch.object(preflight, 'run_gemini_ocr', new_callable=AsyncMock) as ocr, TestClient(app) as client:
                ocr.return_value = RAW
                def post(label, expected=201, ticket=None, key=None, ext='jpg', content=None):
                    data = {'source': 'UPLOAD'}
                    if ticket:
                        data.update(upload_ticket=ticket, accept_distinct='true')
                    response = client.post('/api/v1/invoices', data=data, files={'file': (f'{label}.{ext}', content or b'\xff\xd8\xff'+label.encode(), 'image/jpeg')}, headers={'Idempotency-Key': key or uuid4().hex})
                    assert response.status_code == expected, (label, response.status_code, response.text[:1500])
                    return response.json()
                def count():
                    return conn.scalar(select(func.count()).select_from(Invoice).where(Invoice.user_id == active[0]))
                first = post('original', key='intake-first-key')
                assert count() == 1 and first['status'] == 'REVIEW_REQUIRED'
                assert conn.scalar(select(func.count()).select_from(InvoiceItem).where(InvoiceItem.invoice_id == UUID(first['id']))) == 1
                assert ocr.await_count == 1
                same = post('renamed', 200, content=b'\xff\xd8\xfforiginal')
                assert same['id'] == first['id'] and ocr.await_count == 1 and same['match_kind'] == 'SHA256'
                replay = post('original', 200, key='intake-first-key')
                assert replay['id'] == first['id'] and ocr.await_count == 1
                angled = post('different-angle', 200)
                assert angled['id'] == first['id'] and angled['match_kind'] == 'DATA' and count() == 1
                assert len(list(Path(storage).iterdir())) == 1
                print('PASS: first upload is scanned; SHA/rename/replay skip OCR; different photo reuses draft without extra file')

                ocr.return_value = {**RAW, 'so_hoa_don': '110070', 'gio_lap': '11:14'}
                suspect = post('suspect', 409)['detail']
                assert suspect['code'] == 'UPLOAD_REVIEW_REQUIRED' and count() == 1
                assert 50 <= suspect['duplicate_check']['similarity_percent'] <= 80
                calls = ocr.await_count
                post('different-file', 409, ticket=suspect['upload_ticket'])
                active[0] = users[1]
                bad = post('suspect', 409, ticket=suspect['upload_ticket'])
                assert bad['detail']['code'] == 'UPLOAD_TICKET_EXPIRED' and count() == 0
                active[0] = users[0]
                with Session(conn, join_transaction_mode='create_savepoint') as db:
                    old = db.get(Invoice, UUID(first['id']))
                    old.revision += 1
                    db.commit()
                changed = post('suspect', 409, ticket=suspect['upload_ticket'])['detail']
                assert changed['upload_ticket'] != suspect['upload_ticket'] and ocr.await_count == calls
                accepted = post('suspect', ticket=changed['upload_ticket'])
                assert count() == 2 and ocr.await_count == calls and accepted['outcome'] == 'CREATED'
                post('suspect', 200, ticket=changed['upload_ticket'])
                assert count() == 2
                print('PASS: suspected held outside list; ticket bound to user/file; changed evidence requires review; acceptance does not re-OCR')

                ocr.return_value = {**RAW, 'so_hoa_don': '', 'items': [], 'ngay_lap': ''}
                unreadable = post('blurred', 422)
                assert unreadable['detail']['code'] == 'UPLOAD_INSUFFICIENT_DATA' and count() == 2
                ocr.side_effect = RuntimeError('mock provider offline')
                post('outage', 503)
                assert count() == 2 and len(list(Path(storage).iterdir())) == 2
                ocr.side_effect = None
                print('PASS: unreadable/provider failure creates neither invoice nor stored file')

                with Session(conn, join_transaction_mode='create_savepoint') as db:
                    legacy = Invoice(user_id=users[0], status='UPLOADED', original_filename='legacy.jpg')
                    db.add(legacy); db.flush(); legacy_id = legacy.id; db.commit()
                calls = ocr.await_count
                blocked = post('new-with-legacy', 409)
                assert blocked['detail']['code'] == 'UPLOAD_HISTORY_INCOMPLETE' and ocr.await_count == calls
                post('original', 200)
                with Session(conn, join_transaction_mode='create_savepoint') as db:
                    db.delete(db.get(Invoice, legacy_id)); db.commit()
                print('PASS: unscanned history blocks unknown photo without OCR; exact hash still opens existing')

                active[0] = users[1]
                async def interleaved(*args):
                    db = sessions[0]
                    assert not db.in_transaction(), 'OCR must not hold SQL transaction'
                    # Model another request committing the same receipt while this
                    # request is outside its transaction waiting for the provider.
                    fields, _ = preflight.normalize(RAW)
                    existing = Invoice(user_id=users[1], status='REVIEW_REQUIRED', **fields)
                    db.add(existing); db.commit()
                    return RAW
                ocr.side_effect = interleaved
                raced = post('concurrent-photo', 200)
                assert raced['match_kind'] == 'DATA' and count() == 1
                print('PASS: final locked recheck sees intervening receipt; no second draft after overlapping OCR')
                ocr.side_effect = None
                xml = b'<Invoice><SellerName>XML independent shop</SellerName><InvoiceNumber>XML999</InvoiceNumber><InvoiceDate>2026-10-15</InvoiceDate><PayableAmount>120000</PayableAmount></Invoice>'
                calls = ocr.await_count
                imported = post('xml', ext='xml', content=xml)
                assert imported['status'] == 'REVIEW_REQUIRED' and ocr.await_count == calls
                print('PASS: XML uses same gate without provider')
        finally:
            outer.rollback()
        assert conn.scalar(select(func.count()).select_from(Invoice)) == before
        print('PASS: all SQL fixtures rolled back; temporary files removed')


if __name__ == '__main__':
    main()
