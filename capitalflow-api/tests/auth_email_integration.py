"""Real auth endpoints and concurrent unique identities in a disposable tempdb schema."""
import sys
from pathlib import Path
from uuid import uuid4, UUID
from threading import Barrier
from concurrent.futures import ThreadPoolExecutor
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from fastapi import FastAPI, Request
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, select, text, func
from sqlalchemy.engine import make_url
from sqlalchemy.orm import Session
import app.dung_chung.database.dang_ky_mo_hinh
from app.dung_chung.config import settings
from app.dung_chung.database.nen_tang import Base
from app.dung_chung.http.phu_thuoc import get_db
from app.dung_chung.security.passwords import hash_password
from app.chuc_nang.nguoi_dung.dang_nhap.api import routes as auth
from app.chuc_nang.nguoi_dung.dang_nhap.luu_tru.nguoi_dung import User
from app.chuc_nang.nguoi_dung.dang_nhap.luu_tru.refresh_token import RefreshToken
from app.chuc_nang.nguoi_dung.dang_nhap.luu_tru.dat_lai_mat_khau import PasswordResetOTP
from app.chuc_nang.nguoi_dung.tai_chinh.thong_bao.luu_tru.thong_bao import Notification
from app.chuc_nang.nguoi_dung.tai_chinh.vi_tai_khoan.luu_tru.wallet import Wallet


def main():
    schema = 'qa_auth_' + uuid4().hex
    url = make_url(settings.database_url)
    assert url.get_backend_name() == 'mssql' and 'odbc_connect' not in url.query
    engine = create_engine(url.set(database='tempdb'), hide_parameters=True)
    dbengine = engine.execution_options(schema_translate_map={None: schema})
    tables = [User.__table__, RefreshToken.__table__, PasswordResetOTP.__table__, Notification.__table__, Wallet.__table__]
    with engine.begin() as conn:
        assert conn.scalar(text('SELECT DB_NAME()')) == 'tempdb'
        conn.execute(text(f'CREATE SCHEMA [{schema}]'))
    try:
        Base.metadata.create_all(dbengine, tables=tables)
        barrier = Barrier(2)

        class RaceSession(Session):
            def scalar(self, *args, **kwargs):
                result = super().scalar(*args, **kwargs)
                if self.info.pop('race', False):
                    assert result is None
                    barrier.wait(timeout=15)
                return result

        def database(request: Request):
            with RaceSession(dbengine) as db:
                db.execute(text('SET LOCK_TIMEOUT 15000'))
                db.info['race'] = request.headers.get('x-qa-race') == '1'
                yield db

        app = FastAPI()
        app.include_router(auth.router, prefix='/api/v1')
        app.dependency_overrides[get_db] = database
        with patch.object(auth.limiter, 'enabled', False), patch.object(auth, 'enqueue_email'), TestClient(app) as client:
            def register(email='email-qa@example.com', race=False):
                return client.post('/api/v1/auth/register', json={'email':email,'password':'QA-secret-2026','full_name':'Email QA'}, headers={'x-qa-race':'1' if race else '0'})
            response = register('EMAIL-QA@EXAMPLE.COM')
            assert response.status_code == 201, response.text
            uid = UUID(response.json()['id'])
            assert response.json()['email'] == 'email-qa@example.com'
            assert 'phone_number' not in response.json()
            assert register().status_code == 409
            for key in ('email', 'identifier'):
                response = client.post('/api/v1/auth/login',json={key:'EMAIL-QA@EXAMPLE.COM','password':'QA-secret-2026'})
                assert response.status_code == 200, response.text
                profile = client.get('/api/v1/auth/me',headers={'Authorization':'Bearer '+response.json()['access_token']})
                assert profile.status_code == 200 and not any(k.startswith('phone_') for k in profile.json())
            assert client.post('/api/v1/auth/login',json={'email':'email-qa@example.com','password':'wrong'}).status_code == 401
            with Session(dbengine) as db:
                default = db.scalars(select(Wallet).where(Wallet.user_id == uid)).one()
                assert default.is_default and default.is_active and default.balance == 0
            assert client.post('/api/v1/auth/login',json={'identifier':'0912345678','password':'QA-secret-2026'}).status_code == 422
            assert client.post('/api/v1/auth/register',json={'email':'extra@example.com','phone_number':'0912345678','password':'secret'}).status_code == 422
            assert client.post('/api/v1/auth/phone/send-otp').status_code == 404
            with Session(dbengine) as db:
                user = db.get(User, uid); user.is_active = False; db.commit()
            assert client.post('/api/v1/auth/login',json={'email':'email-qa@example.com','password':'QA-secret-2026'}).status_code == 403
            with Session(dbengine) as db:
                user = db.get(User, uid); user.is_deleted=True; user.deletion_status='SOFT_DELETED'; db.commit()
            assert register().status_code == 409
            with ThreadPoolExecutor(max_workers=2) as pool:
                responses = list(pool.map(lambda email: register(email, race=True), ['race@example.com','RACE@EXAMPLE.COM']))
            assert sorted(r.status_code for r in responses) == [201,409], [r.text for r in responses]
            with Session(dbengine) as db:
                assert db.scalar(select(func.count()).select_from(User)) == 2
                legacy = User(email='legacy@example.com', full_name='Legacy QA', password_hash=hash_password('QA-secret-2026'))
                db.add(legacy); db.commit(); legacy_id = legacy.id
            with ThreadPoolExecutor(max_workers=2) as pool:
                logins = list(pool.map(lambda _: client.post('/api/v1/auth/login', json={'email':'legacy@example.com','password':'QA-secret-2026'}), range(2)))
            assert all(r.status_code == 200 for r in logins), [r.text for r in logins]
            with Session(dbengine) as db:
                default = db.scalars(select(Wallet).where(Wallet.user_id == legacy_id)).one()
                assert default.is_default and default.balance == 0
            print('PASS: email-only registration/login; canonical duplicate email and concurrent uniqueness; no phone routes/fields; locked/deleted guards',flush=True)
            assert register('otp-qa@example.com').status_code == 201
            with patch.object(auth.EmailService, 'send_password_reset_otp') as mail:
                response = client.post('/api/v1/auth/forgot-password', json={'email':'otp-qa@example.com'})
                assert response.status_code == 200
                code = mail.call_args.args[2]
            otp_body = {'email':'otp-qa@example.com', 'otp_code':code}
            assert client.post('/api/v1/auth/verify-otp',json=otp_body).status_code == 200
            reset_body = {**otp_body, 'new_password':'QA-reset-2026'}
            assert client.post('/api/v1/auth/reset-password',json=reset_body).status_code == 200
            assert client.post('/api/v1/auth/reset-password',json=reset_body).status_code == 400
            assert client.post('/api/v1/auth/login',json={'email':'otp-qa@example.com','password':'QA-reset-2026'}).status_code == 200
            assert client.post('/api/v1/auth/login',json={'email':'otp-qa@example.com','password':'QA-secret-2026'}).status_code == 401
            print('PASS: email OTP verification/reset/replay prevention and login with new password; mail transport mocked',flush=True)
    finally:
        Base.metadata.drop_all(dbengine, tables=tables)
        with engine.begin() as conn:
            conn.execute(text(f'DROP SCHEMA [{schema}]'))
        engine.dispose()
        print('CLEANUP: isolated auth test schema removed; no application users or emails changed',flush=True)


if __name__ == '__main__':
    main()
