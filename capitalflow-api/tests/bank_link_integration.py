"""Explicit SQL Server integration run; all probes rollback and mail is mocked.
Run from capitalflow-api: .venv/Scripts/python.exe tests/bank_link_integration.py
Never inserts committed fixtures or changes existing user records.
"""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
sys.path.insert(0, str(Path(__file__).resolve().parents[2] / 'capitalflow-database' / 'tools'))
import json
import tempfile
from datetime import datetime, timedelta
from decimal import Decimal
from uuid import uuid4, UUID
from unittest.mock import AsyncMock, patch
from fastapi import FastAPI, Depends, Request
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, select, func
from sqlalchemy.orm import Session
from apply_bank_otp import snapshot
from app.dung_chung.config import settings
import app.dung_chung.database.dang_ky_mo_hinh
from app.dung_chung.http.phu_thuoc import get_db, get_current_user
from app.chuc_nang.nguoi_dung.dang_nhap.luu_tru.nguoi_dung import User
from app.chuc_nang.nguoi_dung.dang_nhap.luu_tru.dat_lai_mat_khau import PasswordResetOTP
from app.chuc_nang.nguoi_dung.tai_chinh.vi_tai_khoan import api
from app.chuc_nang.nguoi_dung.tai_chinh.vi_tai_khoan.legacy_bank_sync import bank, demo_source
from app.chuc_nang.nguoi_dung.tai_chinh.vi_tai_khoan.legacy_bank_sync.demo_source import read_source
from app.chuc_nang.nguoi_dung.tai_chinh.vi_tai_khoan.legacy_bank_sync.demo_catalog import DEMO_ACCOUNTS
from app.chuc_nang.nguoi_dung.tai_chinh.vi_tai_khoan.number_rules import mask_account_number
from app.chuc_nang.nguoi_dung.tai_chinh.vi_tai_khoan.luu_tru.account import Account
from app.chuc_nang.nguoi_dung.tai_chinh.giao_dich.luu_tru.giao_dich import Transaction
from app.chuc_nang.nguoi_dung.tai_chinh.giao_dich import so_cai
from app.chuc_nang.nguoi_dung.tai_chinh.giao_dich.api import router as transactions_router


def source_document():
    return json.loads(demo_source.DATA_PATH.read_text(encoding='utf-8'))


def save_document(data):
    demo_source.DATA_PATH.write_text(json.dumps(data, ensure_ascii=False), encoding='utf-8')


def add_event(provider, event_id, amount='-50000', status='BOOKED'):
    doc = source_document()
    doc['accounts'][provider]['events'].append({'id': event_id, 'amount': amount, 'description': 'Source probe',
        'date': bank.today_vn().isoformat(), 'status': status})
    save_document(doc)


def run_checks():
    engine = create_engine(settings.database_url, hide_parameters=True)
    with engine.connect() as conn:
        before = snapshot(conn)
        conn.rollback()
        outer = conn.begin()
        try:
            with Session(conn, join_transaction_mode='create_savepoint') as db:
                users = [User(id=uuid4(), email=f'bank-probe-{uuid4().hex}@example.invalid',
                    full_name='Bank probe', password_hash='unusable', token_version=0) for _ in range(2)]
                db.add_all(users)
                db.commit()
                user_ids = [u.id for u in users]
            active_user = [user_ids[0]]
            app = FastAPI()
            app.include_router(api.router, prefix='/api/v1')
            app.include_router(bank.router, prefix='/api/v1')
            app.include_router(transactions_router, prefix='/api/v1')
            def db_override(request: Request):
                with Session(conn, join_transaction_mode='create_savepoint') as db:
                    db.info['request'] = request
                    yield db
            def user_override(db=Depends(get_db)):
                return db.get(User, active_user[0])
            app.dependency_overrides[get_db] = db_override
            app.dependency_overrides[get_current_user] = user_override
            mail = AsyncMock()
            def expect(response, code):
                assert response.status_code == code, (response.status_code, response.text)
                return response.json() if response.content else None
            def post(path, payload, code=200, key=None):
                return expect(client.post('/api/v1' + path, json=payload,
                    headers={'Idempotency-Key': key or str(uuid4())}), code)
            def cooldown():
                with Session(conn, join_transaction_mode='create_savepoint') as db:
                    for otp in db.scalars(select(PasswordResetOTP).where(PasswordResetOTP.user_id.in_(user_ids))):
                        otp.created_at = datetime.utcnow() - timedelta(minutes=1)
                    db.commit()
            def send(provider='MOMO', account_id=None):
                cooldown()
                demo = DEMO_ACCOUNTS[provider]
                payload = {'institution_name': provider, 'account_number': demo.number}
                if account_id:
                    payload['account_id'] = account_id
                challenge = post('/accounts/send-otp', payload)
                code = mail.await_args.kwargs['otp_code']
                return challenge['otp_request_id'], code
            def creation(provider, challenge, code):
                return {'name': 'Probe ' + provider, 'account_type': 'LINKED', 'institution_name': provider,
                    'account_number_masked': DEMO_ACCOUNTS[provider].number, 'otp_request_id': challenge, 'otp_code': code,
                    'balance': '999999'}  # Must never trust a linked balance supplied by client.
            def details(aid):
                return expect(client.get(f'/api/v1/accounts/{aid}/bank'), 200)
            with patch.object(api, 'send_otp_email', mail), TestClient(app) as client:
                rules = expect(client.get('/api/v1/accounts/number-rules'), 200)
                assert len(rules) == 5
                post('/accounts/send-otp', {'institution_name': 'ACB', 'account_number': '0987654321'}, 422)
                post('/accounts/send-otp', {'institution_name': 'MOMO', 'account_number': '0987654320'}, 422)
                mail.assert_not_awaited()
                challenge, code = send()
                post('/accounts/send-otp', {'institution_name': 'MOMO', 'account_number': '0987654321'}, 429)
                wrong = '000000' if code != '000000' else '111111'
                for _ in range(5):
                    post('/accounts', creation('MOMO', challenge, wrong), 400)
                post('/accounts', creation('MOMO', challenge, code), 400)
                with Session(conn, join_transaction_mode='create_savepoint') as db:
                    assert db.get(PasswordResetOTP, UUID(challenge)).failed_attempts == 5
                challenge, code = send()
                post('/accounts', creation('ACB', challenge, code), 400)  # Bound to provider.
                active_user[0] = user_ids[1]
                post('/accounts', creation('MOMO', challenge, code), 400)  # Bound to user.
                active_user[0] = user_ids[0]
                with Session(conn, join_transaction_mode='create_savepoint') as db:
                    db.get(PasswordResetOTP, UUID(challenge)).expires_at = datetime.utcnow() - timedelta(seconds=1)
                    db.commit()
                post('/accounts', creation('MOMO', challenge, code), 400)
                accounts = {}
                for provider, demo in DEMO_ACCOUNTS.items():
                    challenge, code = send(provider)
                    key = str(uuid4())
                    payload = creation(provider, challenge, code)
                    created = post('/accounts', payload, 201, key)
                    aid = created['id']; accounts[provider] = aid
                    assert Decimal(created['balance']) == read_source(provider).balance
                    assert created['account_number_masked'] == mask_account_number(demo.number)
                    assert created['bank_status'] == 'CONNECTED'
                    assert post('/accounts', payload, 201, key)['id'] == aid
                    post('/accounts', payload, 409)
                    for _ in range(2):
                        state = post(f'/accounts/{aid}/bank', {'action': 'sync'})
                        assert Decimal(state['source_balance']) == read_source(provider).balance and state['last_imported'] == 0
                    with Session(conn, join_transaction_mode='create_savepoint') as db:
                        acc = db.get(Account, UUID(aid))
                        assert demo.number not in acc.bank_state
                        txns = db.scalars(select(Transaction).where(Transaction.account_id == acc.id)).all()
                        assert len([t for t in txns if t.bank_reference]) == len(read_source(provider).events)
                        assert sum((t.amount for t in txns), Decimal(0)) == acc.balance
                        assert db.get(PasswordResetOTP, UUID(challenge)).otp_code != code
                    expect(client.patch('/api/v1/accounts/' + aid, json={'name': 'Renamed'},
                        headers={'Idempotency-Key': str(uuid4())}), 200)
                    expect(client.patch('/api/v1/accounts/' + aid, json={'balance': '10'},
                        headers={'Idempotency-Key': str(uuid4())}), 409)
                print('PASS: five fixtures, OTP binding/attempts/expiry, masking, replay, ledger and balance isolation')
                aid = accounts['MOMO']
                action = lambda name: post(f'/accounts/{aid}/bank', {'action': name})
                momo_balance = read_source('MOMO').balance
                add_event('MOMO', 'new-file-event')
                state = details(aid)
                assert Decimal(state['provider_balance']) == momo_balance and Decimal(state['source_balance']) == momo_balance
                assert Decimal(action('sync')['source_balance']) == momo_balance - 50000
                add_event('MOMO', 'pending-file-event', status='PENDING')
                state = action('sync')
                assert Decimal(state['source_balance']) == momo_balance - 50000 and Decimal(state['available_balance']) == momo_balance - 100000
                doc = source_document()
                doc['accounts']['MOMO']['events'][-1]['status'] = 'BOOKED'
                save_document(doc)
                assert Decimal(action('sync')['source_balance']) == momo_balance - 100000
                state = action('outage'); stamp = state['last_sync']
                assert post(f'/accounts/{aid}/bank', {'action': 'sync'})['sync_error']
                assert details(aid)['last_sync'] == stamp
                action('restore')
                assert action('sync')['last_imported'] == 0
                action('disconnect')
                post(f'/accounts/{aid}/bank', {'action': 'sync'}, 409)
                challenge, code = send('MOMO', aid)
                state = post(f'/accounts/{aid}/bank', {'action': 'link', 'account_number': '0987654321',
                    'otp_request_id': challenge, 'otp': code})
                assert Decimal(state['source_balance']) == momo_balance - 100000 and state['last_imported'] == 0
                action('expire')
                post(f'/accounts/{aid}/bank', {'action': 'sync'}, 409)
                challenge, code = send('MOMO', aid)
                post(f'/accounts/{aid}/bank', {'action': 'link', 'account_number': '0987654321', 'otp_request_id': challenge, 'otp': code})
                print('PASS: new/pending/settled transactions, source outage, disconnect and OTP relink')
                # More than two pages, an older-than-window transaction, and a source correction.
                doc = source_document(); data = doc['accounts']['MOMO']
                data['events'][0]['amount'] = '600000'
                data['events'].extend({'id': f'page-{n}', 'amount': '-100', 'description': 'Page probe',
                    'status': 'BOOKED', 'date': bank.today_vn().isoformat()} for n in range(205))
                data['events'].append({'id': 'outside-window', 'amount': '200000', 'description': 'Before history',
                    'status': 'BOOKED', 'date': (bank.today_vn() - timedelta(days=100)).isoformat()})
                save_document(doc)
                expected = read_source('MOMO').balance
                state = action('sync')
                assert Decimal(state['source_balance']) == expected and state['last_imported'] == 206
                assert action('sync')['last_imported'] == 0
                with Session(conn, join_transaction_mode='create_savepoint') as db:
                    acc = db.get(Account, UUID(aid))
                    txns = db.scalars(select(Transaction).where(Transaction.account_id == acc.id)).all()
                    assert not any(t.bank_reference and t.bank_reference.endswith('outside-window') for t in txns)
                    assert sum((t.amount for t in txns), Decimal(0)) == acc.balance
                    txn_id = next(t.id for t in txns if t.bank_reference)
                    try:
                        so_cai.delete_transactions(db, [txn_id], user_ids[0], commit=False)
                        raise AssertionError('Deletion should be blocked')
                    except Exception as exc:
                        assert getattr(exc, 'status_code', None) == 409
                updated = expect(client.patch('/api/v1/transactions/' + str(txn_id), json={'note': 'Classified locally', 'category_id': None},
                    headers={'Idempotency-Key': str(uuid4())}), 200)
                assert updated['note'] == 'Classified locally'
                expect(client.patch('/api/v1/transactions/' + str(txn_id), json={'amount': '123'},
                    headers={'Idempotency-Key': str(uuid4())}), 409)
                post('/transactions', {'account_id': aid, 'type': 'EXPENSE', 'amount': '50000',
                    'description': 'Manual probe', 'transaction_date': bank.today_vn().isoformat()}, 409)
                print('PASS: 205+ events paged, fixed history window, source correction, manual changes blocked')
                cash = post('/accounts', {'name': 'Cash probe', 'account_type': 'BASIC', 'balance': '100000'}, 201)
                assert Decimal(cash['balance']) == 100000
                # Existing legacy wallet has no silently replaced data; relink is explicit.
                with Session(conn, join_transaction_mode='create_savepoint') as db:
                    legacy = Account(user_id=user_ids[1], name='Legacy probe', account_type='LINKED', institution_name='ACB',
                        balance=Decimal('50'), account_number_masked='****5678', bank_state=json.dumps({'stage': 'CONNECTED', 'external_account': '5678'}))
                    db.add(legacy); db.commit(); legacy_id = str(legacy.id)
                active_user[0] = user_ids[1]
                assert details(legacy_id)['stage'] == 'LEGACY'
                post(f'/accounts/{legacy_id}/bank', {'action': 'select'}, 422)
                challenge, code = send('ACB', legacy_id)
                state = post(f'/accounts/{legacy_id}/bank', {'action': 'link', 'account_number': DEMO_ACCOUNTS['ACB'].number,
                    'otp_request_id': challenge, 'otp': code})
                assert Decimal(state['source_balance']) == read_source('ACB').balance
                # First source failure keeps the verified link, but no known balance/history.
                vcb_balance = read_source('VCB').balance
                challenge, code = send('VCB')
                with patch.object(bank, 'fetch_source', side_effect=TimeoutError('source timeout')):
                    unknown = post('/accounts', creation('VCB', challenge, code), 201)
                assert unknown['bank_status'] == 'CONNECTED' and unknown['balance_available'] is False
                assert unknown['bank_last_sync'] is None and unknown['bank_sync_error']
                unknown_id = unknown['id']
                listed = expect(client.get('/api/v1/accounts'), 200)
                assert next(a for a in listed if a['id'] == unknown_id)['balance_available'] is False
                with Session(conn, join_transaction_mode='create_savepoint') as db:
                    assert db.scalar(select(func.count()).select_from(Transaction).where(Transaction.account_id == UUID(unknown_id))) == 0
                recovered = post(f'/accounts/{unknown_id}/bank', {'action': 'sync'})
                assert Decimal(recovered['source_balance']) == vcb_balance and recovered['sync_error'] is None
                previous_stamp = recovered['last_sync']
                add_event('VCB', 'new-file-event')
                # Failure after importing a row must roll back that row and all money changes.
                with patch.object(bank, 'record_balance_adjustment', side_effect=ConnectionError('mid-sync failure')):
                    failed = post(f'/accounts/{unknown_id}/bank', {'action': 'sync'})
                assert failed['last_sync'] == previous_stamp and failed['sync_error']
                assert Decimal(failed['source_balance']) == vcb_balance
                with Session(conn, join_transaction_mode='create_savepoint') as db:
                    assert db.scalar(select(func.count()).select_from(Transaction).where(
                        Transaction.account_id == UUID(unknown_id), Transaction.bank_reference.is_not(None))) == 3
                    assert db.get(Account, UUID(unknown_id)).balance == vcb_balance
                recovered = post(f'/accounts/{unknown_id}/bank', {'action': 'sync'})
                assert Decimal(recovered['source_balance']) == vcb_balance - 50000
                assert recovered['last_imported'] == 1 and recovered['sync_error'] is None
                # A fetched zero is known; it must not be shown as unavailable.
                doc = source_document()
                doc['accounts']['VCB']['opening_balance'] = str(Decimal(doc['accounts']['VCB']['opening_balance']) - read_source('VCB').balance)
                save_document(doc)
                post(f'/accounts/{unknown_id}/bank', {'action': 'sync'})
                listed = expect(client.get('/api/v1/accounts'), 200)
                zero = next(a for a in listed if a['id'] == unknown_id)
                assert zero['balance_available'] is True and Decimal(zero['balance']) == 0
                print('PASS: first failure persists unknown balance; later failure rolls back partial imports; retry and known zero')
                # Existing TCB wallet, old external ID and 3 rows: JSON append -> exactly 1 import.
                doc = source_document(); tcb_fourth = doc['accounts']['TCB']['events'].pop()
                save_document(doc)
                challenge, code = send('TCB')
                tcb = post('/accounts', creation('TCB', challenge, code), 201)
                tcb_id = tcb['id']
                assert Decimal(tcb['balance']) == 21550000
                with Session(conn, join_transaction_mode='create_savepoint') as db:
                    acc = db.get(Account, UUID(tcb_id)); state = bank.read_state(acc)
                    state['external_account'] = 'tcb-demo'
                    state.pop('source_format'); state.pop('retained_event_ids')
                    # Preserve a pre-JSON demo-button event without publishing private data to JSON.
                    state['events'].append({'id': 'demo-1', 'date': bank.today_vn().isoformat(),
                        'amount': '-50000', 'description': 'Old button event', 'status': 'BOOKED'})
                    acc.bank_state = json.dumps(state)
                    for txn in db.scalars(select(Transaction).where(Transaction.account_id == acc.id, Transaction.bank_reference.is_not(None))):
                        txn.bank_reference = txn.bank_reference.replace(':tcb:', ':tcb-demo:')
                    db.commit()
                doc['accounts']['TCB']['events'].append(tcb_fourth); save_document(doc)
                tcb_sync = post(f'/accounts/{tcb_id}/bank', {'action': 'sync'})
                assert tcb_sync['last_imported'] == 2  # repair + retained button event, no repeated sample rows
                assert Decimal(tcb_sync['source_balance']) == 20100000
                assert tcb_sync['external_account'] == 'tcb-demo'
                tcb_sync = post(f'/accounts/{tcb_id}/bank', {'action': 'sync'})
                assert tcb_sync['last_imported'] == 0
                saved_source = demo_source.DATA_PATH.read_bytes()
                saved_stamp = tcb_sync['last_sync']
                for invalid in ('{', '{"schema_version":1,"accounts":{}}'):
                    demo_source.DATA_PATH.write_text(invalid, encoding='utf-8')
                    failure = post(f'/accounts/{tcb_id}/bank', {'action': 'sync'})
                    assert failure['sync_error'] and failure['last_sync'] == saved_stamp
                    assert Decimal(failure['source_balance']) == 20100000
                demo_source.DATA_PATH.unlink()  # Only the temporary source file created by this test.
                assert post(f'/accounts/{tcb_id}/bank', {'action': 'sync'})['sync_error']
                demo_source.DATA_PATH.write_bytes(saved_source)
                for kind in ('remove', 'duplicate', 'unbook'):
                    altered = source_document(); events = altered['accounts']['TCB']['events']
                    if kind == 'remove': events.pop(0)
                    if kind == 'duplicate': events.append(dict(events[0]))
                    if kind == 'unbook': events[0]['status'] = 'PENDING'
                    save_document(altered)
                    failure = post(f'/accounts/{tcb_id}/bank', {'action': 'sync'})
                    assert failure['sync_error'] and failure['last_sync'] == saved_stamp
                    demo_source.DATA_PATH.write_bytes(saved_source)
                assert post(f'/accounts/{tcb_id}/bank', {'action': 'sync'})['last_imported'] == 0
                post('/accounts/send-otp', {'institution_name': 'TCB', 'account_number': DEMO_ACCOUNTS['TCB'].number}, 409)
                print('PASS: JSON hot reload, old ID preserved, no duplicate history, invalid/missing/removed source safe')
                # Failed email does not leave a usable challenge.
                cooldown(); mail.side_effect = RuntimeError('mock mail failure')
                post('/accounts/send-otp', {'institution_name': 'MB', 'account_number': DEMO_ACCOUNTS['MB'].number}, 503)
                with Session(conn, join_transaction_mode='create_savepoint') as db:
                    latest = db.scalar(select(PasswordResetOTP).where(PasswordResetOTP.user_id == user_ids[1]).order_by(PasswordResetOTP.created_at.desc()))
                    assert latest.is_used
                print('PASS: BASIC unaffected, explicit legacy relink, mail failure invalidates challenge')
        finally:
            outer.rollback()
        assert snapshot(conn) == before, 'Existing DB data changed!'
        print('PASS: all 20 tables unchanged after rollback; no actual email sent')
    engine.dispose()

def main():
    original = demo_source.DATA_PATH.read_bytes()
    with tempfile.TemporaryDirectory(prefix='capitalflow-json-source-test-') as directory:
        path = Path(directory) / 'demo_bank_data.json'
        path.write_bytes(original)
        with patch.object(demo_source, 'DATA_PATH', path):
            run_checks()


if __name__ == '__main__':
    main()
