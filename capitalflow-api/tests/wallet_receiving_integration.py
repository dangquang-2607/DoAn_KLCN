"""Default identity, email/QR receiving and transfers in a disposable SQL schema."""
import sys
import base64
from pathlib import Path
from uuid import uuid4, UUID
from concurrent.futures import ThreadPoolExecutor
from unittest.mock import patch
from xml.etree import ElementTree
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from fastapi import FastAPI, Request, Depends
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, select, text, func
from sqlalchemy.engine import make_url
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
import app.dung_chung.database.dang_ky_mo_hinh
from app.dung_chung.database.nen_tang import Base
from app.dung_chung.config import settings
from app.dung_chung.http.phu_thuoc import get_db, get_current_user
from app.chuc_nang.nguoi_dung.dang_nhap.luu_tru.nguoi_dung import User
from app.chuc_nang.nguoi_dung.tai_chinh.vi_tai_khoan import wallet_api as api
from app.chuc_nang.nguoi_dung.tai_chinh.vi_tai_khoan import wallet_codes
from app.chuc_nang.nguoi_dung.tai_chinh.vi_tai_khoan.luu_tru.wallet import Wallet, WalletEntry, DemoBankBalance
from app.chuc_nang.nguoi_dung.tai_chinh.giao_dich.luu_tru.ban_ghi_luy_dang import IdempotencyRecord
from app.chuc_nang.nguoi_dung.tai_chinh.thong_bao.luu_tru.thong_bao import Notification


def main():
    schema = 'qa_receive_' + uuid4().hex
    engine = create_engine(make_url(settings.database_url).set(database='tempdb'), hide_parameters=True)
    dbengine = engine.execution_options(schema_translate_map={None: schema})
    tables = [m.__table__ for m in (User, Wallet, DemoBankBalance, WalletEntry, IdempotencyRecord, Notification)]
    with engine.begin() as conn:
        assert conn.scalar(text('SELECT DB_NAME()')) == 'tempdb'
        conn.execute(text(f'CREATE SCHEMA [{schema}]'))
    try:
        Base.metadata.create_all(dbengine, tables=tables)
        users = [uuid4(), uuid4()]
        with Session(dbengine) as db:
            for i, uid in enumerate(users):
                db.add(User(id=uid, email=f'qa-{i}@example.com', full_name=f'Người nhận {i}', password_hash='unusable'))
            db.commit()
        app = FastAPI(); app.include_router(api.router)
        def database(request: Request):
            with Session(dbengine, autoflush=False) as db:
                db.info['request'] = request
                yield db
        def current(request: Request, db=Depends(get_db)):
            return db.get(User, UUID(request.headers['x-qa-user']))
        app.dependency_overrides[get_db] = database
        app.dependency_overrides[get_current_user] = current
        with patch.object(api.limiter, 'enabled', False), TestClient(app) as client:
            def call(method, path, body=None, uid=users[0], status=200, key=None):
                r = client.request(method, path, json=body, headers={'x-qa-user': str(uid), 'Idempotency-Key': key or uuid4().hex})
                assert r.status_code == status, (path, r.status_code, r.text)
                return r.json()
            with ThreadPoolExecutor(max_workers=3) as pool:
                results = list(pool.map(lambda _: call('GET', '/wallets'), range(3)))
            assert all(len(rows) == 1 and rows[0]['id'] == results[0][0]['id'] for rows in results)
            a = results[0][0]
            b = call('GET', '/wallets', uid=users[1])[0]
            assert a['is_default'] and a['receive_code'] == 'qa-0@example.com' and float(a['balance']) == 0
            call('DELETE', f"/wallets/{a['id']}", status=409)
            c = call('POST', '/wallets', {'name': 'Ví phụ'}, uid=users[1], status=201)
            assert not c['is_default'] and c['receive_code'].startswith('CF-') and len(c['receive_code']) == 11
            # Force a collision against another owner's code, then exercise retry.
            fresh = wallet_codes.new_wallet_code()
            with patch.object(wallet_codes, 'new_wallet_code', side_effect=[c['receive_code'], fresh]):
                extra = call('POST', '/wallets', {'name': 'Collision retry'}, status=201)
            assert extra['receive_code'] == fresh
            renamed = call('PATCH', f"/wallets/{c['id']}", {'name':'Ví phụ mới'}, uid=users[1])
            assert renamed['receive_code'] == c['receive_code']
            qr_b = call('GET', f"/wallets/{b['id']}/receive", uid=users[1])
            qr_c = call('GET', f"/wallets/{c['id']}/receive", uid=users[1])
            assert qr_b['qr_payload'] != qr_c['qr_payload']
            ElementTree.fromstring(base64.b64decode(qr_c['qr_image_data_url'].split(',')[1]))
            call('GET', f"/wallets/{b['id']}/receive", status=404)
            for identity, expected in [(' QA-1@EXAMPLE.COM ', b), (qr_c['qr_payload'], c), (c['id'], c), (' '+c['receive_code'].lower()+' ', c)]:
                result = call('POST', '/wallets/recipients/resolve', {'recipient': identity})
                assert result['id'] == expected['id'] and result['recipient_name'] == 'Người nhận 1'
                assert 'balance' not in result and 'email' not in result
            for bad in ['not-email', 'capitalflow://transfer?v=2&wallet_id='+c['id'], qr_c['qr_payload']+'&amount=100', qr_c['qr_payload']+'&wallet_id='+a['id'], 'https://example.com/transfer', 'capitalflow://transfer?v=1&wallet_id=bad']:
                call('POST', '/wallets/recipients/resolve', {'recipient': bad}, status=422)
            call('POST', '/wallets/recipients/resolve', {'recipient': 'missing@example.com'}, status=404)
            # Test-only funding fixture, never applied to the application database.
            with Session(dbengine) as db:
                db.get(Wallet, UUID(a['id'])).balance = 1000; db.commit()
            transfer = lambda wid, amount: {'to_wallet_id': wid, 'amount': str(amount)}
            key = uuid4().hex
            sent = call('POST', f"/wallets/{a['id']}/transfers/create", transfer(b['id'], 100), key=key)
            assert call('POST', f"/wallets/{a['id']}/transfers/create", transfer(b['id'], 100), key=key) == sent
            call('POST', f"/wallets/{a['id']}/transfers/create", transfer(c['id'], 50), key=key, status=409)
            call('POST', f"/wallets/{b['id']}/transfers/create", transfer(c['id'], 50), uid=users[1])
            call('POST', f"/wallets/{a['id']}/transfers/create", transfer(a['id'], 1), status=422)
            call('POST', f"/wallets/{a['id']}/transfers/create", transfer(b['id'], 1001), status=409)
            call('POST', f"/wallets/{b['id']}/transfers/create", transfer(a['id'], 1), status=404)
            for flag in ('is_active', 'is_deleted'):
                with Session(dbengine) as db:
                    setattr(db.get(User, users[1]), flag, flag == 'is_deleted'); db.commit()
                call('POST', '/wallets/recipients/resolve', {'recipient': qr_b['qr_payload']}, status=404)
                call('POST', f"/wallets/{a['id']}/transfers/create", transfer(b['id'], 1), status=404)
                with Session(dbengine) as db:
                    setattr(db.get(User, users[1]), flag, flag == 'is_active'); db.commit()
            call('POST', f"/wallets/{c['id']}/transfers/create", transfer(b['id'], 50), uid=users[1])
            call('DELETE', f"/wallets/{c['id']}", uid=users[1])
            call('POST', '/wallets/recipients/resolve', {'recipient': qr_c['qr_payload']}, status=404)
            call('POST', '/wallets/recipients/resolve', {'recipient': c['receive_code']}, status=404)
            call('POST', f"/wallets/{a['id']}/transfers/create", transfer(c['id'], 1), status=404)
            with Session(dbengine) as db:
                assert db.scalar(select(func.sum(Wallet.balance))) == 1000
                assert db.scalar(select(func.count()).select_from(WalletEntry)) == 6
                assert db.scalar(select(func.sum(WalletEntry.amount))) == 0
            # Database constraints are a second boundary beyond API validation.
            for duplicate in (True, False):
                with Session(dbengine) as db:
                    if duplicate:
                        db.add(Wallet(user_id=users[0], name='Duplicate', balance=0, is_default=True))
                    else:
                        db.get(Wallet, UUID(a['id'])).is_active = False
                    try:
                        db.commit()
                    except IntegrityError:
                        db.rollback()
                    else:
                        raise AssertionError('Default wallet constraint missing')
            print('PASS: concurrent single default; zero opening; email/QR routing; owner-only QR; malformed/unavailable recipients; closure constraints; transfer retry, funds and immutable ledger', flush=True)
    finally:
        Base.metadata.drop_all(dbengine, tables=tables)
        with engine.begin() as conn:
            conn.execute(text(f'DROP SCHEMA [{schema}]'))
        engine.dispose()
        print('CLEANUP: isolated receiving schema removed', flush=True)


if __name__ == '__main__':
    main()
