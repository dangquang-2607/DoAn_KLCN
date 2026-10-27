"""HTTP + SQL + real budget dispatcher regression; no committed fixtures or emails.

Run explicitly from capitalflow-api with .venv/Scripts/python.exe -B
tests/financial_consistency_integration.py. Every write (including endpoint and
worker commits) is inside an outer rollback. Only this run's jobs are dispatched;
EMAIL/OCR/file jobs are never executed. Source edits use a temporary JSON copy.
"""
import json
import sys
import tempfile
from datetime import timedelta
from decimal import Decimal
from pathlib import Path
from unittest.mock import AsyncMock, patch
from uuid import UUID, uuid4

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
sys.path.insert(0, str(Path(__file__).resolve().parents[2] / 'capitalflow-database' / 'tools'))
from fastapi import FastAPI, Depends, Request
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, select, func
from sqlalchemy.orm import Session
from apply_bank_otp import snapshot
import app.dung_chung.database.dang_ky_mo_hinh
from app.dung_chung.config import settings
from app.dung_chung.http.phu_thuoc import get_db, get_current_user
from app.dung_chung.tac_vu_nen.hang_doi import decode
from app.dung_chung.tac_vu_nen.trinh_chay import dispatch
from app.dung_chung.tac_vu_nen.luu_tru.tac_vu_nen import BackgroundJob
from app.chuc_nang.nguoi_dung.dang_nhap.luu_tru.nguoi_dung import User
from app.chuc_nang.nguoi_dung.tai_chinh.vi_tai_khoan import api as accounts
from app.chuc_nang.nguoi_dung.tai_chinh.vi_tai_khoan.legacy_bank_sync import bank, demo_source
from app.chuc_nang.nguoi_dung.tai_chinh.vi_tai_khoan.luu_tru.account import Account
from app.chuc_nang.nguoi_dung.tai_chinh.giao_dich import api as transactions
from app.chuc_nang.nguoi_dung.tai_chinh.giao_dich.luu_tru.giao_dich import Transaction
from app.chuc_nang.nguoi_dung.tai_chinh.ngan_sach import api as budgets
from app.chuc_nang.nguoi_dung.tai_chinh.bao_cao_tai_chinh import phan_tich, dashboard
from app.chuc_nang.nguoi_dung.tai_chinh.thong_bao.luu_tru.thong_bao import Notification
from app.chuc_nang.nguoi_dung.hoa_don_ai.api.routes import router as invoices
from app.chuc_nang.nguoi_dung.hoa_don_ai.luu_tru.invoice import Invoice


def run_checks():
    today = bank.today_vn()
    yesterday = today - timedelta(days=1)
    engine = create_engine(settings.database_url, hide_parameters=True)
    with engine.connect() as conn:
        before = snapshot(conn)
        conn.rollback()
        outer = conn.begin()
        def sessions():
            return Session(conn, autoflush=False, join_transaction_mode='create_savepoint')
        try:
            uids = [uuid4(), uuid4()]
            with sessions() as db:
                db.add_all(User(id=uid, email=f'finance-probe-{uid.hex}@example.invalid',
                    full_name='Finance probe', password_hash='unusable', token_version=0) for uid in uids)
                db.commit()
            active = [uids[0]]
            app = FastAPI()
            for router in (accounts.router, bank.router, transactions.router, budgets.router,
                           phan_tich.router, dashboard.router, invoices):
                app.include_router(router, prefix='/api/v1')
            def database(request: Request):
                with sessions() as db:
                    db.info['request'] = request
                    yield db
            def current_user(db=Depends(get_db)):
                return db.get(User, active[0])
            app.dependency_overrides[get_db] = database
            app.dependency_overrides[get_current_user] = current_user
            mail = AsyncMock()
            with TestClient(app) as client, patch.object(accounts, 'send_otp_email', mail):
                def call(method, path, body=None, status=200, key=None):
                    response = client.request(method, '/api/v1' + path, json=body,
                        headers={'Idempotency-Key': key or uuid4().hex})
                    assert response.status_code == status, (method, path, response.status_code, response.text)
                    return response.json() if response.content else None
                def post(path, body, status=201, key=None):
                    return call('POST', path, body, status, key)
                def budget(start, limit):
                    return post('/budgets', {'name': 'Consistency budget', 'period_type': 'CUSTOM',
                        'start_date': start.isoformat(), 'end_date': today.isoformat(), 'amount_limit': str(limit)})['id']
                def verify(balances, income, expense, bid, spent, start=None):
                    start = start or today.replace(day=1)
                    listed = call('GET', '/accounts')
                    assert {a['id']: Decimal(a['balance']) for a in listed} == balances
                    summary = call('GET', f'/analytics?start_date={start}&end_date={today}')['summary']
                    assert {k: Decimal(str(v)) for k, v in summary.items()} == {
                        'income': Decimal(income), 'expense': Decimal(expense), 'net': Decimal(income - expense)}
                    progress = call('GET', '/budgets/' + bid)
                    assert Decimal(progress['spent_amount']) == spent, progress
                    dash = call('GET', '/dashboard')
                    assert Decimal(str(dash['net_worth'])) == sum(balances.values())
                    if start == today.replace(day=1):
                        assert Decimal(str(dash['income_this_month'])) == income
                        assert Decimal(str(dash['expense_this_month'])) == expense
                    with sessions() as db:
                        for aid, amount in balances.items():
                            total = db.scalar(select(func.coalesce(func.sum(Transaction.amount), 0)).where(
                                Transaction.account_id == UUID(aid), Transaction.user_id == active[0]))
                            assert total == amount, ('ledger balance mismatch', aid, total, amount)
                def jobs(kind='BUDGET'):
                    with sessions() as db:
                        return db.scalars(select(BackgroundJob.id).where(
                            BackgroundJob.owner_user_id == active[0], BackgroundJob.kind == kind)).all()
                def drain_budget_jobs():
                    # Never call claim(): it could pick an existing real user's job.
                    for jid in jobs():
                        with sessions() as db:
                            job = db.get(BackgroundJob, jid)
                            if job.status == 'DONE':
                                continue
                            lease = uuid4()
                            job.status = 'RUNNING'; job.lease_token = lease
                            job.lease_until = bank.now() + timedelta(minutes=3)
                            payload = decode(job)
                            db.commit()
                        dispatch(jid, lease, 'BUDGET', payload, sessions)
                        dispatch(jid, lease, 'BUDGET', payload, sessions)  # At-least-once delivery.
                        with sessions() as db:
                            db.get(BackgroundJob, jid).status = 'DONE'
                            db.commit()
                def alerts():
                    with sessions() as db:
                        return [json.loads(n.metadata_json) for n in db.scalars(select(Notification).where(
                            Notification.user_id == active[0], Notification.kind == 'BUDGET'))]

                # Manual money: each assertion crosses accounts, ledger, reports and budget API.
                a = post('/accounts', {'name': 'Cash A', 'account_type': 'BASIC', 'balance': '5000000'})['id']
                b = post('/accounts', {'name': 'Cash B', 'account_type': 'BASIC', 'balance': '2000000'})['id']
                bid = budget(today.replace(day=1), 2000000)
                verify({a: 5000000, b: 2000000}, 0, 0, bid, 0)
                base = {'account_id': a, 'transaction_date': today.isoformat(), 'description': 'Probe'}
                key = uuid4().hex
                payload = {**base, 'type': 'INCOME', 'amount': '1000000'}
                income = post('/transactions', payload, key=key)
                assert post('/transactions', payload, key=key)['id'] == income['id']
                post('/transactions', {**payload, 'amount': '2000000'}, 409, key)
                expense = post('/transactions', {**base, 'type': 'EXPENSE', 'amount': '200000'})
                verify({a: 5800000, b: 2000000}, 1000000, 200000, bid, 200000)
                call('PATCH', '/transactions/' + expense['id'], {'account_id': b, 'amount': '300000'})
                verify({a: 6000000, b: 1700000}, 1000000, 300000, bid, 300000)
                transfer = {'from_account_id': a, 'to_account_id': b, 'amount': '400000',
                            'transaction_date': today.isoformat()}
                key = uuid4().hex
                pair = post('/transactions/transfer', transfer, key=key)
                assert post('/transactions/transfer', transfer, key=key) == pair
                verify({a: 5600000, b: 2100000}, 1000000, 300000, bid, 300000)
                post('/transactions/transfer', {**transfer, 'amount': '99999999'}, 400)
                verify({a: 5600000, b: 2100000}, 1000000, 300000, bid, 300000)
                call('DELETE', '/transactions/' + pair['transfer_out_id'], status=204)
                verify({a: 6000000, b: 1700000}, 1000000, 300000, bid, 300000)
                call('DELETE', '/transactions/' + expense['id'], status=204)
                call('PATCH', '/accounts/' + a, {'balance': '6500000'})
                verify({a: 6500000, b: 2000000}, 1000000, 0, bid, 0)
                print('PASS: create/edit/move/delete, transfer pair, insufficient funds rollback, adjustment and request replay')

                # Starts after OCR recognition: external OCR inference is deliberately not invoked.
                iid = uuid4()
                with sessions() as db:
                    db.add(Invoice(id=iid, user_id=active[0], status='REVIEW_REQUIRED',
                        merchant_name='Consistency receipt', invoice_date=today, total_amount=Decimal('400000'),
                        file_sha256=uuid4().hex * 2, currency='VND'))
                    db.commit()
                key = uuid4().hex
                confirmed = post(f'/invoices/{iid}/confirm', {'account_id': a}, key=key)
                assert post(f'/invoices/{iid}/confirm', {'account_id': a}, key=key) == confirmed
                verify({a: 6100000, b: 2000000}, 1000000, 400000, bid, 400000)
                call('DELETE', '/transactions/' + confirmed['transaction_id'], status=204)
                verify({a: 6500000, b: 2000000}, 1000000, 0, bid, 0)
                with sessions() as db:
                    invoice = db.get(Invoice, iid)
                    assert invoice.status == 'REVIEW_REQUIRED' and invoice.confirmation_generation == 1
                    revision = invoice.revision
                post(f'/invoices/{iid}/confirm', {'account_id': a}, 409)
                post(f'/invoices/{iid}/confirm', {'account_id': a, 'expected_revision': revision})
                verify({a: 6100000, b: 2000000}, 1000000, 400000, bid, 400000)
                drain_budget_jobs()
                assert not alerts()
                print('PASS: invoice confirm/retry, delete and reconfirm keep balance, budget and reports consistent')

                active[0] = uids[1]
                bid = budget(today, 1000000)
                doc = json.loads(demo_source.DATA_PATH.read_text(encoding='utf-8'))
                doc['accounts']['MOMO'] = {'opening_balance': '5000000', 'events': [
                    {'id': 'correction-probe', 'amount': '-200000', 'description': 'Purchase',
                     'date': yesterday.isoformat(), 'status': 'BOOKED'}]}
                def source(**changes):
                    doc['accounts']['MOMO']['events'][0].update(changes)
                    demo_source.DATA_PATH.write_text(json.dumps(doc), encoding='utf-8')
                source()
                challenge = post('/accounts/send-otp', {'institution_name': 'MOMO', 'account_number': '0987654321'}, 200)
                linked = post('/accounts', {'name': 'Bank probe', 'account_type': 'LINKED', 'institution_name': 'MOMO',
                    'account_number_masked': '0987654321', 'otp_request_id': challenge['otp_request_id'],
                    'otp_code': mail.await_args.kwargs['otp_code']})['id']
                def sync(key=None):
                    return post(f'/accounts/{linked}/bank', {'action': 'sync'}, 200, key)
                def bank_verify(balance, expense):
                    verify({linked: balance}, 0, expense, bid, expense, start=today)
                bank_verify(4800000, 0)
                drain_budget_jobs()
                assert not alerts()
                with sessions() as db:
                    txn = db.scalar(select(Transaction).where(Transaction.account_id == UUID(linked),
                        Transaction.bank_reference.is_not(None)))
                    txid = str(txn.id)
                call('PATCH', '/transactions/' + txid, {'note': 'Keep local note'})
                source(amount='-900000', date=today.isoformat())
                count = len(jobs()); key = uuid4().hex
                first = sync(key)
                assert len(jobs()) == count + 1
                assert sync(key) == first  # Simulated lost response: discard first and replay the same request.
                assert sync()['last_imported'] == 0 and len(jobs()) == count + 1
                bank_verify(4100000, 900000)
                drain_budget_jobs()
                assert len(alerts()) == 1 and Decimal(alerts()[0]['spent']) == 900000
                source(description='Corrected wording')
                sync()
                assert len(jobs()) == count + 1
                source(amount='-1100000')
                sync(); drain_budget_jobs()
                bank_verify(3900000, 1100000)
                assert len(alerts()) == 2 and len(jobs('EMAIL')) == 2
                assert {Decimal(item['spent']) for item in alerts()} == {900000, 1100000}
                print('PASS: source correction triggers 80/100 percent warnings; replay/unchanged/description-only syncs do not duplicate jobs')

                # Fail after updating both money and queue; savepoint must roll both back.
                count = len(jobs())
                source(amount='-1200000')
                with patch.object(bank, 'record_balance_adjustment', side_effect=ConnectionError('probe failure')):
                    failed = sync()
                assert failed['sync_error'] and len(jobs()) == count
                bank_verify(3900000, 1100000)
                sync(); drain_budget_jobs()
                bank_verify(3800000, 1200000)
                assert len(alerts()) == 2 and len(jobs('EMAIL')) == 2
                count = len(jobs())
                source(date=yesterday.isoformat())
                sync(); drain_budget_jobs()
                bank_verify(3800000, 0)
                source(date=today.isoformat())
                sync(); drain_budget_jobs()
                bank_verify(3800000, 1200000)
                assert len(jobs()) == count + 2  # A -> B -> A must not reuse an old completed check.
                assert len(alerts()) == 2 and len(jobs('EMAIL')) == 2
                count = len(jobs())
                source(amount='100000')
                sync(); drain_budget_jobs()
                verify({linked: 5100000}, 100000, 0, bid, 0, start=today)
                assert len(jobs()) == count
                source(amount='-1200000')  # Same source ID: correct an income into an expense (MoMo case).
                sync(); drain_budget_jobs()
                bank_verify(3800000, 1200000)
                assert len(jobs()) == count + 1
                assert len(alerts()) == 2 and len(jobs('EMAIL')) == 2
                with sessions() as db:
                    txn = db.get(Transaction, UUID(txid))
                    assert txn.note == 'Keep local note'
                    assert db.scalar(select(func.count()).select_from(Transaction).where(
                        Transaction.account_id == UUID(linked), Transaction.bank_reference.is_not(None))) == 1
                call('PATCH', '/transactions/' + txid, {'amount': '1'}, 409)
                call('DELETE', '/transactions/' + txid, status=409)
                call('PATCH', '/transactions/' + income['id'], {'amount': '1'}, 404)
                print('PASS: correction rollback includes outbox; date/sign changes, A-B-A, metadata, read-only bank and ownership guards')
        finally:
            outer.rollback()
            assert snapshot(conn) == before, 'Existing DB data changed!'
            print('PASS: all existing tables unchanged after rollback; no external OCR or email calls')
    engine.dispose()


def main():
    original = demo_source.DATA_PATH.read_bytes()
    with tempfile.TemporaryDirectory(prefix='capitalflow-finance-test-', dir=Path(__file__).resolve().parent) as directory:
        path = Path(directory) / 'source.json'
        path.write_bytes(original)
        with patch.object(demo_source, 'DATA_PATH', path):
            run_checks()


if __name__ == '__main__':
    main()
