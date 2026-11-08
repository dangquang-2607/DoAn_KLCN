"""Worker regression on a migrated disposable local SQL Server database.

Run: .venv/Scripts/python.exe -B tools/verify_worker.py --label baseline|final
No production queue is consumed. SMTP/Gemini are mocked; temporary files only.
"""
import argparse
import asyncio
import json
import os
from pathlib import Path
import re
import subprocess
import sys
import tempfile
import time
from datetime import datetime, timedelta, timezone
from concurrent.futures import ThreadPoolExecutor
from threading import Barrier, Event
from unittest.mock import AsyncMock, patch
from smtplib import SMTPConnectError, SMTPServerDisconnected, SMTPRecipientsRefused
from uuid import uuid4

import pyodbc
from cryptography.fernet import Fernet
from sqlalchemy import create_engine, delete, select, text
from sqlalchemy.engine import make_url

pyodbc.pooling = False
API = Path(__file__).resolve().parents[1]
ROOT = API.parent
OUT = ROOT / 'output/worker-qa'
sys.path.insert(0, str(API))
from app.dung_chung.config import settings


def local_url():
    url = make_url(settings.database_url)
    host = (url.host or '').lower().split('\\')[0].split(',')[0]
    assert settings.app_env == 'development' and url.get_backend_name() == 'mssql'
    assert host in {'localhost', '127.0.0.1', '.', '(local)'}
    assert not {'odbc_connect', 'dsn'} & url.query.keys()
    return url


def owned_database():
    url = local_url()
    assert re.fullmatch(r'cf_worker_qa_[a-f0-9]{12}', url.database or ''), 'Refusing non-QA database'
    return url


def parent(label):
    source = local_url()
    database = 'cf_worker_qa_' + uuid4().hex[:12]
    assert source.database != database
    OUT.mkdir(parents=True, exist_ok=True)
    env = {**os.environ, 'DATABASE_URL': source.set(database=database).render_as_string(hide_password=False),
           'APP_ENV': 'development', 'PYTHONIOENCODING': 'utf-8',
           'JOB_ENCRYPTION_KEY': Fernet.generate_key().decode(), 'JWT_SECRET_KEY': Fernet.generate_key().decode(),
           'SMTP_USER': '', 'SMTP_PASSWORD': '', 'GOOGLE_AI_API_KEY': ''}
    master = create_engine(source.set(database='master'), isolation_level='AUTOCOMMIT', hide_parameters=True)
    report = {'recorded_at': datetime.now(timezone(timedelta(hours=7))).isoformat(),
              'database': database, 'main_database_touched': False, 'removed': False}
    with master.connect() as db:
        assert db.scalar(text('SELECT DB_ID(:name)'), {'name': database}) is None
        db.exec_driver_sql(f'CREATE DATABASE [{database}]')
    try:
        with (OUT / f'{label}-migrations.log').open('w', encoding='utf-8') as log:
            subprocess.run([sys.executable, '-B', '-m', 'alembic', 'upgrade', 'head'],
                           cwd=ROOT/'capitalflow-database', env=env, stdout=log, stderr=subprocess.STDOUT, check=True)
        with (OUT / f'{label}-suite.log').open('w', encoding='utf-8') as log:
            result = subprocess.run([sys.executable, '-B', str(Path(__file__).resolve()), '--child'],
                                    cwd=API, env=env, stdout=log, stderr=subprocess.STDOUT)
        report['exit_code'] = result.returncode
        content = (OUT / f'{label}-suite.log').read_text(encoding='utf-8')
        start = list(re.finditer(r'^\{(?=\s*"passed")', content, re.M))
        if start:
            report.update(json.JSONDecoder().raw_decode(content[start[-1].start():])[0])
    finally:
        try:
            with master.connect() as db:
                assert re.fullmatch(r'cf_worker_qa_[a-f0-9]{12}', database)
                db.exec_driver_sql(f'ALTER DATABASE [{database}] SET SINGLE_USER WITH ROLLBACK IMMEDIATE')
                db.exec_driver_sql(f'DROP DATABASE [{database}]')
                report['removed'] = db.scalar(text('SELECT DB_ID(:name)'), {'name': database}) is None
        finally:
            master.dispose()
            (OUT / f'{label}-results.json').write_text(json.dumps(report, indent=2, ensure_ascii=False), encoding='utf-8')
    print(json.dumps({k:v for k,v in report.items() if k != 'cases'}, ensure_ascii=False))
    return report.get('exit_code', 1)


def hold_job(marker, sending=False):
    owned_database()
    from app.dung_chung.tac_vu_nen import trinh_chay as worker
    def block(*_):
        Path(marker).write_text('claimed', encoding='utf-8')
        time.sleep(30)
    if sending:
        config={'smtp_host':'smtp.example.invalid','smtp_port':587,'smtp_user':'qa',
                'smtp_password':'qa','smtp_tls':False,'smtp_ssl':False,
                'emails_from_email':'sender@example.invalid','emails_from_name':'QA'}
        with patch('app.dung_chung.email.dich_vu._get_effective_smtp',return_value=config), patch('smtplib.SMTP') as smtp:
            smtp.return_value.__enter__.return_value.sendmail.side_effect=block
            worker.run_once(kinds={'EMAIL'})
    else:
        with patch.object(worker, 'dispatch', side_effect=block):
            worker.run_once(kinds={'EMAIL'})


def suite():
    owned_database()
    from app.dung_chung.database.session import SessionLocal as sessions
    from app.dung_chung.database.ket_noi import engine
    from app.dung_chung.tac_vu_nen import trinh_chay as worker
    from app.dung_chung.tac_vu_nen.hang_doi import enqueue, claim, now
    from app.dung_chung.tac_vu_nen.luu_tru.tac_vu_nen import BackgroundJob
    from app.dung_chung.email.dich_vu import EmailService, EmailDeliveryUncertain
    from app.dung_chung.email.luu_tru.nhat_ky_email import EmailLog
    from app.chuc_nang.nguoi_dung.dang_nhap.luu_tru.nguoi_dung import User
    from app.chuc_nang.nguoi_dung.hoa_don_ai.luu_tru.invoice import Invoice
    from app.chuc_nang.nguoi_dung.hoa_don_ai.luu_tru.tac_vu_ocr import OcrJob
    from app.chuc_nang.nguoi_dung.tai_chinh.giao_dich.luu_tru.giao_dich import Transaction
    from app.chuc_nang.nguoi_dung.tai_chinh.ngan_sach.ky_han import today_vn
    from fastapi import HTTPException
    owner = uuid4()
    with sessions() as db:
        db.add(User(id=owner, email='worker@example.invalid', full_name='Worker QA', password_hash='unused-QA-password'))
        db.commit()
    results = []
    tests = []
    def case(group, name):
        def register(function):
            tests.append((group, name, function))
            return function
        return register
    def job(kind='EMAIL', payload=None, key=None):
        payload = payload if payload is not None else {'function':'send_test_email', 'args':['worker@example.invalid'], 'kwargs':{}}
        with sessions() as db:
            row = enqueue(db, kind, payload, key, owner_user_id=owner)
            db.commit()
            return row.id
    def state(jid):
        with sessions() as db:
            row = db.get(BackgroundJob, jid)
            return {key:getattr(row, key) for key in ['status','attempts','payload','lease_until','lease_token','available_at','error_code']}
    def ready(jid, **changes):
        with sessions() as db:
            row = db.get(BackgroundJob, jid)
            row.available_at = now() - timedelta(seconds=1)
            for key, value in changes.items(): setattr(row, key, value)
            db.commit()
    def ocr_fixture():
        iid, oid = uuid4(), uuid4()
        key = str(iid) + '.jpg'
        (Path(settings.upload_dir)/key).write_bytes(b'qa-image')
        with sessions() as db:
            db.add(Invoice(id=iid, user_id=owner, status='PROCESSING', revision=1,
                           storage_key=key, mime_type='image/jpeg', total_amount=10))
            db.flush()
            db.add(OcrJob(id=oid, user_id=owner, invoice_id=iid, status='QUEUED'))
            db.commit()
        payload = {'invoice_id':str(iid), 'user_id':str(owner), 'ocr_job_id':str(oid), 'invoice_revision':1}
        return iid, oid, payload
    response = {'ten_nguoi_ban':'Worker QA', 'tong_thanh_toan':'1000', 'items':[]}

    @case('queue', 'Payload is encrypted and dedupe key creates one job')
    def _():
        jid = job(key='same-key')
        assert job(key='same-key') == jid
        assert 'worker@example.invalid' not in state(jid)['payload']

    @case('queue', 'Outbox enqueue rolls back with its transaction')
    def _():
        with sessions() as db:
            jid = enqueue(db, 'EMAIL', {'private':'qa'}).id
            db.rollback()
        with sessions() as db: assert db.get(BackgroundJob, jid) is None

    @case('queue', 'Queue capacity rejects another job without losing the first')
    def _():
        with patch.object(settings, 'worker_queue_limit', 1):
            jid = job()
            try: job()
            except HTTPException as exc: assert exc.status_code == 503
            else: raise AssertionError('Expected full queue')
            assert state(jid)['status'] == 'PENDING'

    @case('claim', 'Future work is not claimed before its due time')
    def _():
        jid = job(); ready(jid, available_at=now()+timedelta(minutes=1))
        with sessions() as db: assert claim(db) is None

    @case('claim', 'Separate worker lanes do not consume other job types')
    def _():
        job('BUDGET', {'transaction_id':str(uuid4()), 'user_id':str(owner)})
        with sessions() as db: assert claim(db, kinds={'EMAIL'}) is None

    @case('claim', 'Two SQL Server consumers claim a pending job only once')
    def _():
        jid = job(); gate = Barrier(2, timeout=10)
        def take():
            gate.wait()
            with sessions() as db: return claim(db, kinds={'EMAIL'})
        with ThreadPoolExecutor(max_workers=2) as pool: work = list(pool.map(lambda _:take(), range(2)))
        assert sum(item is not None for item in work) == 1
        assert next(item for item in work if item)[0] == jid

    @case('claim', 'An unexpired running job cannot be claimed again')
    def _():
        job()
        with sessions() as db: assert claim(db)
        with sessions() as db: assert claim(db) is None

    @case('lease', 'Expired lease is replaced and the old owner loses write rights')
    def _():
        jid = job()
        with sessions() as db: old = claim(db)
        ready(jid, lease_until=now()-timedelta(seconds=1))
        with sessions() as db: new = claim(db)
        assert new[1] != old[1] and state(jid)['attempts'] == 2
        with sessions() as db: assert worker.owns(db, jid, old[1]) is None

    @case('retry', 'Successful email is completed once and its payload is erased')
    def _():
        jid = job()
        with patch.object(EmailService, 'send_test_email', return_value=True) as send:
            assert worker.run_once(sessions, {'EMAIL'})
            assert not worker.run_once(sessions, {'EMAIL'})
            assert send.call_count == 1
        row = state(jid)
        assert row['status']=='DONE' and row['payload']=='' and row['lease_token'] is None

    @case('retry', 'Email failures back off and stop at three attempts')
    def _():
        jid = job()
        with patch.object(EmailService, 'send_test_email', return_value=False) as send:
            for attempt in range(1,4):
                assert worker.run_once(sessions, {'EMAIL'})
                row = state(jid)
                assert row['attempts']==attempt and row['status']==('DEAD' if attempt==3 else 'PENDING')
                assert row['lease_token'] is None and row['error_code']=='RuntimeError'
                if attempt<3:
                    remaining=(row['available_at']-now()).total_seconds()
                    assert 10*2**attempt-3 < remaining <= 10*2**attempt+1
                    ready(jid)
            assert not worker.run_once(sessions, {'EMAIL'}) and send.call_count==3

    @case('retry', 'Corrupt encrypted OCR payload reaches DEAD without crashing')
    def _():
        jid=job('OCR', {}); ready(jid, payload='not-fernet')
        for _ in range(3): worker.run_once(sessions, {'OCR'}); ready(jid)
        assert state(jid)['status']=='DEAD'

    @case('retry', 'OCR payload missing identifiers reaches DEAD instead of staying RUNNING')
    def _():
        jid=job('OCR', {})
        for _ in range(3): worker.run_once(sessions, {'OCR'}); ready(jid)
        assert state(jid)['status']=='DEAD'

    @case('retry', 'Invalid OCR UUID reaches DEAD instead of breaking failure handling')
    def _():
        jid=job('OCR', {'invoice_id':'bad-id', 'user_id':'bad-id', 'ocr_job_id':'bad-id'})
        for _ in range(3): worker.run_once(sessions, {'OCR'}); ready(jid)
        assert state(jid)['status']=='DEAD'

    smtp_config={'smtp_host':'smtp.example.invalid','smtp_port':587,'smtp_user':'qa-sender',
                 'smtp_password':'qa-password','smtp_tls':True,'smtp_ssl':False,
                 'emails_from_email':'sender@example.invalid','emails_from_name':'Worker QA'}

    @case('email', 'SMTP acceptance is recorded as SENT instead of failing in logging')
    def _():
        with patch('app.dung_chung.email.dich_vu._get_effective_smtp',return_value=smtp_config), \
             patch('smtplib.SMTP') as smtp, patch.object(EmailService,'_log_delivery') as log:
            smtp.return_value.__enter__.return_value.sendmail.return_value={}
            assert EmailService.send_email_sync('worker@example.invalid','QA','<p>QA</p>','TEST_EMAIL')
            assert smtp.return_value.__enter__.return_value.sendmail.call_count==1
            assert log.call_args.args[3]=='SENT'

    @case('email', 'Implicit-TLS SMTP acceptance also returns success')
    def _():
        with patch('app.dung_chung.email.dich_vu._get_effective_smtp',return_value={**smtp_config,'smtp_ssl':True,'smtp_port':465}), \
             patch('smtplib.SMTP_SSL') as smtp, patch.object(EmailService,'_log_delivery') as log:
            smtp.return_value.__enter__.return_value.sendmail.return_value={}
            assert EmailService.send_email_sync('worker@example.invalid','QA','<p>QA</p>','TEST_EMAIL')
            assert log.call_args.args[3]=='SENT'

    @case('email', 'A connection failure returns a controlled failure and safe error code')
    def _():
        with patch('app.dung_chung.email.dich_vu._get_effective_smtp',return_value=smtp_config), \
             patch('smtplib.SMTP',side_effect=SMTPConnectError(421,b'QA unavailable')), \
             patch.object(EmailService,'_log_delivery') as log:
            assert not EmailService.send_email_sync('worker@example.invalid','QA','<p>QA</p>','TEST_EMAIL')
            assert log.call_args.args[3:5]==('FAILED','SMTPConnectError')

    @case('email', 'A QUIT failure after SMTP acceptance must not cause another send')
    def _():
        with patch('app.dung_chung.email.dich_vu._get_effective_smtp',return_value=smtp_config), \
             patch('smtplib.SMTP') as smtp, patch.object(EmailService,'_log_delivery') as log:
            smtp.return_value.__enter__.return_value.sendmail.return_value={}
            smtp.return_value.__exit__.side_effect=SMTPServerDisconnected('QA close failed')
            assert EmailService.send_email_sync('worker@example.invalid','QA','<p>QA</p>','TEST_EMAIL')
            assert log.call_args.args[3]=='SENT'

    @case('email', 'Real EMAIL dispatch with mocked SMTP stores SENT and finishes the job once')
    def _():
        from app.dung_chung.email.luu_tru.nhat_ky_email import EmailLog
        jid=job()
        with patch('app.dung_chung.email.dich_vu._get_effective_smtp',return_value=smtp_config), patch('smtplib.SMTP') as smtp:
            smtp.return_value.__enter__.return_value.sendmail.return_value={}
            worker.run_once(sessions,{'EMAIL'})
            assert not worker.run_once(sessions,{'EMAIL'})
            assert smtp.return_value.__enter__.return_value.sendmail.call_count==1
        assert state(jid)['status']=='DONE'
        with sessions() as db:
            assert db.scalar(select(EmailLog).where(EmailLog.status=='SENT')) is not None

    @case('delivery', 'Recovery skips SMTP when the same job already has a SENT record')
    def _():
        jid=job()
        with sessions() as db: claim(db,{'EMAIL'})
        with patch('app.dung_chung.email.dich_vu._get_effective_smtp',return_value=smtp_config), patch('smtplib.SMTP') as smtp:
            smtp.return_value.__enter__.return_value.sendmail.return_value={}
            with EmailService.delivery_job(jid): assert EmailService.send_test_email('worker@example.invalid')
            ready(jid,lease_until=now()-timedelta(seconds=1))
            worker.run_once(sessions,{'EMAIL'})
            assert smtp.return_value.__enter__.return_value.sendmail.call_count==1
        assert state(jid)['status']=='DONE'

    @case('delivery', 'A definitely unsent connection failure is retryable and uses one delivery record')
    def _():
        jid=job()
        with patch('app.dung_chung.email.dich_vu._get_effective_smtp',return_value=smtp_config), patch('smtplib.SMTP',side_effect=SMTPConnectError(421,b'QA')) as smtp:
            for _ in range(3): worker.run_once(sessions,{'EMAIL'}); ready(jid)
            assert smtp.call_count==3
        assert state(jid)['status']=='DEAD'
        with sessions() as db: assert db.get(EmailLog,jid).status=='FAILED'

    @case('delivery', 'An explicit recipient refusal remains retryable instead of UNKNOWN')
    def _():
        jid=job()
        with patch('app.dung_chung.email.dich_vu._get_effective_smtp',return_value=smtp_config), patch('smtplib.SMTP') as smtp:
            smtp.return_value.__enter__.return_value.sendmail.side_effect=SMTPRecipientsRefused({'worker@example.invalid':(450,b'QA refused')})
            worker.run_once(sessions,{'EMAIL'})
        assert state(jid)['status']=='PENDING'
        with sessions() as db: assert db.get(EmailLog,jid).status=='FAILED'

    @case('delivery', 'An ambiguous send timeout becomes UNKNOWN and stops automatic retry')
    def _():
        jid=job()
        with patch('app.dung_chung.email.dich_vu._get_effective_smtp',return_value=smtp_config), patch('smtplib.SMTP') as smtp:
            smtp.return_value.__enter__.return_value.sendmail.side_effect=TimeoutError('qa-private-message')
            worker.run_once(sessions,{'EMAIL'})
            assert not worker.run_once(sessions,{'EMAIL'})
            assert smtp.return_value.__enter__.return_value.sendmail.call_count==1
        assert state(jid)['status']=='DEAD' and state(jid)['attempts']==1
        with sessions() as db:
            row=db.get(EmailLog,jid)
            assert row.status=='UNKNOWN' and row.error_message=='DELIVERY_UNCONFIRMED'

    @case('delivery', 'A direct non-worker caller keeps its boolean failure contract')
    def _():
        with patch('app.dung_chung.email.dich_vu._get_effective_smtp',return_value=smtp_config), patch('smtplib.SMTP') as smtp, patch.object(EmailService,'_log_delivery') as log:
            smtp.return_value.__enter__.return_value.sendmail.side_effect=TimeoutError('QA timeout')
            assert EmailService.send_email_sync('worker@example.invalid','QA','<p>QA</p>','TEST_EMAIL') is False
            assert log.call_args.args[3]=='UNKNOWN'

    @case('delivery', 'Recovery of an interrupted SENDING record never retransmits automatically')
    def _():
        jid=job()
        with EmailService.delivery_job(jid): EmailService._prepare_job_delivery('worker@example.invalid','QA','TEST_EMAIL')
        # Match the real test-email subject; only the interrupted state is synthesized.
        with sessions() as db:
            row=db.get(EmailLog,jid); row.subject='🧪 Kiểm thử Kết nối Email CapitalFlow'; db.commit()
        with patch('smtplib.SMTP') as smtp:
            worker.run_once(sessions,{'EMAIL'}); assert not smtp.called
        assert state(jid)['status']=='DEAD'
        with sessions() as db: assert db.get(EmailLog,jid).status=='UNKNOWN'

    @case('delivery', 'Concurrent delivery preparation permits only one SMTP transmission')
    def _():
        jid=job(); entered=Event(); release=Event()
        def send(*_):
            entered.set(); assert release.wait(8); return {}
        def deliver():
            with EmailService.delivery_job(jid):
                return EmailService.send_email_sync('worker@example.invalid','Concurrent QA','<p>QA</p>','TEST_EMAIL')
        with patch('app.dung_chung.email.dich_vu._get_effective_smtp',return_value=smtp_config), patch('smtplib.SMTP') as smtp:
            smtp.return_value.__enter__.return_value.sendmail.side_effect=send
            with ThreadPoolExecutor(max_workers=2) as pool:
                first=pool.submit(deliver)
                try:
                    assert entered.wait(8)
                    second=pool.submit(deliver)
                    try: second.result(timeout=8)
                    except EmailDeliveryUncertain: pass
                    else: raise AssertionError('Duplicate sender was not stopped')
                finally: release.set()
                assert first.result(timeout=8)
            assert smtp.return_value.__enter__.return_value.sendmail.call_count==1
        with sessions() as db: assert db.get(EmailLog,jid).status=='SENT'

    @case('delivery', 'No SMTP call is made when the durable sending fence cannot be saved')
    def _():
        jid=job()
        with patch('app.dung_chung.email.dich_vu.SessionLocal',side_effect=RuntimeError('QA DB unavailable')), patch('smtplib.SMTP') as smtp:
            worker.run_once(sessions,{'EMAIL'}); assert not smtp.called
        assert state(jid)['status']=='PENDING'

    @case('delivery', 'Failure to persist an accepted result does not cause another transmission')
    def _():
        jid=job()
        with patch('app.dung_chung.email.dich_vu._get_effective_smtp',return_value=smtp_config), patch('smtplib.SMTP') as smtp, patch.object(EmailService,'_log_delivery',return_value=False):
            smtp.return_value.__enter__.return_value.sendmail.return_value={}
            worker.run_once(sessions,{'EMAIL'})
            assert not worker.run_once(sessions,{'EMAIL'})
            assert smtp.return_value.__enter__.return_value.sendmail.call_count==1
        assert state(jid)['status']=='DEAD'
        with sessions() as db: assert db.get(EmailLog,jid).status=='UNKNOWN'

    @case('delivery', 'A completed preview reuses its job record instead of writing another preview')
    def _():
        jid=job()
        with sessions() as db: claim(db,{'EMAIL'})
        with patch('app.dung_chung.email.dich_vu._get_effective_smtp',return_value={**smtp_config,'smtp_user':'','smtp_password':''}):
            with EmailService.delivery_job(jid): assert EmailService.send_test_email('worker@example.invalid')
            ready(jid,lease_until=now()-timedelta(seconds=1))
            with patch.object(EmailService,'_save_preview_html',side_effect=AssertionError('No second preview')):
                worker.run_once(sessions,{'EMAIL'})
        assert state(jid)['status']=='DONE'
        with sessions() as db: assert db.get(EmailLog,jid).status=='LOGGED_DEV'

    @case('delivery', 'A confirmed SENT result is not downgraded by a late error record')
    def _():
        jid=job()
        with EmailService.delivery_job(jid):
            assert EmailService._log_delivery('worker@example.invalid','QA','TEST_EMAIL','SENT')
            assert EmailService._log_delivery('worker@example.invalid','QA','TEST_EMAIL','UNKNOWN','DELIVERY_UNCONFIRMED')
        with sessions() as db: assert db.get(EmailLog,jid).status=='SENT'

    @case('delivery', 'Admin email filtering and summary expose UNKNOWN as needing attention')
    def _():
        from app.chuc_nang.quan_tri.email_cau_hinh.api import get_email_logs
        with sessions() as db:
            db.add(EmailLog(id=uuid4(),recipient='worker@example.invalid',subject='QA unknown',email_type='TEST_EMAIL',status='UNKNOWN',error_message='DELIVERY_UNCONFIRMED'))
            db.commit()
            data=get_email_logs(page=1,page_size=100,email_type=None,status='UNKNOWN',search=None,db=db,admin=None)
        assert data['total']>0 and all(row['status']=='UNKNOWN' for row in data['items'])
        assert data['summary']['unknown']==data['total'] and data['summary']['needs_attention']==data['total']
        assert data['summary']['sent']==0 and data['summary']['failed']==0

    @case('ocr', 'OCR saves a complete result without holding a DB connection during AI')
    def _():
        iid, oid, payload=ocr_fixture(); jid=job('OCR', payload)
        async def provider(*_):
            assert engine.pool.checkedout()==0
            return response
        with patch('app.chuc_nang.nguoi_dung.hoa_don_ai.ha_tang.gemini.run_gemini_ocr', side_effect=provider):
            worker.run_once(sessions, {'OCR'})
        with sessions() as db:
            invoice, ocr=db.get(Invoice,iid),db.get(OcrJob,oid)
            assert invoice.status=='REVIEW_REQUIRED' and invoice.revision==2
            assert ocr.status=='COMPLETED' and ocr.progress_percent==100
        assert state(jid)['status']=='DONE'

    @case('ocr', 'Invalid OCR result rolls back partial invoice updates')
    def _():
        iid, oid, payload=ocr_fixture(); job('OCR',payload)
        bad={**response, 'items':['invalid-line']}
        with patch('app.chuc_nang.nguoi_dung.hoa_don_ai.ha_tang.gemini.run_gemini_ocr', new=AsyncMock(return_value=bad)):
            worker.run_once(sessions, {'OCR'})
        with sessions() as db:
            invoice=db.get(Invoice,iid)
            assert invoice.status=='PROCESSING' and invoice.total_amount==10 and invoice.revision==1

    @case('ocr', 'OCR timeout cancels the provider and ends in FAILED after retry limit')
    def _():
        iid, oid, payload=ocr_fixture(); jid=job('OCR',payload)
        deadlines=[]; cancelled=[]; wait_for=asyncio.wait_for
        async def provider(*_):
            try: await asyncio.sleep(5)
            finally: cancelled.append(True)
        async def short_wait(awaitable, timeout):
            deadlines.append(timeout)
            return await wait_for(awaitable, timeout=.02)
        with patch('app.chuc_nang.nguoi_dung.hoa_don_ai.ha_tang.gemini.run_gemini_ocr', side_effect=provider), patch.object(worker.asyncio, 'wait_for', side_effect=short_wait):
            for _ in range(3): worker.run_once(sessions, {'OCR'}); ready(jid)
        assert deadlines==[90,90,90] and len(cancelled)==3
        assert state(jid)['status']=='DEAD'
        with sessions() as db:
            assert db.get(Invoice,iid).status=='FAILED' and db.get(OcrJob,oid).status=='FAILED'

    @case('ocr', 'An old lease must not start another AI request')
    def _():
        iid, oid, payload=ocr_fixture(); jid=job('OCR',payload)
        with sessions() as db: old=claim(db)
        ready(jid, lease_until=now()-timedelta(seconds=1))
        with sessions() as db: claim(db)
        with patch('app.chuc_nang.nguoi_dung.hoa_don_ai.ha_tang.gemini.run_gemini_ocr', new=AsyncMock(return_value=response)) as provider:
            worker.process_ocr(jid,old[1],payload,sessions)
            assert provider.call_count==0

    @case('ocr', 'Losing the lease during AI prevents stale result writes')
    def _():
        iid, oid, payload=ocr_fixture(); jid=job('OCR',payload)
        async def provider(*_):
            ready(jid, lease_token=uuid4())
            return response
        with patch('app.chuc_nang.nguoi_dung.hoa_don_ai.ha_tang.gemini.run_gemini_ocr', side_effect=provider):
            worker.run_once(sessions, {'OCR'})
        with sessions() as db:
            assert db.get(Invoice,iid).revision==1 and db.get(OcrJob,oid).status!='COMPLETED'

    @case('ocr', 'An outdated invoice revision does not run AI')
    def _():
        iid, oid, payload=ocr_fixture(); job('OCR',{**payload,'invoice_revision':0})
        with patch('app.chuc_nang.nguoi_dung.hoa_don_ai.ha_tang.gemini.run_gemini_ocr', new=AsyncMock(return_value=response)) as provider:
            worker.run_once(sessions, {'OCR'}); assert provider.call_count==0

    @case('ocr', 'An OCR row from a different invoice is not read or overwritten')
    def _():
        iid, oid, payload=ocr_fixture(); _, other_oid, _=ocr_fixture()
        job('OCR',{**payload,'ocr_job_id':str(other_oid)})
        with patch('app.chuc_nang.nguoi_dung.hoa_don_ai.ha_tang.gemini.run_gemini_ocr', new=AsyncMock(return_value=response)) as provider:
            worker.run_once(sessions, {'OCR'}); assert provider.call_count==0
        with sessions() as db:
            assert db.get(Invoice,iid).revision==1 and db.get(OcrJob,other_oid).status=='QUEUED'

    @case('ocr', 'A cancelled OCR attempt never calls the provider after restoration')
    def _():
        iid, oid, payload=ocr_fixture()
        with sessions() as db:
            db.get(OcrJob,oid).status='CANCELLED'; db.commit()
        jid=job('OCR',payload)
        with patch('app.chuc_nang.nguoi_dung.hoa_don_ai.ha_tang.gemini.run_gemini_ocr', new=AsyncMock(return_value=response)) as provider:
            worker.run_once(sessions, {'OCR'}); assert provider.await_count==0
        with sessions() as db:
            assert db.get(Invoice,iid).revision==1 and db.get(OcrJob,oid).status=='CANCELLED'
        assert state(jid)['status']=='DONE'

    @case('ocr', 'Cancellation during AI prevents a versionless legacy result from saving')
    def _():
        iid, oid, payload=ocr_fixture(); payload.pop('invoice_revision',None)
        jid=job('OCR',payload)
        async def provider(*_):
            with sessions() as db:
                db.get(OcrJob,oid).status='CANCELLED'; db.commit()
            return response
        with patch('app.chuc_nang.nguoi_dung.hoa_don_ai.ha_tang.gemini.run_gemini_ocr', side_effect=provider):
            worker.run_once(sessions, {'OCR'})
        with sessions() as db:
            assert db.get(Invoice,iid).revision==1 and db.get(OcrJob,oid).status=='CANCELLED'
        assert state(jid)['status']=='DONE'

    @case('recovery', 'Killing a real worker process allows lease-based recovery')
    def _():
        jid=job()
        with tempfile.TemporaryDirectory(prefix='cf-worker-kill-') as temp:
            marker=Path(temp)/'claimed'
            child=subprocess.Popen([sys.executable,'-B',str(Path(__file__).resolve()),'--hold-job',str(marker)],
                cwd=API, env=os.environ.copy(), stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
                creationflags=getattr(subprocess,'CREATE_NO_WINDOW',0))
            try:
                end=time.monotonic()+12
                while not marker.exists() and time.monotonic()<end:
                    assert child.poll() is None, 'Holding process exited too soon'
                    time.sleep(.05)
                assert marker.exists(), 'Worker did not claim job'
                assert state(jid)['status']=='RUNNING'
            finally:
                if child.poll() is None: child.terminate()
                child.wait(timeout=10)
        ready(jid,lease_until=now()-timedelta(seconds=1))
        with patch.object(EmailService,'send_test_email',return_value=True): worker.run_once(sessions,{'EMAIL'})
        assert state(jid)['status']=='DONE' and state(jid)['attempts']==2

    @case('files', 'An unreferenced temporary file is deleted safely')
    def _():
        file=Path(settings.upload_dir)/'orphan.jpg'; file.write_bytes(b'qa')
        jid=job('FILE_DELETE',{'storage_key':file.name})
        worker.run_once(sessions,{'FILE_DELETE'})
        assert not file.exists() and state(jid)['status']=='DONE'

    @case('recovery', 'Killing a process during SMTP leaves UNKNOWN on recovery with no new send')
    def _():
        jid=job()
        with tempfile.TemporaryDirectory(prefix='cf-worker-email-kill-') as temp:
            marker=Path(temp)/'sending'
            child=subprocess.Popen([sys.executable,'-B',str(Path(__file__).resolve()),'--hold-job',str(marker),'--hold-email-send'],
                cwd=API,env=os.environ.copy(),stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL,
                creationflags=getattr(subprocess,'CREATE_NO_WINDOW',0))
            try:
                end=time.monotonic()+12
                while not marker.exists() and time.monotonic()<end:
                    assert child.poll() is None; time.sleep(.05)
                assert marker.exists()
                with sessions() as db: assert db.get(EmailLog,jid).status=='SENDING'
            finally:
                if child.poll() is None: child.terminate()
                child.wait(timeout=10)
        ready(jid,lease_until=now()-timedelta(seconds=1))
        with patch('smtplib.SMTP') as smtp:
            worker.run_once(sessions,{'EMAIL'}); assert not smtp.called
        assert state(jid)['status']=='DEAD'
        with sessions() as db: assert db.get(EmailLog,jid).status=='UNKNOWN'

    @case('files', 'A file still referenced by an invoice is preserved')
    def _():
        iid, _, _=ocr_fixture()
        with sessions() as db: key=db.get(Invoice,iid).storage_key
        job('FILE_DELETE',{'storage_key':key}); worker.run_once(sessions,{'FILE_DELETE'})
        assert (Path(settings.upload_dir)/key).exists()

    @case('files', 'Storage keys cannot escape the configured upload directory')
    def _():
        jid=job('FILE_DELETE',{'storage_key':'../outside-worker-qa'})
        worker.run_once(sessions,{'FILE_DELETE'})
        assert state(jid)['status']=='PENDING' and state(jid)['error_code']=='ValueError'

    @case('budget', 'Future expense work is deferred without exhausting retry count')
    def _():
        tid=uuid4(); future=today_vn()+timedelta(days=1)
        with sessions() as db:
            db.add(Transaction(id=tid,user_id=owner,type='EXPENSE',amount=-1000,transaction_date=future))
            db.commit()
        jid=job('BUDGET',{'transaction_id':str(tid),'user_id':str(owner)})
        worker.run_once(sessions,{'BUDGET'})
        row=state(jid)
        assert row['status']=='PENDING' and row['attempts']==0 and row['available_at']>now()

    @case('budget', 'An already removed transaction completes without another side effect')
    def _():
        jid=job('BUDGET',{'transaction_id':str(uuid4()),'user_id':str(owner)})
        worker.run_once(sessions,{'BUDGET'}); assert state(jid)['status']=='DONE'

    @case('loop', 'A failed polling cycle backs off and then continues')
    def _():
        with patch.object(worker,'run_once',side_effect=[RuntimeError('qa-db-unavailable'),False,KeyboardInterrupt]), patch.object(worker.time,'sleep') as sleep:
            worker.main(['--kinds','EMAIL'])
        assert [call.args[0] for call in sleep.call_args_list]==[5,1]

    @case('loop', 'Unknown worker lanes are rejected before processing jobs')
    def _():
        with patch.object(worker,'run_once') as run:
            try: worker.main(['--kinds','UNSUPPORTED_QA'])
            except SystemExit as exc: assert exc.code==2
            else: raise AssertionError('CLI accepted an unknown lane')
            assert not run.called

    with tempfile.TemporaryDirectory(prefix='cf-worker-files-') as files, \
         patch.object(settings,'upload_dir',files), \
         patch('smtplib.SMTP',side_effect=AssertionError('External SMTP prohibited')), \
         patch('smtplib.SMTP_SSL',side_effect=AssertionError('External SMTP prohibited')):
        for group, name, function in tests:
            with sessions() as db: db.execute(delete(BackgroundJob)); db.commit()
            try:
                function()
                results.append({'group':group,'case':name,'passed':True})
            except Exception as exc:
                results.append({'group':group,'case':name,'passed':False,'error_type':type(exc).__name__})
    report={'passed':sum(row['passed'] for row in results),'failed':sum(not row['passed'] for row in results),
            'real_email_calls':0,'real_gemini_calls':0,'timeout_test':'observes 90-second configuration; accelerates cancellation to 20ms',
            'recovery_test':'terminates only a QA child process, then simulates lease expiry', 'cases':results}
    print(json.dumps(report,indent=2,ensure_ascii=False))
    engine.dispose()
    return int(report['failed']>0)


if __name__=='__main__':
    parser=argparse.ArgumentParser()
    parser.add_argument('--label',choices=['baseline','email-baseline','email-log-fix','final'],default='final')
    parser.add_argument('--child',action='store_true',help=argparse.SUPPRESS)
    parser.add_argument('--hold-job',help=argparse.SUPPRESS)
    parser.add_argument('--hold-email-send',action='store_true',help=argparse.SUPPRESS)
    args=parser.parse_args()
    if args.hold_job: hold_job(args.hold_job,args.hold_email_send)
    else: sys.exit(suite() if args.child else parent(args.label))
