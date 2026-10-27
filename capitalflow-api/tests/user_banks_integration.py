"""Private banks, user-level consent and email OTP against isolated SQL tempdb."""
import sys
from pathlib import Path
from uuid import uuid4, UUID
from datetime import timedelta
from concurrent.futures import ThreadPoolExecutor
from unittest.mock import patch, AsyncMock
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from fastapi import FastAPI, Request, Depends
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, text, select, func
from sqlalchemy.engine import make_url
from sqlalchemy.orm import Session
import app.dung_chung.database.dang_ky_mo_hinh
from app.dung_chung.database.nen_tang import Base
from app.dung_chung.config import settings
from app.dung_chung.http.phu_thuoc import get_db, get_current_user
from app.chuc_nang.nguoi_dung.dang_nhap.luu_tru.nguoi_dung import User
from app.chuc_nang.nguoi_dung.dang_nhap.luu_tru.dat_lai_mat_khau import PasswordResetOTP
from app.chuc_nang.nguoi_dung.tai_chinh.vi_tai_khoan import wallet_api as api
from app.chuc_nang.nguoi_dung.tai_chinh.vi_tai_khoan.luu_tru.wallet import Wallet, DemoBankBalance, UserBankLink, WalletEntry
from app.chuc_nang.nguoi_dung.tai_chinh.giao_dich.luu_tru.ban_ghi_luy_dang import IdempotencyRecord
from app.chuc_nang.nguoi_dung.tai_chinh.thong_bao.luu_tru.thong_bao import Notification


def main():
    schema = 'qa_user_bank_' + uuid4().hex
    engine = create_engine(make_url(settings.database_url).set(database='tempdb'), hide_parameters=True)
    dbengine = engine.execution_options(schema_translate_map={None: schema})
    tables = [m.__table__ for m in (User, PasswordResetOTP, Wallet, DemoBankBalance, UserBankLink, WalletEntry, IdempotencyRecord, Notification)]
    with engine.begin() as conn:
        assert conn.scalar(text('SELECT DB_NAME()')) == 'tempdb'
        conn.execute(text(f'CREATE SCHEMA [{schema}]'))
    try:
        Base.metadata.create_all(dbengine, tables=tables)
        users = [uuid4(), uuid4(), uuid4()]
        with Session(dbengine) as db:
            for i, uid in enumerate(users):
                db.add(User(id=uid, email=f'{uid}@example.invalid', full_name='Bank QA', password_hash='unusable', role='ADMIN' if i == 2 else 'USER'))
            db.commit()
        app = FastAPI()
        app.include_router(api.router)
        def database(request: Request):
            with Session(dbengine, autoflush=False) as db:
                db.info['request'] = request
                yield db
        def current(request: Request, db=Depends(get_db)):
            return db.get(User, UUID(request.headers['x-qa-user']))
        app.dependency_overrides[get_db] = database
        app.dependency_overrides[get_current_user] = current
        mail = AsyncMock()
        with patch.object(api, 'send_otp_email', mail), TestClient(app) as client:
            def call(method, path, body=None, uid=users[0], status=200, key=None):
                r = client.request(method, path, json=body, headers={'x-qa-user': str(uid), 'Idempotency-Key': key or uuid4().hex})
                assert r.status_code == status, (path, r.status_code, r.text)
                return r.json()
            def age_otp(uid=users[0]):
                with Session(dbengine) as db:
                    for row in db.scalars(select(PasswordResetOTP).where(PasswordResetOTP.user_id == uid)):
                        row.created_at = api.now() - timedelta(minutes=2)
                    db.commit()
            def link(number, provider='VCB'):
                age_otp()
                body = {'provider': provider, 'account_number': number}
                challenge = call('POST', '/wallets/banks/send-otp', body)
                result = call('POST', '/wallets/banks', {**body, 'otp_request_id': challenge['otp_request_id'], 'otp': mail.await_args.kwargs['otp_code']})
                return result['id']

            # Parallel provisioning cannot create multiple funding balances.
            with ThreadPoolExecutor(max_workers=2) as pool:
                results = list(pool.map(lambda _: call('GET', '/wallets/providers'), range(2)))
            assert results[0] == results[1] and len(results[0]) == 4
            first = results[0]; second = call('GET', '/wallets/providers', uid=users[1])
            assert all(first[p]['demo_number'] != second[p]['demo_number'] for p in first)
            for provider in first:
                call('POST', '/wallets/banks/send-otp', {'provider': provider, 'account_number': first[provider]['demo_number']}, uid=users[1], status=422)
            number = first['VCB']['demo_number']
            link_id = link(number)  # Can link even before creating a wallet.
            a = call('POST', '/wallets', {'name': 'A'}, status=201)['id']
            b = call('POST', '/wallets', {'name': 'B'}, status=201)['id']
            call('POST', f'/wallets/{a}/topup', {'link_id': link_id, 'amount': '100'})
            call('POST', f'/wallets/{b}/topup', {'link_id': link_id, 'amount': '100'})
            foreign_wallet = call('POST', '/wallets', {'name': 'Foreign'}, uid=users[1], status=201)['id']
            call('POST', f'/wallets/{foreign_wallet}/topup', {'link_id': link_id, 'amount': '1'}, uid=users[1], status=409)
            call('DELETE', f'/wallets/banks/{link_id}', uid=users[1], status=404)
            call('DELETE', f'/wallets/banks/{link_id}')
            for wid in (a, b):
                call('POST', f'/wallets/{wid}/topup', {'link_id': link_id, 'amount': '1'}, status=409)
            assert link(number) == link_id
            call('POST', f'/wallets/{a}/withdraw', {'link_id': link_id, 'amount': '100'})
            call('DELETE', f'/wallets/{a}')
            call('POST', f'/wallets/{b}/topup', {'link_id': link_id, 'amount': '1'})
            with Session(dbengine) as db:
                bank = db.scalar(select(DemoBankBalance).where(DemoBankBalance.user_id == users[0], DemoBankBalance.provider == 'VCB'))
                assert bank.balance == bank.opening_balance - 101
                assert db.scalar(select(func.count()).select_from(UserBankLink)) == 1
            print('PASS: private provisioning/race, cross-user denial, pre-wallet linking, all-wallet reuse/unlink, closure and persistent bank funds')

    finally:
        Base.metadata.drop_all(dbengine, tables=tables)
        with engine.begin() as conn:
            conn.execute(text(f'DROP SCHEMA [{schema}]'))
        engine.dispose()


if __name__ == '__main__':
    main()
