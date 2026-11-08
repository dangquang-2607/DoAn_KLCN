"""Round 5: business fault/race checks on a migrated disposable SQL Server DB.

Runs application code in a child process with an isolated DB. CF_QA_SOURCE may
select a source staging directory. Never consumes the live queue or sends mail.
Run: .venv/Scripts/python.exe -B tools/verify_fault_concurrency.py --batch A --label baseline
"""
from __future__ import annotations

import argparse
import asyncio
from concurrent.futures import ThreadPoolExecutor
from contextlib import ExitStack
from datetime import datetime, timedelta, timezone
from decimal import Decimal
import json
import logging
import os
from pathlib import Path
import re
import subprocess
import sys
from tempfile import TemporaryDirectory
from threading import Barrier, Event, Lock
import time
from unittest.mock import AsyncMock, patch
from uuid import UUID, uuid4

import pyodbc
from fastapi import Depends, Request
from cryptography.fernet import Fernet
from sqlalchemy import create_engine, event, func, select, text
from sqlalchemy.engine import make_url

pyodbc.pooling = False
API = Path(__file__).resolve().parents[1]
ROOT = API.parent
OUT = ROOT / 'output/fault-concurrency-qa'
SOURCE = Path(os.environ.get('CF_QA_SOURCE', str(API))).resolve()
sys.path.insert(0, str(SOURCE if '--child' in sys.argv else API))
from app.dung_chung.config import settings


def local_url(owned=False):
    url = make_url(settings.database_url)
    host = (url.host or '').lower().split('\\')[0].split(',')[0]
    assert settings.app_env == 'development' and url.get_backend_name() == 'mssql'
    assert host in {'localhost', '127.0.0.1', '.', '(local)'}
    assert not {'odbc_connect', 'dsn'} & url.query.keys()
    if owned:
        assert re.fullmatch(r'cf_fault_qa_[a-f0-9]{12}', url.database or ''), 'Refusing non-QA database'
    return url


def parent(args):
    source = local_url()
    assert (SOURCE / 'app/main.py').is_file(), 'API source directory missing'
    database = 'cf_fault_qa_' + uuid4().hex[:12]
    assert database != source.database
    OUT.mkdir(parents=True, exist_ok=True)
    prefix = 'gui' if args.gui else f'5{args.batch}-{args.label}'
    env = {**os.environ, 'DATABASE_URL': source.set(database=database).render_as_string(hide_password=False),
           'APP_ENV': 'development', 'PYTHONIOENCODING': 'utf-8', 'CF_QA_SOURCE': str(SOURCE),
           'JOB_ENCRYPTION_KEY': Fernet.generate_key().decode(), 'JWT_SECRET_KEY': Fernet.generate_key().decode(),
           'SMTP_USER': '', 'SMTP_PASSWORD': '', 'GOOGLE_AI_API_KEY': ''}
    master = create_engine(source.set(database='master'), isolation_level='AUTOCOMMIT', hide_parameters=True)
    report = {'recorded_at': datetime.now(timezone(timedelta(hours=7))).isoformat(), 'batch': args.batch,
              'database': database, 'main_database_touched': False, 'source': str(SOURCE),
              'independent_connections': True, 'real_smtp_calls': 0, 'real_gemini_calls': 0, 'removed': False}
    with master.connect() as db:
        assert db.scalar(text('SELECT DB_ID(:name)'), {'name': database}) is None
        db.exec_driver_sql(f'CREATE DATABASE [{database}]')
    try:
        with (OUT / f'{prefix}-migrations.log').open('w', encoding='utf-8') as log:
            subprocess.run([sys.executable, '-B', '-m', 'alembic', 'upgrade', 'head'],
                           cwd=ROOT / 'capitalflow-database', env=env, stdout=log, stderr=subprocess.STDOUT, check=True)
        with (OUT / f'{prefix}-suite.log').open('w', encoding='utf-8') as log:
            result = subprocess.run([sys.executable, '-B', str(Path(__file__).resolve()), '--child',
                                     '--batch', args.batch, '--repeats', str(args.repeats), *(['--gui'] if args.gui else [])],
                                    cwd=API, env=env, stdout=log, stderr=subprocess.STDOUT, timeout=3600 if args.gui else 900)
        report['exit_code'] = result.returncode
        content = (OUT / f'{prefix}-suite.log').read_text(encoding='utf-8')
        matches = list(re.finditer(r'^\{(?=\s*"passed")', content, re.M))
        if matches:
            report.update(json.JSONDecoder().raw_decode(content[matches[-1].start():])[0])
    finally:
        try:
            with master.connect() as db:
                assert re.fullmatch(r'cf_fault_qa_[a-f0-9]{12}', database)
                db.exec_driver_sql(f'ALTER DATABASE [{database}] SET SINGLE_USER WITH ROLLBACK IMMEDIATE')
                db.exec_driver_sql(f'DROP DATABASE [{database}]')
                report['removed'] = db.scalar(text('SELECT DB_ID(:name)'), {'name': database}) is None
        finally:
            master.dispose()
            (OUT / f'{prefix}-results.json').write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
    print(json.dumps({k:v for k,v in report.items() if k != 'cases'}, ensure_ascii=False))
    return report.get('exit_code', 1)


def suite(args):
    local_url(owned=True)
    from fastapi.testclient import TestClient
    from sqlalchemy.orm import Session
    from app.main import app
    from app.dung_chung.database.ket_noi import engine
    from app.dung_chung.database.session import SessionLocal as sessions
    from app.dung_chung.http.gioi_han_tan_suat import limiter
    from app.dung_chung.security.passwords import hash_password
    from app.dung_chung.tac_vu_nen.luu_tru.tac_vu_nen import BackgroundJob
    from app.chuc_nang.nguoi_dung.dang_nhap.luu_tru.nguoi_dung import User, UserRole
    from app.chuc_nang.nguoi_dung.tai_chinh.vi_tai_khoan import wallet_api
    from app.chuc_nang.nguoi_dung.tai_chinh.vi_tai_khoan.luu_tru.wallet import Wallet, WalletEntry, DemoBankBalance, UserBankLink
    from app.chuc_nang.nguoi_dung.tai_chinh.giao_dich.luu_tru.giao_dich import Transaction
    from app.chuc_nang.nguoi_dung.tai_chinh.giao_dich.luu_tru.ban_ghi_luy_dang import IdempotencyRecord
    from app.chuc_nang.nguoi_dung.hoa_don_ai.luu_tru.invoice import Invoice
    from app.chuc_nang.nguoi_dung.hoa_don_ai.luu_tru.invoice_item import InvoiceItem
    from app.chuc_nang.nguoi_dung.hoa_don_ai.luu_tru.tac_vu_ocr import OcrJob
    from app.dung_chung.tac_vu_nen import trinh_chay as worker
    from app.chuc_nang.quan_tri.nhat_ky_quan_tri.luu_tru.nhat_ky import AuditLog
    from app.chuc_nang.nguoi_dung.dang_nhap.luu_tru.refresh_token import RefreshToken
    from app.chuc_nang.quan_tri.ho_tro.luu_tru import AccountSupportCase

    logging.getLogger('httpx').setLevel(logging.WARNING)
    results, tests, connection_proofs = [], [], []
    password = 'Disposable-QA-pass-2026!'
    hashed = hash_password(password)

    def case(group, name):
        def register(function):
            tests.append((group, name, function))
            return function
        return register

    def expect(condition, message):
        if not condition:
            raise AssertionError(message)

    def actor(balance=100000, bank_balance=1000000, role=UserRole.USER, system=False, support=False):
        uid, wid, bid, lid = [uuid4() for _ in range(4)]
        email = f'fault-{uid.hex}@example.com'
        with sessions() as db:
            db.add(User(id=uid, email=email, full_name='QA đồng thời', password_hash=hashed,
                        role=role, is_system_account=system, support_only=support))
            db.flush()
            db.add_all([Wallet(id=wid, user_id=uid, name='Ví QA', balance=balance, is_default=True),
                        DemoBankBalance(id=bid, user_id=uid, provider='VCB', account_number=str(int(uid.hex[:12], 16)),
                                        account_number_masked='QA', opening_balance=bank_balance, balance=bank_balance)])
            db.flush()
            db.add(UserBankLink(id=lid, user_id=uid, bank_id=bid, expires_at=datetime.now(timezone.utc).replace(tzinfo=None)+timedelta(days=1)))
            db.commit()
        response = client.post('/api/v1/auth/login', json={'email':email, 'password':password})
        expect(response.status_code == 200, f'fixture login HTTP {response.status_code}')
        return {'id':uid, 'wallet':wid, 'bank':bid, 'link':lid, 'tokens':response.json(), 'email':email}

    def request(owner, method, path, body=None, key=None):
        headers = {'Authorization':'Bearer '+owner['tokens']['access_token']}
        if key is not None:
            headers['Idempotency-Key'] = key
        return client.request(method, '/api/v1'+path, json=body, headers=headers)

    def ok(owner, method, path, body=None, key=None, status=200):
        response = request(owner, method, path, body, key)
        expect(response.status_code == status, f'{method} {path.split("?")[0]} HTTP {response.status_code}, expected {status}')
        return response.json()

    def extra_wallet(owner, balance=0):
        with sessions() as db:
            row = Wallet(user_id=owner['id'], name='Ví QA phụ', balance=balance)
            db.add(row); db.commit()
            return row.id

    def bill(owner, amount=25000):
        return ok(owner, 'POST', '/wallets/bills/qr', {'merchant_name':'QA Cafe',
                   'items':[{'name':'Trà sữa', 'quantity':1, 'unit_price':str(amount)}]})

    def snapshot(owner):
        with sessions() as db:
            return {'wallets':dict(db.execute(select(Wallet.id, Wallet.balance).where(Wallet.user_id == owner['id'])).all()),
                    'bank':db.get(DemoBankBalance, owner['bank']).balance,
                    'entries':db.scalar(select(func.count()).select_from(WalletEntry).join(Wallet,Wallet.id==WalletEntry.wallet_id).where(Wallet.user_id==owner['id'])),
                    'records':db.scalar(select(func.count()).select_from(Transaction).where(Transaction.user_id==owner['id'])),
                    'jobs':db.scalar(select(func.count()).select_from(BackgroundJob).where(BackgroundJob.owner_user_id==owner['id'])),
                    'replays':db.scalar(select(func.count()).select_from(IdempotencyRecord).where(IdempotencyRecord.user_id==owner['id']))}

    def race(functions, sql_gate=True, sql_table='users', sql_marker='UPDLOCK'):
        barrier = Barrier(len(functions), timeout=15)
        sql_barrier = Barrier(len(functions), timeout=15)
        connections=set(); guard=Lock()
        def at_lock(conn, cursor, statement, parameters, context, many):
            if not sql_gate or sql_marker not in statement or sql_table not in statement:
                return
            identity=id(conn.connection.dbapi_connection)
            with guard:
                first=identity not in connections and len(connections)<len(functions)
                if first: connections.add(identity)
            if first: sql_barrier.wait()
        def invoke(fn):
            barrier.wait()
            return fn()
        event.listen(engine,'before_cursor_execute',at_lock)
        try:
            with ThreadPoolExecutor(len(functions)) as pool:
                futures = [pool.submit(invoke, fn) for fn in functions]
                replies=[future.result(timeout=30) for future in futures]
            if sql_gate:
                expect(len(connections)==len(functions),'concurrent requests did not reach independent DB connections')
                connection_proofs.append(len(connections))
            return replies
        finally:
            event.remove(engine,'before_cursor_execute',at_lock)

    def invoice(owner, status='REVIEW_REQUIRED', storage_key=None):
        with sessions() as db:
            row=Invoice(user_id=owner['id'],status=status,merchant_name='QA Invoice '+uuid4().hex[:8],
                        invoice_number=uuid4().hex,invoice_date=datetime.now().date(),total_amount=50000,
                        storage_key=storage_key,mime_type='image/jpeg',revision=1)
            db.add(row); db.commit()
            return row.id

    if args.batch == 'A':
        for kind in ['topup','withdraw','transfer','payment','bookkeeping']:
            for iteration in range(args.repeats):
                @case('5A-01', f'{kind}: same request concurrent #{iteration+1}')
                def repeated(kind=kind):
                    a = actor(); key = uuid4().hex
                    path = f'/wallets/{a["wallet"]}/'
                    if kind in {'topup','withdraw'}:
                        path += kind; body = {'link_id':str(a['link']), 'amount':'25000'}
                    elif kind == 'transfer':
                        target = extra_wallet(a); path += 'transfers/create'
                        body = {'to_wallet_id':str(target), 'amount':'25000'}
                    elif kind == 'payment':
                        path += 'payments/create'; body = {'qr_payload':bill(a)['qr_payload']}
                    else:
                        path = '/bookkeeping'; body = {'type':'INCOME','amount':'25000','transaction_date':datetime.now().date().isoformat()}
                    before = snapshot(a)
                    responses = race([lambda:request(a,'POST',path,body,key)]*2)
                    expect(all(r.status_code in {200,201} for r in responses), f'statuses {[r.status_code for r in responses]}')
                    expect(responses[0].json() == responses[1].json(), 'replay result differs')
                    after = snapshot(a)
                    delta = {'topup':25000,'withdraw':-25000,'transfer':-25000,'payment':-25000,'bookkeeping':0}[kind]
                    expect(after['wallets'][a['wallet']] == before['wallets'][a['wallet']]+delta, 'wallet changed more than once')
                    expect(after['entries']-before['entries'] == (2 if kind=='transfer' else 0 if kind=='bookkeeping' else 1), 'wrong entry count')
                    expect(after['records']-before['records'] == (2 if kind=='transfer' else 1), 'wrong financial record count')
                    expect(after['replays']-before['replays']==1, 'wrong replay count')
                    expected_jobs=1 if kind in {'payment','bookkeeping'} else 0
                    expect(after['jobs']-before['jobs']==expected_jobs,'duplicate or missing queued work')

        @case('5A-02','same key different amount and wallet is rejected')
        def changed_body():
            a = actor(); key = uuid4().hex
            path = f'/wallets/{a["wallet"]}/topup'; body={'link_id':str(a['link']),'amount':'25000'}
            ok(a,'POST',path,body,key)
            before = snapshot(a)
            for payload, route in [({**body,'amount':'26000'},path), (body,f'/wallets/{extra_wallet(a)}/topup')]:
                # Wallet creation is fixture setup, separate from the protected business assertion.
                expected = snapshot(a)
                response = request(a,'POST',route,payload,key)
                expect(response.status_code==409, f'key mismatch HTTP {response.status_code}')
                expect(snapshot(a)==expected, 'conflicting request changed data')
            expect(snapshot(a)['entries']==before['entries'], 'extra debit/credit')

        for iteration in range(args.repeats):
            @case('5A-03',f'same invoice from two wallets with distinct keys #{iteration+1}')
            def same_bill():
                a = actor(); target=extra_wallet(a,100000); body={'qr_payload':bill(a)['qr_payload']}
                responses = race([lambda wid=wid:request(a,'POST',f'/wallets/{wid}/payments/create',body,uuid4().hex)
                                  for wid in [a['wallet'],target]])
                expect(sorted(r.status_code for r in responses)==[201,409], f'statuses {[r.status_code for r in responses]}')
                after=snapshot(a)
                expect(sum(after['wallets'].values())==175000 and after['entries']==after['records']==1, 'same bill charged twice')

            @case('5A-04',f'two 80000 expenses compete for 100000 #{iteration+1}')
            def insufficient():
                a=actor(); bodies=[{'qr_payload':bill(a,80000)['qr_payload']} for _ in range(2)]
                responses=race([lambda body=body:request(a,'POST',f'/wallets/{a["wallet"]}/payments/create',body,uuid4().hex) for body in bodies])
                expect(sorted(r.status_code for r in responses)==[201,409], f'statuses {[r.status_code for r in responses]}')
                after=snapshot(a)
                expect(after['wallets'][a['wallet']]==20000 and after['entries']==after['records']==1, 'insufficient balance race corrupted data')

            @case('5A-05',f'opposite transfers between two users #{iteration+1}')
            def opposite():
                a,b=actor(),actor()
                bodies=[{'to_wallet_id':str(b['wallet']),'amount':'25000'},{'to_wallet_id':str(a['wallet']),'amount':'10000'}]
                responses=race([lambda who=who,body=body:request(who,'POST',f'/wallets/{who["wallet"]}/transfers/create',body,uuid4().hex)
                                for who,body in zip([a,b],bodies)])
                expect([r.status_code for r in responses]==[200,200], f'statuses {[r.status_code for r in responses]}')
                aa,bb=snapshot(a),snapshot(b)
                expect(aa['wallets'][a['wallet']]==85000 and bb['wallets'][b['wallet']]==115000, 'opposite transfers lost money')
                with sessions() as db:
                    rows=db.execute(select(WalletEntry.operation_id,func.count(),func.sum(WalletEntry.amount)).where(
                        WalletEntry.wallet_id.in_([a['wallet'],b['wallet']])).group_by(WalletEntry.operation_id)).all()
                    expect(len(rows)==2 and all(count==2 and total==0 for _,count,total in rows), 'transfer has incomplete legs')

            @case('5A-06',f'topup and withdraw compete on same wallet/bank #{iteration+1}')
            def bank_race():
                a=actor(); body={'link_id':str(a['link']),'amount':'50000'}
                responses=race([lambda action=action:request(a,'POST',f'/wallets/{a["wallet"]}/{action}',body,uuid4().hex)
                                for action in ['topup','withdraw']])
                expect(all(r.status_code==200 for r in responses), f'statuses {[r.status_code for r in responses]}')
                after=snapshot(a)
                expect(after['wallets'][a['wallet']]==100000 and after['bank']==1000000 and after['entries']==2, 'bank/wallet total mismatch')

        @case('5A-06','two wallets compete for insufficient shared bank funds')
        def bank_insufficient():
            a=actor(balance=0,bank_balance=100000); other=extra_wallet(a)
            body={'link_id':str(a['link']),'amount':'80000'}
            responses=race([lambda wid=wid:request(a,'POST',f'/wallets/{wid}/topup',body,uuid4().hex) for wid in [a['wallet'],other]])
            expect(sorted(r.status_code for r in responses)==[200,409], f'statuses {[r.status_code for r in responses]}')
            after=snapshot(a)
            expect(sum(after['wallets'].values())==80000 and after['bank']==20000 and after['entries']==1, 'shared bank overspent')

        for point in ['after_debit','record','queue','before_commit','after_commit']:
            @case('5A-07',f'failure at {point}, rollback or replay as appropriate')
            def interrupted(point=point):
                from app.dung_chung.tac_vu_nen import hang_doi
                from app.chuc_nang.nguoi_dung.tai_chinh.giao_dich import bookkeeping
                a=actor(); key=uuid4().hex; before=snapshot(a)
                path=f'/wallets/{a["wallet"]}/payments/create'; body={'qr_payload':bill(a)['qr_payload']}
                original_entry,original_queue,original_commit=wallet_api.entry,hang_doi.enqueue,Session.commit
                fired=[]
                def entry_failure(*params,**kw):
                    result=original_entry(*params,**kw); fired.append(True)
                    raise RuntimeError('QA after debit')
                def queue_failure(*params,**kw):
                    result=original_queue(*params,**kw); fired.append(True)
                    raise RuntimeError('QA after queue insertion')
                def commit_failure(db):
                    eligible = db.info.get('request') is not None and db.info['request'].url.path.endswith('/payments/create') and any(isinstance(x,IdempotencyRecord) for x in db.new)
                    if eligible:
                        fired.append(True)
                        if point=='after_commit': original_commit(db)
                        raise RuntimeError('QA at commit boundary')
                    return original_commit(db)
                with ExitStack() as fault:
                    if point=='after_debit': fault.enter_context(patch.object(wallet_api,'entry',side_effect=entry_failure))
                    elif point=='record':
                        def record_failure(*p,**kw):
                            fired.append(True); raise RuntimeError('QA before record')
                        fault.enter_context(patch.object(bookkeeping,'create_record',side_effect=record_failure))
                    elif point=='queue': fault.enter_context(patch.object(hang_doi,'enqueue',side_effect=queue_failure))
                    else: fault.enter_context(patch.object(Session,'commit',new=commit_failure))
                    response=request(a,'POST',path,body,key)
                expect(fired and response.status_code>=500, f'fault not reached or wrong HTTP {response.status_code}')
                after=snapshot(a)
                if point!='after_commit': expect(after==before, 'partial data remained after failed commit')
                else: expect(after['wallets'][a['wallet']]==75000 and after['entries']==after['records']==1, 'known committed data disappeared')
                replay=ok(a,'POST',path,body,key,status=201)
                final=snapshot(a)
                expect(final['wallets'][a['wallet']]==75000 and final['entries']==final['records']==final['replays']==1, 'retry duplicated financial operation')

        @case('5A-08','lost response after committed payment; same-key replay and totals')
        def lost_response():
            a=actor(); today=datetime.now().date(); key=uuid4().hex
            cid=ok(a,'POST','/categories',{'name':'QA food '+uuid4().hex[:6],'type':'EXPENSE'},status=201)['id']
            budget=ok(a,'POST','/budgets',{'category_id':cid,'amount_limit':'100000','period_type':'MONTHLY',
                                          'is_recurring':True,'start_date':today.replace(day=1).isoformat()},status=201)['id']
            body={'qr_payload':bill(a)['qr_payload'],'category_id':cid}
            # This represents the server result discarded by a failing transport; GUI/proxy evidence is separate.
            completed=request(a,'POST',f'/wallets/{a["wallet"]}/payments/create',body,key)
            expect(completed.status_code==201, f'upstream HTTP {completed.status_code}')
            recovered=ok(a,'POST',f'/wallets/{a["wallet"]}/payments/create',body,key,status=201)
            status=ok(a,'POST','/wallets/bills/payment-status',{'qr_payload':body['qr_payload']})
            expect(recovered==completed.json() and status['operation_id']==recovered['operation_id'], 'recovered wrong operation')
            totals=ok(a,'GET',f'/analytics?month={today.month}&year={today.year}')['summary']
            spent=ok(a,'GET',f'/budgets/{budget}')['spent_amount']
            expect(Decimal(str(totals['expense']))==Decimal(str(spent))==25000, 'budget/report disagrees')
            after=snapshot(a)
            expect(after['wallets'][a['wallet']]==75000 and after['entries']==after['records']==1, 'lost-response replay debited twice')

    if args.batch=='B':
        @case('5B-03','logout before protected payment check rejects the stale in-flight request')
        def logout_before_payment():
            from app.dung_chung.http import phu_thuoc as deps
            a=actor();body={'qr_payload':bill(a)['qr_payload']};entered,release=Event(),Event()
            def paused(request:Request,credentials=Depends(deps.security),db=Depends(deps.get_db)):
                user=deps.get_current_user(request,credentials,db)
                if user.id==a['id'] and request.url.path.endswith('/payments/create'):
                    entered.set();expect(release.wait(15),'logout/payment test not released')
                return user
            app.dependency_overrides[deps.get_current_user]=paused
            try:
                with ThreadPoolExecutor(1) as pool:
                    pending=pool.submit(request,a,'POST',f'/wallets/{a["wallet"]}/payments/create',body,uuid4().hex)
                    try:
                        expect(entered.wait(10),'initial payment auth not reached')
                        logged_out=client.post('/api/v1/auth/logout',json={'refresh_token':a['tokens']['refresh_token']})
                        expect(logged_out.status_code==204,f'logout HTTP {logged_out.status_code}')
                    finally:release.set()
                    reply=pending.result(timeout=20)
                expect(reply.status_code in {401,403},f'logged-out in-flight payment HTTP {reply.status_code}')
                expect(snapshot(a)['wallets'][a['wallet']]==100000 and snapshot(a)['entries']==0,'logged-out request debited wallet')
            finally:app.dependency_overrides.pop(deps.get_current_user,None)

        for iteration in range(args.repeats):
            for same_key in [True,False]:
                @case('5B-05',f'double invoice confirmation same_key={same_key} #{iteration+1}')
                def confirm_twice(same_key=same_key):
                    a=actor(); iid=invoice(a); first=uuid4().hex
                    keys=[first,first if same_key else uuid4().hex]
                    body={'expected_revision':1}
                    replies=race([lambda key=key:request(a,'POST',f'/bookkeeping/invoices/{iid}/confirm',body,key) for key in keys])
                    expect(all(r.status_code==201 for r in replies),f'statuses {[r.status_code for r in replies]}')
                    expect(replies[0].json()['transaction_id']==replies[1].json()['transaction_id'],'duplicate invoice record')
                    with sessions() as db:
                        expect(db.scalar(select(func.count()).select_from(Transaction).where(Transaction.invoice_id==iid))==1,'duplicate invoice expense')
                        expect(db.get(Invoice,iid).status=='CONFIRMED','confirmation state missing')
                    expect(snapshot(a)['wallets'][a['wallet']]==100000,'OCR bookkeeping changed wallet money')

            for confirm_other in [False,True]:
                @case('5B-06',f'stale revision competing edit/confirm={confirm_other} #{iteration+1}')
                def edit_stale(confirm_other=confirm_other):
                    a=actor(); iid=invoice(a)
                    bodies=[{'expected_revision':1,'items':[{'name':name,'quantity':'1','line_total':'50000'}]} for name in ['First','Second']]
                    one=lambda:request(a,'PUT',f'/invoices/{iid}/items',bodies[0])
                    two=(lambda:request(a,'POST',f'/bookkeeping/invoices/{iid}/confirm',{'expected_revision':1},uuid4().hex)) if confirm_other else (
                         lambda:request(a,'PUT',f'/invoices/{iid}/items',bodies[1]))
                    replies=race([one,two])
                    expect(sum(r.status_code==409 for r in replies)==1 and all(r.status_code in {200,201,409} for r in replies),f'statuses {[r.status_code for r in replies]}')
                    with sessions() as db:
                        row=db.get(Invoice,iid)
                        expect(row.revision==2,'stale change overwrote new revision')
                        count=db.scalar(select(func.count()).select_from(Transaction).where(Transaction.invoice_id==iid))
                        expect(count==(1 if replies[1].status_code==201 else 0),'conflicting confirm created extra record')
                        if replies[0].status_code==200:
                            expect(db.scalar(select(InvoiceItem.name).where(InvoiceItem.invoice_id==iid))=='First','winning edit was overwritten')

        for action in ['guard_edit_confirm','delete','delete_restore_confirm']:
            @case('5B-07',f'OCR result arrives after {action}')
            def late_ocr(action=action):
                from app.dung_chung.tac_vu_nen.hang_doi import enqueue
                a=actor(); key=uuid4().hex+'.jpg'; (Path(settings.upload_dir)/key).write_bytes(b'qa-image')
                iid=invoice(a,status='PROCESSING',storage_key=key); oid=uuid4()
                with sessions() as db:
                    db.add(OcrJob(id=oid,user_id=a['id'],invoice_id=iid,status='QUEUED')); db.flush()
                    job=enqueue(db,'OCR',{'invoice_id':str(iid),'user_id':str(a['id']),'ocr_job_id':str(oid),'invoice_revision':1},owner_user_id=a['id'])
                    jid=job.id; db.commit()
                entered,release=Event(),Event()
                async def fake(*p,**kw):
                    entered.set()
                    expect(await asyncio.to_thread(release.wait,15),'OCR fake not released')
                    return {'ten_nguoi_ban':'LATE OCR RESULT','tong_thanh_toan':'90000','items':[]}
                with patch('app.chuc_nang.nguoi_dung.hoa_don_ai.ha_tang.gemini.run_gemini_ocr',new=fake), ThreadPoolExecutor(1) as pool:
                    pending=pool.submit(worker.run_once,kinds={'OCR'})
                    try:
                        expect(entered.wait(10),'OCR did not reach external boundary')
                        if action=='guard_edit_confirm':
                            expect(request(a,'PUT',f'/invoices/{iid}/items',{'expected_revision':1,'items':[]}).status_code==409,'edit accepted during processing')
                            expect(request(a,'POST',f'/bookkeeping/invoices/{iid}/confirm',{'expected_revision':1},uuid4().hex).status_code==409,'confirm accepted during processing')
                        else:
                            expect(request(a,'DELETE',f'/invoices/{iid}').status_code==204,'delete while OCR failed')
                            if action=='delete_restore_confirm':
                                restored=ok(a,'POST',f'/invoices/{iid}/restore',{'expected_revision':2},uuid4().hex)
                                ok(a,'POST',f'/bookkeeping/invoices/{iid}/confirm',{'expected_revision':restored['revision']},uuid4().hex,status=201)
                    finally: release.set()
                    pending.result(timeout=20)
                with sessions() as db:
                    row=db.get(Invoice,iid)
                    if action=='guard_edit_confirm': expect(row.merchant_name=='LATE OCR RESULT' and row.status=='REVIEW_REQUIRED','normal OCR result missing')
                    else:
                        expect(row.merchant_name!='LATE OCR RESULT' and row.total_amount==50000,'stale OCR overwrote current data')
                        expect(bool(row.deleted_at)==(action=='delete'),'OCR resurrected/deleted the wrong invoice')
                        if action=='delete_restore_confirm': expect(row.status=='CONFIRMED','late OCR undid confirmation')
                    expect(db.get(BackgroundJob,jid).status=='DONE','stale OCR job not settled')

        for schedule in ['restore_first','purge_first',*['race']*args.repeats]:
            @case('5B-08',f'restore versus purge: {schedule}')
            def restore_purge(schedule=schedule):
                a=actor(); key=uuid4().hex+'.jpg'; file=Path(settings.upload_dir)/key; file.write_bytes(b'qa-image')
                iid=invoice(a,storage_key=key)
                expect(request(a,'DELETE',f'/invoices/{iid}').status_code==204,'fixture trash failed')
                restore=lambda:request(a,'POST',f'/invoices/{iid}/restore',{'expected_revision':2},uuid4().hex)
                purge=lambda:request(a,'POST','/invoices/batch-purge',{'invoice_ids':[str(iid)]})
                replies=race([restore,purge]) if schedule=='race' else ([restore(),purge()] if schedule=='restore_first' else [purge(),restore()])
                expect(sorted(r.status_code for r in replies) in [[200,409],[200,404]],f'statuses {[r.status_code for r in replies]}')
                with sessions() as db:
                    alive=db.get(Invoice,iid) is not None
                while worker.run_once(kinds={'FILE_DELETE'}): pass
                expect(file.exists()==alive,'file deleted despite successful restore or retained after purge')

        @case('5B-08','purging one invoice preserves a file referenced by another')
        def referenced_file():
            a=actor(); key=uuid4().hex+'.jpg'; file=Path(settings.upload_dir)/key; file.write_bytes(b'qa-shared')
            first,second=invoice(a,storage_key=key),invoice(a,storage_key=key)
            expect(request(a,'DELETE',f'/invoices/{first}').status_code==204,'trash failed')
            ok(a,'POST','/invoices/batch-purge',{'invoice_ids':[str(first)]})
            while worker.run_once(kinds={'FILE_DELETE'}): pass
            expect(file.exists(),'referenced file removed')
            stranger=actor()
            expect(request(stranger,'GET',f'/invoices/{second}/file').status_code==404,'foreign file readable')

        for iteration in range(args.repeats):
            @case('5B-08',f'expired trash retention sweep versus restore #{iteration+1}')
            def sweep_restore():
                from app.chuc_nang.nguoi_dung.hoa_don_ai.nghiep_vu.deletion import purge_expired_invoices
                a=actor(); key=uuid4().hex+'.jpg'; file=Path(settings.upload_dir)/key;file.write_bytes(b'qa-expired')
                iid=invoice(a,storage_key=key)
                with sessions() as db:
                    row=db.get(Invoice,iid);row.deleted_at=datetime.now(timezone.utc).replace(tzinfo=None)-timedelta(days=31);row.revision=2;db.commit()
                replies=race([lambda:request(a,'POST',f'/invoices/{iid}/restore',{'expected_revision':2},uuid4().hex),
                              lambda:purge_expired_invoices(sessions,user_id=a['id'])])
                expect(replies[0].status_code in {404,410} and replies[1]==1,'expired invoice restored or sweep failed')
                while worker.run_once(kinds={'FILE_DELETE'}):pass
                expect(not file.exists(),'expired file retained after sweep')

    if args.batch=='C':
        from app.dung_chung.http import phu_thuoc as deps
        from app.chuc_nang.quan_tri.nguoi_dung import api as admin_users
        def admin_race(functions,**kw):
            if hasattr(deps,'lock_admin_write'):
                return race(functions,sql_table='',sql_marker='capitalflow_admin_write')
            return race(functions,**kw)
        def business_audits(target):
            with sessions() as db:
                return db.scalars(select(AuditLog).where(AuditLog.entity_id==UUID(str(target)),
                           AuditLog.action.in_(['BAN_USER','UNBAN_USER','BULK_BAN_USER','BULK_UNBAN_USER','SUPPORT_CASE_CREATE','SUPPORT_CASE_RESOLVED','SUPPORT_CASE_ESCALATED']))
                           .order_by(AuditLog.id)).all()
        def user_state(owner):
            with sessions() as db:
                user=db.get(User,owner['id'])
                return (user.is_active,user.token_version,db.scalar(select(func.count()).select_from(RefreshToken).where(
                        RefreshToken.user_id==owner['id'],RefreshToken.revoked_at.is_not(None))),
                        snapshot(owner)['jobs'],len(business_audits(owner['id'])))
        def pause_after_auth(who, suffix, entered, release):
            def paused(request:Request,credentials=Depends(deps.security),db=Depends(deps.get_db)):
                current=deps.get_current_user(request,credentials,db)
                if current.id==who['id'] and request.url.path.endswith(suffix):
                    entered.set();expect(release.wait(15),'authorization test not released')
                return current
            return paused

        @case('5C-01','ban becomes effective before the protected payment check')
        def ban_before_payment():
            root,a=actor(role=UserRole.ADMIN,system=True),actor()
            body={'qr_payload':bill(a)['qr_payload']};entered,release=Event(),Event()
            app.dependency_overrides[deps.get_current_user]=pause_after_auth(a,'/payments/create',entered,release)
            try:
                with ThreadPoolExecutor(1) as pool:
                    pending=pool.submit(request,a,'POST',f'/wallets/{a["wallet"]}/payments/create',body,uuid4().hex)
                    try:
                        expect(entered.wait(10),'payment did not pass initial auth')
                        ok(root,'PATCH',f'/admin/users/{a["id"]}/ban')
                    finally:release.set()
                    reply=pending.result(timeout=20)
                expect(reply.status_code in {401,403},f'payment after ban HTTP {reply.status_code}')
                state=snapshot(a)
                expect(state['wallets'][a['wallet']]==100000 and state['entries']==0,'banned payment debited wallet')
            finally:app.dependency_overrides.pop(deps.get_current_user,None)

        @case('5C-01','payment accepted at protected check completes before a pending ban')
        def payment_before_ban():
            root,a=actor(role=UserRole.ADMIN,system=True),actor()
            body={'qr_payload':bill(a)['qr_payload']};entered,release,ban_attempt=Event(),Event(),Event()
            original_entry,original_target=wallet_api.entry,admin_users._locked_user
            def paused_entry(*p,**kw):
                entered.set();expect(release.wait(15),'payment not released')
                return original_entry(*p,**kw)
            def target(db,uid):
                if uid==a['id']:ban_attempt.set()
                return original_target(db,uid)
            with patch.object(wallet_api,'entry',new=paused_entry),patch.object(admin_users,'_locked_user',new=target),ThreadPoolExecutor(2) as pool:
                payment=pool.submit(request,a,'POST',f'/wallets/{a["wallet"]}/payments/create',body,uuid4().hex)
                try:
                    expect(entered.wait(10),'protected payment not reached')
                    ban=pool.submit(request,root,'PATCH',f'/admin/users/{a["id"]}/ban')
                    expect(ban_attempt.wait(10),'ban target lock not attempted')
                    expect(not ban.done(),'ban committed while protected payment held lock')
                finally:release.set()
                expect(payment.result(timeout=20).status_code==201 and ban.result(timeout=20).status_code==200,'accepted payment or ban failed')
            expect(snapshot(a)['wallets'][a['wallet']]==75000 and user_state(a)[0] is False,'accepted transaction lost or ban missing')

        for revocation in ['role','token_version','session_family']:
            @case('5C-02',f'{revocation} revocation after initial auth but before protected admin operation')
            def revoke_before_write(revocation=revocation):
                root,operator,target=actor(role=UserRole.ADMIN,system=True),actor(role=UserRole.ADMIN),actor()
                entered,release=Event(),Event()
                app.dependency_overrides[deps.get_current_user]=pause_after_auth(operator,'/ban',entered,release)
                try:
                    with ThreadPoolExecutor(1) as pool:
                        pending=pool.submit(request,operator,'PATCH',f'/admin/users/{target["id"]}/ban')
                        try:
                            expect(entered.wait(10),'admin did not pass initial auth')
                            # ADMIN accounts are protected against ban; use role revocation or session version revocation.
                            if revocation=='role':ok(root,'PATCH',f'/admin/users/{operator["id"]}/role',{'role':'USER'})
                            else:
                                from app.chuc_nang.nguoi_dung.dang_nhap.nghiep_vu.session_management import revoke_sessions,locked_user
                                with sessions() as db:
                                    user=locked_user(db,operator['id'])
                                    if revocation=='token_version':revoke_sessions(db,user,'qa_revoke')
                                    else:
                                        db.query(RefreshToken).filter(RefreshToken.user_id==user.id).update({'revoked_at':datetime.now(timezone.utc)},synchronize_session=False)
                                    db.commit()
                        finally:release.set()
                        reply=pending.result(timeout=20)
                    expect(reply.status_code in {401,403},f'stale admin authority accepted HTTP {reply.status_code}')
                    expect(user_state(target)[0] is True and not business_audits(target['id']),'revoked admin changed target')
                finally:app.dependency_overrides.pop(deps.get_current_user,None)

        @case('5C-02','support permission revoked after initial auth is rejected before case write')
        def support_revoked():
            root,operator=actor(role=UserRole.ADMIN,system=True),actor(role=UserRole.ADMIN,support=True)
            body={'email':f'case-{uuid4().hex}@example.com','issue':'LOCKED'}
            expect(client.post('/api/v1/support/account',json=body).status_code==202,'public support intake failed')
            with sessions() as db:
                cid=db.scalar(select(AccountSupportCase.id).where(AccountSupportCase.account_email==body['email']))
            entered,release=Event(),Event()
            app.dependency_overrides[deps.get_current_user]=pause_after_auth(operator,f'/{cid}',entered,release)
            try:
                with ThreadPoolExecutor(1) as pool:
                    pending=pool.submit(request,operator,'PATCH',f'/admin/support-cases/{cid}',{'status':'RESOLVED'})
                    try:
                        expect(entered.wait(10),'support auth pause missing')
                        ok(root,'PATCH',f'/admin/users/{operator["id"]}/role',{'role':'USER'})
                    finally:release.set()
                    reply=pending.result(timeout=20)
                expect(reply.status_code in {401,403},f'revoked support HTTP {reply.status_code}')
                expect(ok(root,'GET',f'/admin/support-cases/{cid}')['status']=='OPEN','revoked support changed case')
            finally:app.dependency_overrides.pop(deps.get_current_user,None)

        @case('5C-02','protected admin write completes before a later role revocation')
        def accepted_admin_write():
            root,operator,target=actor(role=UserRole.ADMIN,system=True),actor(role=UserRole.ADMIN),actor()
            entered,release,attempt=Event(),Event(),Event(); original=admin_users._locked_user
            def at_target(db,uid):
                if uid==target['id']:
                    entered.set();expect(release.wait(15),'accepted admin not released')
                return original(db,uid)
            def at_revoke(conn,cursor,statement,p,context,many):
                if entered.is_set() and 'capitalflow_admin_write' in statement:attempt.set()
            with patch.object(admin_users,'_locked_user',new=at_target),ThreadPoolExecutor(2) as pool:
                accepted=pool.submit(request,operator,'PATCH',f'/admin/users/{target["id"]}/ban')
                try:
                    expect(entered.wait(10),'protected target not reached')
                    event.listen(engine,'before_cursor_execute',at_revoke)
                    revoke=pool.submit(request,root,'PATCH',f'/admin/users/{operator["id"]}/role',{'role':'USER'})
                    if hasattr(deps,'lock_admin_write'):
                        expect(attempt.wait(10),'revocation gate not reached')
                        expect(not revoke.done(),'revoked before already-protected mutation completed')
                finally:
                    release.set()
                    if event.contains(engine,'before_cursor_execute',at_revoke):event.remove(engine,'before_cursor_execute',at_revoke)
                expect(accepted.result(timeout=20).status_code==200 and revoke.result(timeout=20).status_code==200,'serialized admin/revoke failed')
            expect(user_state(target)[0] is False,'accepted mutation disappeared')
            expect(request(operator,'GET','/admin/users').status_code in {401,403},'old admin session still accepted')

        @case('5C-02','busy admin write gate times out safely while reads remain available')
        def busy_admin_gate():
            if not hasattr(deps,'lock_admin_write'):return
            root,target=actor(role=UserRole.ADMIN,system=True),actor()
            with sessions() as blocker:
                blocker.execute(text("DECLARE @r INT; EXEC @r=sys.sp_getapplock @Resource='capitalflow_admin_write', @LockMode='Exclusive', @LockOwner='Transaction', @LockTimeout=0; SELECT @r;"))
                expect(request(root,'GET','/admin/users').status_code==200,'admin read blocked by write gate')
                reply=request(root,'PATCH',f'/admin/users/{target["id"]}/ban')
                expect(reply.status_code==503,f'busy gate HTTP {reply.status_code}')
                expect(user_state(target)[0] is True,'busy write changed target')
                blocker.rollback()
            ok(root,'PATCH',f'/admin/users/{target["id"]}/ban')

        for schedule in ['ban_first','unban_first',*['race']*args.repeats]:
            @case('5C-03',f'two admins ban/unban same account: {schedule}')
            def concurrent_admins(schedule=schedule):
                root,operator,target=actor(role=UserRole.ADMIN,system=True),actor(role=UserRole.ADMIN),actor()
                ban=lambda:request(root,'PATCH',f'/admin/users/{target["id"]}/ban')
                unban=lambda:request(operator,'PATCH',f'/admin/users/{target["id"]}/unban')
                replies=admin_race([ban,unban]) if schedule=='race' else ([ban(),unban()] if schedule=='ban_first' else [unban(),ban()])
                expect(all(r.status_code==200 for r in replies),f'statuses {[r.status_code for r in replies]}')
                audits=business_audits(target['id']);state=user_state(target)
                expect(1<=len(audits)<=2 and state[3]==len(audits),'state-change emails/audits duplicated or missing')
                expect(state[0]==(audits[-1].action=='UNBAN_USER'),'final state disagrees with final recorded change')
                listed=ok(root,'GET',f'/admin/users?search={target["email"]}')
                expect(listed['items'][0]['is_active']==state[0],'refreshed admin list has stale final state')

        @case('5C-04','overlapping bulk requests handle unique targets and mixed invalid/protected IDs')
        def bulk_overlap():
            root,operator=actor(role=UserRole.ADMIN,system=True),actor(role=UserRole.ADMIN)
            people=[actor() for _ in range(3)];missing=str(uuid4())
            ids=[[str(people[0]['id']),str(people[1]['id']),str(people[0]['id']),str(root['id']),missing],
                 [str(people[1]['id']),str(people[2]['id']),str(operator['id']),missing]]
            replies=admin_race([lambda admin=admin,items=items:request(admin,'POST','/admin/users/bulk-ban',{'user_ids':items,'reason':'QA bulk'})
                          for admin,items in zip([root,operator],ids)])
            expect(all(r.status_code==200 for r in replies),f'statuses {[r.status_code for r in replies]}')
            expect(sum(r.json()['banned_count'] for r in replies)==3,'bulk overlap changed users more than once')
            expect(all(user_state(p)[0] is False and user_state(p)[3:]==(1,1) for p in people),'bulk missing/duplicate effect')
            expect(user_state(root)[0] and user_state(operator)[0],'protected admin was banned')

        for issue in ['LOCKED','NO_EMAIL']:
            @case('5C-05',f'public submissions create the same open {issue} case concurrently')
            def support_duplicate(issue=issue):
                email=f'case-{uuid4().hex}@example.com'
                body={'email':email,'issue':issue,**({'contact_email':'contact@example.com'} if issue=='NO_EMAIL' else {})}
                replies=race([lambda:client.post('/api/v1/support/account',json=body),
                              lambda:client.post('/api/v1/support/account',json=body)],sql_table='account_support_cases',sql_marker='INSERT INTO')
                expect(all(r.status_code==202 for r in replies),f'statuses {[r.status_code for r in replies]}')
                with sessions() as db:
                    expect(db.scalar(select(func.count()).select_from(AccountSupportCase).where(AccountSupportCase.account_email==email))==1,'duplicate open support case')

            @case('5C-05',f'concurrent escalation/resolution cannot reopen {issue} case')
            def support_resolution(issue=issue):
                root,operator=actor(role=UserRole.ADMIN,system=True),actor(role=UserRole.ADMIN,support=True)
                body={'email':f'case-{uuid4().hex}@example.com','issue':issue,**({'contact_email':'contact@example.com'} if issue=='NO_EMAIL' else {})}
                expect(client.post('/api/v1/support/account',json=body).status_code==202,'public support intake failed')
                with sessions() as db:
                    cid=db.scalar(select(AccountSupportCase.id).where(AccountSupportCase.account_email==body['email']))
                replies=admin_race([lambda:request(root,'PATCH',f'/admin/support-cases/{cid}',{'status':'RESOLVED'}),
                              lambda:request(operator,'PATCH',f'/admin/support-cases/{cid}',{'status':'ESCALATED'})],sql_table='account_support_cases')
                expect(all(r.status_code in {200,409} for r in replies),f'statuses {[r.status_code for r in replies]}')
                final=ok(root,'GET',f'/admin/support-cases/{cid}')
                expect(final['status']=='RESOLVED','resolved case reopened by late update')
                repeated=request(operator,'PATCH',f'/admin/support-cases/{cid}',{'status':'ESCALATED'})
                expect(repeated.status_code==409,'restricted admin reopened resolved case')

        for point in ['audit','queue','commit']:
            @case('5C-06',f'admin mutation fails at {point} then retries safely')
            def admin_failure(point=point):
                root,target=actor(role=UserRole.ADMIN,system=True),actor()
                before=user_state(target);original_commit=Session.commit
                def failure(*p,**kw):raise RuntimeError('QA admin write failure')
                def fail_commit(db):
                    if any(isinstance(x,BackgroundJob) for x in db.new):raise RuntimeError('QA admin commit failure')
                    # enqueue flushes rows, so use the mutated target state, not Session.new.
                    if db.info.get('request') and db.info['request'].url.path.endswith('/ban') and not db.get(User,target['id']).is_active:raise RuntimeError('QA admin commit failure')
                    return original_commit(db)
                with ExitStack() as fault:
                    if point=='audit':fault.enter_context(patch.object(admin_users,'_write_audit',new=failure))
                    elif point=='queue':fault.enter_context(patch.object(admin_users,'enqueue_email',new=failure))
                    else:fault.enter_context(patch.object(Session,'commit',new=fail_commit))
                    reply=request(root,'PATCH',f'/admin/users/{target["id"]}/ban')
                expect(reply.status_code>=500,f'fault HTTP {reply.status_code}')
                expect(user_state(target)==before,'admin partial change survived failure')
                ok(root,'PATCH',f'/admin/users/{target["id"]}/ban')
                ok(root,'PATCH',f'/admin/users/{target["id"]}/ban')
                state=user_state(target)
                expect(state[0] is False and state[3:]==(1,1),'admin retry duplicated notification/audit')

        expanded=[]
        for group,name,function in tests:
            for iteration in range(args.repeats if group in {'5C-04','5C-05'} else 1):
                expanded.append((group,name+(f' #{iteration+1}' if group in {'5C-04','5C-05'} else ''),function))
        tests=expanded

    limiter.enabled=False
    try:
        with TemporaryDirectory(prefix='cf-fault-qa-') as files, ExitStack() as stack:
            stack.enter_context(patch.object(settings,'upload_dir',files))
            stack.enter_context(patch('smtplib.SMTP',side_effect=AssertionError('Real SMTP prohibited')))
            stack.enter_context(patch('smtplib.SMTP_SSL',side_effect=AssertionError('Real SMTP prohibited')))
            stack.enter_context(patch('fastapi_mail.FastMail.send_message',new_callable=AsyncMock,side_effect=AssertionError('Real SMTP prohibited')))
            stack.enter_context(patch('app.chuc_nang.nguoi_dung.hoa_don_ai.ha_tang.gemini._call_gemini_model',new_callable=AsyncMock,side_effect=AssertionError('Real Gemini prohibited')))
            client=stack.enter_context(TestClient(app,raise_server_exceptions=False))
            if args.gui:
                import uvicorn
                from starlette.responses import JSONResponse
                owner=actor(); state={'mode':'off','matched':0,'committed':0}
                server=None
                async def qa_app(scope,receive,send):
                    if scope['type']!='http':return await app(scope,receive,send)
                    path=scope['path'];method=scope['method']
                    if path=='/api/v1/__qa/fault':
                        if method=='POST':
                            payload=await Request(scope,receive).json(); mode=payload.get('mode')
                            if mode not in {'off','lose_payment_response','fail_read','delay_read'}:
                                return await JSONResponse({'detail':'Invalid QA mode'},422)(scope,receive,send)
                            state.update(mode=mode,matched=0,committed=0)
                        return await JSONResponse(state)(scope,receive,send)
                    if path=='/api/v1/__qa/status':
                        snap=snapshot(owner)
                        return await JSONResponse({'database':local_url(True).database,'balance':str(snap['wallets'][owner['wallet']]),
                                                   'entries':snap['entries'],'records':snap['records'],'fault':state})(scope,receive,send)
                    if path=='/api/v1/__qa/shutdown' and method=='POST':
                        server.should_exit=True
                        return await JSONResponse({'stopping':True})(scope,receive,send)
                    if path=='/api/v1/bookkeeping' and method=='GET' and state['mode'] in {'fail_read','delay_read'}:
                        state['matched']+=1
                        if state['mode']=='fail_read':return await JSONResponse({'detail':'Lỗi đọc giả lập trong DB QA'},503)(scope,receive,send)
                        await asyncio.sleep(2)
                    if path.endswith('/payments/create') and method=='POST' and state['mode']=='lose_payment_response':
                        messages=[]
                        async def capture(message):messages.append(message)
                        await app(scope,receive,capture)
                        status=next(m['status'] for m in messages if m['type']=='http.response.start')
                        state['matched']+=1
                        if status==201:
                            state['committed']+=1;state['mode']='off'
                            return await JSONResponse({'detail':'QA: mất phản hồi sau khi đã lưu thành công'},503)(scope,receive,send)
                        for message in messages:await send(message)
                        return
                    return await app(scope,receive,send)
                fixture={'database':local_url(True).database,'email':owner['email'],'password':password,'wallet_id':str(owner['wallet']),
                         'api':'http://127.0.0.1:8015','portal':'http://127.0.0.1:3015'}
                (OUT/'gui-session.json').write_text(json.dumps(fixture,ensure_ascii=False),encoding='utf-8')
                server=uvicorn.Server(uvicorn.Config(qa_app,host='127.0.0.1',port=8015,log_level='warning'))
                print('QA_GUI_READY',flush=True);server.run();return 0
            for group,name,function in tests:
                started=time.monotonic()
                try:
                    function()
                    results.append({'group':group,'case':name,'pass':True,'seconds':round(time.monotonic()-started,3)})
                except Exception as exc:
                    error=str(exc) if isinstance(exc,AssertionError) else type(exc).__name__
                    results.append({'group':group,'case':name,'pass':False,'error':error,'seconds':round(time.monotonic()-started,3)})
                print(json.dumps(results[-1],ensure_ascii=False),flush=True)
    finally:
        engine.dispose()
    result={'passed':sum(r['pass'] for r in results),'failed':sum(not r['pass'] for r in results),
            'repeats':args.repeats,'groups':sorted({r['group'] for r in results}),
            'sql_barrier_races':len(connection_proofs),'independent_connections_per_race':sorted(set(connection_proofs)), 'cases':results}
    print(json.dumps(result,ensure_ascii=False,indent=2))
    return 1 if result['failed'] or not results else 0


if __name__=='__main__':
    parser=argparse.ArgumentParser()
    parser.add_argument('--batch',choices=['A','B','C'],required=True)
    parser.add_argument('--label',default='final',choices=['baseline','final'])
    parser.add_argument('--repeats',type=int,default=10)
    parser.add_argument('--child',action='store_true')
    parser.add_argument('--gui',action='store_true')
    args=parser.parse_args()
    if not 1<=args.repeats<=10: parser.error('repeats must be 1..10')
    sys.exit(suite(args) if args.child else parent(args))
