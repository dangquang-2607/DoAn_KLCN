"""Round 6 SQL measurements on a migrated disposable local SQL Server database.

Run from capitalflow-api: .venv/Scripts/python.exe -B tools/verify_sql_performance.py
  --dataset D1 --variant baseline [--samples 30]
CF_SQL_SOURCE selects an isolated API source copy. Main services/data are never changed.
"""
from __future__ import annotations
import argparse
from collections import Counter
from contextlib import ExitStack
from contextvars import ContextVar
from datetime import datetime,timedelta,timezone
import hashlib
import json
import logging
import math
import os
from pathlib import Path
import re
import statistics
import subprocess
import sys
import tempfile
from threading import RLock
import time
from unittest.mock import AsyncMock,patch
from uuid import UUID,uuid4
import pyodbc
from cryptography.fernet import Fernet
from fastapi import Depends,Request
from sqlalchemy import create_engine,event,select,text,func
from sqlalchemy.engine import make_url

pyodbc.pooling=False
API=Path(__file__).resolve().parents[1];ROOT=API.parent;OUT=ROOT/'output/sql-qa'
SOURCE=Path(os.environ.get('CF_SQL_SOURCE',str(API))).resolve()
sys.path.insert(0,str(SOURCE if '--child' in sys.argv else API))
from app.dung_chung.config import settings

def qa_url(owned=False):
    url=make_url(settings.database_url);host=(url.host or '').lower().split('\\')[0].split(',')[0]
    assert settings.app_env=='development' and url.get_backend_name()=='mssql'
    assert host in {'localhost','127.0.0.1','.','(local)'} and not {'odbc_connect','dsn'} & url.query.keys()
    if owned:assert re.fullmatch(r'cf_sql_qa_[a-f0-9]{12}',url.database or ''),'Refusing non-QA database'
    return url

def parent(args):
    source=qa_url();database='cf_sql_qa_'+uuid4().hex[:12]
    assert source.database!=database and (SOURCE/'app/main.py').is_file()
    OUT.mkdir(parents=True,exist_ok=True);prefix=f'{args.dataset}-{args.variant}'+('-'+args.only_group if args.only_group else '')
    env={**os.environ,'DATABASE_URL':source.set(database=database).render_as_string(hide_password=False),
         'APP_ENV':'development','PYTHONIOENCODING':'utf-8','CF_SQL_SOURCE':str(SOURCE),
         'JOB_ENCRYPTION_KEY':Fernet.generate_key().decode(),'JWT_SECRET_KEY':Fernet.generate_key().decode(),
         'SMTP_USER':'','SMTP_PASSWORD':'','GOOGLE_AI_API_KEY':'','TELEMETRY_ENABLED':'false'}
    master=create_engine(source.set(database='master'),isolation_level='AUTOCOMMIT',hide_parameters=True)
    report={'recorded_at':datetime.now(timezone(timedelta(hours=7))).isoformat(),'dataset':args.dataset,
            'variant':args.variant,'database':database,'source':str(SOURCE),'main_database_touched':False,
            'real_smtp_calls':0,'real_ai_calls':0,'removed':False}
    with master.connect() as db:
        assert db.scalar(text('SELECT DB_ID(:name)'),{'name':database}) is None
        db.exec_driver_sql(f'CREATE DATABASE [{database}]')
    result_file=OUT/f'{prefix}-measurements.json'
    result_file.unlink(missing_ok=True)
    try:
        with (OUT/f'{prefix}-migrations.log').open('w',encoding='utf-8') as log:
            subprocess.run([sys.executable,'-B','-m','alembic','upgrade','head'],cwd=ROOT/'capitalflow-database',
                           env=env,stdout=log,stderr=subprocess.STDOUT,check=True)
        with (OUT/f'{prefix}-suite.log').open('w',encoding='utf-8') as log:
            proc=subprocess.run([sys.executable,'-B',str(Path(__file__).resolve()),'--child','--dataset',args.dataset,
                                 '--variant',args.variant,'--samples',str(args.samples),*(['--only-group',args.only_group] if args.only_group else [])],cwd=API,env=env,
                                stdout=log,stderr=subprocess.STDOUT,timeout=1800)
        report['exit_code']=proc.returncode
        if result_file.exists():report.update(json.loads(result_file.read_text(encoding='utf-8')))
    finally:
        try:
            with master.connect() as db:
                assert re.fullmatch(r'cf_sql_qa_[a-f0-9]{12}',database)
                db.exec_driver_sql(f'ALTER DATABASE [{database}] SET SINGLE_USER WITH ROLLBACK IMMEDIATE')
                db.exec_driver_sql(f'DROP DATABASE [{database}]')
                report['removed']=db.scalar(text('SELECT DB_ID(:name)'),{'name':database}) is None
        finally:
            master.dispose();(OUT/f'{prefix}-results.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
    print(json.dumps({k:v for k,v in report.items() if k not in {'cases','diagnostics','metadata','fixture','query_catalogue'}},ensure_ascii=False))
    return report.get('exit_code',1)

def distribution(values):
    values=sorted(values)
    return {'min':round(values[0],3),'median':round(statistics.median(values),3),
            'p95_observed':round(values[math.ceil(len(values)*.95)-1],3),'max':round(values[-1],3)}

def child(args):
    qa_url(True)
    from app.main import app
    from app.dung_chung.database.ket_noi import engine,InstrumentedQueuePool
    from app.dung_chung.database.session import SessionLocal as sessions
    from app.dung_chung.http import phu_thuoc as deps
    from app.dung_chung.http.gioi_han_tan_suat import limiter
    from app.dung_chung.http.trung_gian import kiem_toan as audit
    from app.chuc_nang.nguoi_dung.dang_nhap.luu_tru.nguoi_dung import User
    from app.chuc_nang.nguoi_dung.dang_nhap.luu_tru.refresh_token import RefreshToken
    from app.chuc_nang.nguoi_dung.tai_chinh.vi_tai_khoan.luu_tru.wallet import Wallet,DemoBankBalance,WalletEntry,UserBankLink
    from app.chuc_nang.nguoi_dung.tai_chinh.giao_dich.luu_tru.giao_dich import Transaction
    from app.chuc_nang.nguoi_dung.hoa_don_ai.luu_tru.invoice import Invoice
    from app.dung_chung.tac_vu_nen.luu_tru.tac_vu_nen import BackgroundJob
    from app.dung_chung.tac_vu_nen.hang_doi import claim,enqueue,now
    from app.dung_chung.tac_vu_nen import trinh_chay as worker
    from fastapi.testclient import TestClient
    from sqlalchemy.orm import Session
    from sql_qa_data import seed,uid,PASSWORD
    logging.getLogger('httpx').setLevel(logging.WARNING)
    logging.getLogger('capitalflow.invoice_metrics').setLevel(logging.WARNING)
    prefix=f'{args.dataset}-{args.variant}'+('-'+args.only_group if args.only_group else '');phase=ContextVar('sql_qa_phase',default='business')
    selected_groups = set(args.only_group.split(',')) if args.only_group else set()
    active=None;guard=RLock();queries={};captures={};results=[]
    def before(conn,cursor,statement,parameters,context,many):
        if active is None:return
        context._qa_start=time.perf_counter();context._qa_phase=phase.get()
        context._qa_fingerprint=hashlib.sha256(re.sub(r'\s+',' ',statement).strip().encode()).hexdigest()[:20]
    def after(conn,cursor,statement,parameters,context,many):
        if active is None or not hasattr(context,'_qa_start'):return
        elapsed=(time.perf_counter()-context._qa_start)*1000;fingerprint=context._qa_fingerprint;kind=context._qa_phase
        with guard:
            active['sql_count']+=1;active['sql_ms']+=elapsed;active['phases'][kind]+=1
            q=active['queries'].setdefault(fingerprint,{'count':0,'ms':0});q['count']+=1;q['ms']+=elapsed
            if fingerprint not in queries:queries[fingerprint]={'sql':statement,'phase':kind}
            capture_key=(fingerprint,active['case'])
            if kind=='business' and statement.lstrip().upper().startswith('SELECT') and not many:
                if capture_key not in captures or elapsed>captures[capture_key][2]:captures[capture_key]=(statement,parameters,elapsed)
    event.listen(engine,'before_cursor_execute',before);event.listen(engine,'after_cursor_execute',after)
    def transaction_started(session,transaction,connection):
        if active is not None and not transaction.nested:session.info['_qa_transaction']=(time.perf_counter(),phase.get())
    def transaction_finished(session):
        started=session.info.pop('_qa_transaction',None)
        if active is not None and started:active['transactions'].append({'phase':started[1],'ms':(time.perf_counter()-started[0])*1000})
    event.listen(Session,'after_begin',transaction_started)
    event.listen(Session,'after_commit',transaction_finished)
    event.listen(Session,'after_rollback',transaction_finished)
    original_pool=InstrumentedQueuePool._do_get
    def pool_get(pool):
        started=time.perf_counter()
        try:return original_pool(pool)
        finally:
            if active is not None:active['pool_ms']+=(time.perf_counter()-started)*1000
    def measured_user(request:Request,credentials=Depends(deps.security),db=Depends(deps.get_db)):
        token=phase.set('auth')
        try:return deps.get_current_user(request,credentials,db)
        finally:phase.reset(token)
    original_audit=audit._write_audit_log
    def measured_audit(*p,**kw):
        token=phase.set('audit')
        try:return original_audit(*p,**kw)
        finally:phase.reset(token)
    start=time.perf_counter();fixture=seed(engine,args.dataset)
    print('PROGRESS '+json.dumps({'phase':'seeded','dataset':args.dataset,'seconds':round(time.perf_counter()-start,2),'counts':fixture['counts']}),flush=True)
    fixture['seed_seconds']=round(time.perf_counter()-start,3)
    with engine.connect() as db:
        metadata={'server':dict(db.execute(text("SELECT CAST(SERVERPROPERTY('ProductVersion') AS nvarchar(100)) AS version, CAST(SERVERPROPERTY('Edition') AS nvarchar(100)) AS edition")).mappings().one()),
                  'revision':db.scalar(text('SELECT version_num FROM alembic_version')),
                  'indexes':[dict(r) for r in db.execute(text("SELECT t.name AS table_name,i.name AS index_name,i.is_unique,i.filter_definition FROM sys.indexes i JOIN sys.tables t ON i.object_id=t.object_id WHERE i.index_id>0 ORDER BY t.name,i.name")).mappings()]}
    import psutil
    metadata['machine']={'logical_cpu_count':psutil.cpu_count(),'total_memory_bytes':psutil.virtual_memory().total}
    metadata['source_hashes']={str(p.relative_to(SOURCE)).replace('\\','/'):hashlib.sha256(p.read_bytes()).hexdigest() for p in (SOURCE/'app').rglob('*.py')}
    if args.variant=='candidate':
        index_file=OUT/'candidate-indexes.sql'
        with engine.begin() as db:
            for statement in re.split(r'^GO\s*$',index_file.read_text(encoding='utf-8'),flags=re.M|re.I):
                if statement.strip():
                    db.exec_driver_sql(statement)
        metadata['candidate_index_script_sha256']=hashlib.sha256(index_file.read_bytes()).hexdigest()
    app.dependency_overrides[deps.get_current_user]=measured_user;limiter.enabled=False
    tokens={};today=datetime.fromisoformat(fixture['seed_date']).date()
    def login(index):
        reply=client.post('/api/v1/auth/login',json={'email':f'sql{index}@example.com','password':PASSWORD})
        assert reply.status_code==200,f'fixture login {reply.status_code}'
        tokens[index]=reply.json();return tokens[index]
    def request(index,method,path,body=None,key=None,expected=200):
        headers={'Authorization':'Bearer '+tokens[index]['access_token']}
        if key:headers['Idempotency-Key']=key
        reply=client.request(method,'/api/v1'+path,headers=headers,json=body)
        assert reply.status_code==expected,f'{method} {path.split("?")[0]} HTTP {reply.status_code}, expected {expected}'
        return reply.json() if reply.content else None
    def signature(value):
        # IDs are deterministic in read fixtures. Last-used timestamps and dynamic
        # session details are checked separately rather than compared byte-for-byte.
        def scrub(v):
            if isinstance(v,dict):return {k:scrub(x) for k,x in v.items() if k not in {'last_used_at','last_active_at','last_login_at','created_at','updated_at','generated_at','processing_ms','access_token','refresh_token','session_id','expires_at'}}
            if isinstance(v,list):return [scrub(x) for x in v]
            return v
        return hashlib.sha256(json.dumps(scrub(value),sort_keys=True,ensure_ascii=False,default=str).encode()).hexdigest()
    def measure(group,name,call,prepare=None,read=True):
        nonlocal active
        if selected_groups and group not in selected_groups:
            return
        timings=[];counts=[];sql_times=[];pool_times=[];tx_times=[];phases=Counter();catalogue={};sigs=[];first=None
        samples=args.samples if read else min(10,args.samples)
        try:
            for iteration in range(3+samples):
                fn=prepare(iteration) if prepare else call
                verify=None
                if isinstance(fn,tuple):fn,verify=fn
                state={'case':name,'sql_count':0,'sql_ms':0.,'pool_ms':0.,'phases':Counter(),'queries':{},'transactions':[]}
                active=state;started=time.perf_counter()
                try:value=fn()
                finally:elapsed=(time.perf_counter()-started)*1000;active=None
                if verify:verify(value)
                if not read:
                    # Simulate draining only this run's newly created jobs outside
                    # the timer; no mail/AI is dispatched and fixture jobs stay intact.
                    with sessions() as db:
                        db.query(BackgroundJob).filter(BackgroundJob.dedupe_key.not_like('sql-fixture-%'),
                            BackgroundJob.status.in_(['PENDING','RUNNING'])).update(
                            {'status':'DONE','payload':'','lease_token':None,'lease_until':None},synchronize_session=False)
                        db.commit()
                if iteration==0:first={'api_ms':round(elapsed,3),'sql_count':state['sql_count']}
                if iteration>=3:
                    timings.append(elapsed);counts.append(state['sql_count']);sql_times.append(state['sql_ms']);pool_times.append(state['pool_ms']);phases.update(state['phases'])
                    completed=[t['ms'] for t in state['transactions'] if t['phase']=='business']
                    if completed:tx_times.append(max(completed))
                    for key,q in state['queries'].items():
                        item=catalogue.setdefault(key,{'count':0,'ms':0});item['count']+=q['count'];item['ms']+=q['ms']
                    if read:sigs.append(signature(value))
            assert counts and min(counts)>0,'SQL collection did not observe real statements'
            result={'group':group,'case':name,'pass':True,'sample_count':samples,'warmup_count':3,'first_observation':first,
                    'api_ms':distribution(timings),'sql_execute_ms':distribution(sql_times),'pool_acquire_ms':distribution(pool_times),
                    'business_transaction_completion_ms':distribution(tx_times) if tx_times else None,
                    'sql_count':distribution(counts),'sql_phases_per_request':{k:round(v/samples,2) for k,v in phases.items()},
                    'queries':{k:{'count_per_request':round(v['count']/samples,2),'ms_per_request':round(v['ms']/samples,3)} for k,v in catalogue.items()},
                    'result_signature':sigs[0] if sigs and len(set(sigs))==1 else None,'result_stable':len(set(sigs))<=1 if read else None,
                    'read_only_case':read}
            if read and not result['result_stable']:raise AssertionError('read response changed during measurement')
        except Exception as exc:
            active=None;result={'group':group,'case':name,'pass':False,'error':str(exc) if isinstance(exc,AssertionError) else type(exc).__name__}
        results.append(result)
        print('PROGRESS '+json.dumps({k:v for k,v in result.items() if k in {'group','case','pass','api_ms','sql_count','error'}},ensure_ascii=False),flush=True)

    with tempfile.TemporaryDirectory(prefix='cf-sql-qa-') as folder,ExitStack() as stack:
        stack.enter_context(patch.object(settings,'upload_dir',folder))
        stack.enter_context(patch.object(InstrumentedQueuePool,'_do_get',new=pool_get))
        stack.enter_context(patch.object(audit,'_write_audit_log',new=measured_audit))
        stack.enter_context(patch('smtplib.SMTP',side_effect=AssertionError('Real SMTP forbidden')))
        stack.enter_context(patch('smtplib.SMTP_SSL',side_effect=AssertionError('Real SMTP forbidden')))
        stack.enter_context(patch('fastapi_mail.FastMail.send_message',new_callable=AsyncMock,side_effect=AssertionError('Real mail forbidden')))
        stack.enter_context(patch('app.chuc_nang.nguoi_dung.hoa_don_ai.ha_tang.gemini._call_gemini_model',new_callable=AsyncMock,side_effect=AssertionError('Real AI forbidden')))
        client=stack.enter_context(TestClient(app,raise_server_exceptions=False))
        for index in [0,1,2,3,4,5]:login(index)
        heavy=3;wallet=fixture['wallets']['3'];category=fixture['categories'][0]
        def read(group,name,path,index=3):measure(group,name,lambda:request(index,'GET',path))
        for page,size in [(1,20),(1,100),(1,1000),(10,20)]:read('6-U01',f'bookkeeping page={page} size={size}',f'/bookkeeping?page={page}&page_size={size}')
        read('6-U01','bookkeeping filtered','/bookkeeping?type=EXPENSE&origin=MANUAL&search=QA&start_date='+today.replace(day=1).isoformat())
        read('6-U01','bookkeeping export all','/bookkeeping/export-data')
        for path in ['/wallets','/wallets/history?page_size=20','/wallets/history?page=10&page_size=100',f'/wallets/{wallet}/history?page_size=100']:
            read('6-U02',path,path)
        for path in ['/bookkeeping/dashboard','/analytics?scope=all',f'/analytics?month={today.month}&year={today.year}',f'/analytics?start_date={today-timedelta(days=364)}&end_date={today}']:
            read('6-U03',path,path)
        for index in [5,4,3]:read('6-U04',f'current budgets owner={index}','/budgets',index)
        read('6-U04','budget history all',f'/budgets/history?year={today.year}')
        for n in [0,1,2]:read('6-U04',f'budget history single type={n}',f'/budgets/history?year={today.year}&budget_id={fixture["budgets"]["3"][n]}')
        for size in [10,50,100]:read('6-U05',f'invoice list size={size}',f'/invoices?page_size={size}')
        read('6-U05','invoice detail',f'/invoices/{fixture["invoice_id"]}')
        measure('6-U05','duplicate preview',lambda:request(3,'POST',f'/invoices/{fixture["invoice_id"]}/duplicate-check',{}))
        for path in ['/notifications?page_size=30','/notifications?page=5&page_size=100']:
            read('6-U06',path,path)
        from app.dung_chung.security.tokens import decode_token
        current_family = decode_token(tokens[3]['access_token'])['sid']
        if '6-U06' in selected_groups:
            history_count = 100 if args.dataset == 'D1' else 500
            session_now = datetime.now(timezone.utc).replace(tzinfo=None)
            owner_id = UUID(fixture['users'][3])
            with engine.begin() as db:
                db.execute(RefreshToken.__table__.insert(), [
                    {'id': uid(f'qa-session-{i}'), 'user_id': owner_id,
                     'family_id': uid(f'qa-session-family-{i}'),
                     'token_hash': hashlib.sha256(f'qa-session-{i}'.encode()).hexdigest(),
                     'created_at': session_now - timedelta(hours=i + 1),
                     'expires_at': session_now + timedelta(days=7),
                     'revoked_at': session_now if i >= 3 else None,
                     'device_name': f'QA device {i}'}
                    for i in range(history_count)
                ])
            fixture['additional_session_history'] = history_count

        def session_list():
            sessions = request(3, 'GET', '/auth/sessions')
            active = [row for row in sessions if row['is_current']]
            assert len(active) == 1 and active[0]['id'] == current_family, 'incorrect current session'
            if '6-U06' in selected_groups:
                expected = {current_family, *(str(uid(f'qa-session-family-{i}')) for i in range(3))}
                assert {row['id'] for row in sessions} == expected, 'active/revoked sessions leaked or missing'
            return [{**row, 'id': 'current' if row['is_current'] else row['id']} for row in sessions]

        measure('6-U06','/auth/sessions',session_list)
        for path in ['/admin/users?page_size=20','/admin/users?page_size=100&role=USER','/admin/users?search=sql3','/admin/users?search=not-present']:
            read('6-A01',path,path,0)
        read('6-A01','user detail',f'/admin/users/{fixture["users"][3]}',0)
        for path in ['/admin/overview','/admin/system/analytics?unit=month&periods=12','/admin/system/analytics?unit=week&periods=12']:
            read('6-A02',path,path,0)
        for path in ['/admin/audit-logs?page_size=50','/admin/audit-logs?page=50&page_size=100','/admin/audit-logs?search=SQL&group=users','/admin/audit-logs?result=error']:
            read('6-A03',path,path,0)
        for path in ['/admin/email/logs?page_size=50','/admin/email/logs?page=30&page_size=100','/admin/email/logs?status=UNKNOWN','/admin/email/logs?search=sql3']:
            read('6-A04',path,path,0)
        read('6-A05','ocr monitor','/admin/system/ocr-monitor',0)
        for path in ['/admin/support-cases','/admin/support-cases?status=OPEN','/admin/support-cases?status=RESOLVED&page=3']:
            read('6-A06',path,path,2)
        read('6-W01','authenticated profile','/auth/me')
        def old_activity(iteration):
            with sessions() as db:
                db.get(User,UUID(fixture['users'][3])).last_active_at=datetime.now(timezone.utc)-timedelta(minutes=5)
                db.query(RefreshToken).filter(RefreshToken.user_id==UUID(fixture['users'][3])).update({'last_used_at':datetime.now(timezone.utc)-timedelta(minutes=5)},synchronize_session=False);db.commit()
            return lambda:request(3,'GET','/auth/me')
        measure('6-W01','profile updates expired activity stamp',None,prepare=old_activity)
        # SQL diagnostics are collected separately, after timing reads and before
        # adding temporary write fixtures. They never replay captured mutations.
        diagnostics=diagnose(engine,results,captures,OUT/prefix,all_analytics='6-U03' in selected_groups)
        write_cases(measure,request,client,sessions,fixture,tokens,settings,folder,worker)
    engine.dispose()
    result={'passed':sum(r['pass'] for r in results),'failed':sum(not r['pass'] for r in results),
            'groups':sorted({r['group'] for r in results}),'samples_requested':args.samples,
            'fixture':{k:v for k,v in fixture.items() if k not in {'password','users','wallets','categories','budgets'}},
            'metadata':metadata,'cases':results,'diagnostics':diagnostics,'query_catalogue':queries}
    (OUT/f'{prefix}-measurements.json').write_text(json.dumps(result,ensure_ascii=False,indent=2,default=str),encoding='utf-8')
    return int(bool(result['failed']))


def diagnose(engine,results,captures,directory,all_analytics=False):
    """Replay business SELECTs with per-session IO/TIME/XML; no auth/mutation binds saved."""
    from xml.etree import ElementTree as ET
    directory.mkdir(parents=True,exist_ok=True);selected={};output=[]
    for result in results:
        eligible=[(key,value) for key,value in result.get('queries',{}).items() if (key,result['case']) in captures]
        if eligible:
            chosen = eligible if all_analytics and result['group'] == '6-U03' else [
                max(eligible, key=lambda pair: pair[1]['ms_per_request'])
            ]
            for key, _ in chosen:
                selected[key, result['case']] = True
    for key,case_name in selected:
        cases=[case_name];statement,parameters,_=captures[key,case_name];raw=engine.raw_connection();cursor=raw.cursor();messages=[];xml=None
        try:
            cursor.execute('SET STATISTICS IO ON; SET STATISTICS TIME ON; SET STATISTICS XML ON;')
            cursor.execute(statement,parameters)
            while True:
                if cursor.description:
                    for row in cursor.fetchall():
                        if len(row)==1 and isinstance(row[0],str) and '<ShowPlanXML' in row[0]:xml=row[0]
                messages.extend(str(item[1]) for item in cursor.messages)
                if not cursor.nextset():break
            record={'query_id':key,'cases':cases,'logical_reads':sum(map(int,re.findall(r'(?<!lob )logical reads (\d+)', '\n'.join(messages)))),
                    'cpu_ms':sum(map(int,re.findall(r'CPU time = (\d+) ms','\n'.join(messages)))),
                    'io_messages_available':any('logical reads' in message for message in messages),'actual_plan_available':xml is not None}
            if xml:
                plan_file=key+'-'+hashlib.sha256(case_name.encode()).hexdigest()[:8]+'.sqlplan'
                (directory/plan_file).write_text(xml,encoding='utf-8');record['plan_file']=str(directory/plan_file)
                root=ET.fromstring(xml);ns={'p':'http://schemas.microsoft.com/sqlserver/2004/07/showplan'}
                record['physical_operations']=dict(Counter(node.attrib.get('PhysicalOp','') for node in root.findall('.//p:RelOp',ns)))
                record['warnings']=[node.tag.split('}')[-1] for parent in root.findall('.//p:Warnings',ns) for node in parent]
            output.append(record)
        except Exception as exc:output.append({'query_id':key,'cases':cases,'diagnostic_error':type(exc).__name__})
        finally:
            try:cursor.execute('SET STATISTICS XML OFF; SET STATISTICS TIME OFF; SET STATISTICS IO OFF;');raw.rollback()
            finally:cursor.close();raw.close()
    return output


def write_cases(measure,request,client,sessions,fixture,tokens,settings,folder,worker):
    # Filled with isolated, real-commit factories below. Setup stays outside timers.
    from sqlalchemy import select
    from app.chuc_nang.nguoi_dung.dang_nhap.luu_tru.nguoi_dung import User
    from app.chuc_nang.nguoi_dung.tai_chinh.vi_tai_khoan.luu_tru.wallet import Wallet,DemoBankBalance,UserBankLink,WalletEntry
    from app.chuc_nang.nguoi_dung.tai_chinh.giao_dich.luu_tru.giao_dich import Transaction
    from app.chuc_nang.nguoi_dung.hoa_don_ai.luu_tru.invoice import Invoice
    from app.dung_chung.tac_vu_nen.hang_doi import enqueue,claim,now
    from app.chuc_nang.nguoi_dung.hoa_don_ai.nghiep_vu.deletion import purge_expired_invoices
    from sql_qa_data import PASSWORD
    with sessions() as db:hashed=db.get(User,UUID(fixture['users'][3])).password_hash
    def actor(active=True,role='USER',login=True):
        user_id,wallet_id,bank_id,link_id=[uuid4() for _ in range(4)];email=f'write-{user_id.hex}@example.com'
        with sessions() as db:
            db.add(User(id=user_id,email=email,full_name='SQL write fixture',password_hash=hashed,role=role,is_active=active));db.flush()
            db.add_all([Wallet(id=wallet_id,user_id=user_id,name='SQL write wallet',balance=100000000,is_default=True),
                        DemoBankBalance(id=bank_id,user_id=user_id,provider='VCB',account_number=str(int(user_id.hex[:12],16)),
                                        account_number_masked='***QA',opening_balance=200000000,balance=100000000)])
            db.flush()
            funding=WalletEntry(operation_id=uuid4(),wallet_id=wallet_id,kind='TOPUP',amount=100000000,balance_after=100000000,bank_id=bank_id)
            db.add(funding);db.flush()
            db.add(Transaction(user_id=user_id,wallet_entry_id=funding.id,amount=100000000,type='INCOME',source='WALLET',
                               transaction_date=now().date(),kind='NORMAL',include_in_reports=False,description='SQL QA funding'))
            db.add(UserBankLink(id=link_id,user_id=user_id,bank_id=bank_id,is_active=True,expires_at=now()+timedelta(days=30)));db.commit()
        index=len(tokens)+1000
        if login:
            reply=client.post('/api/v1/auth/login',json={'email':email,'password':PASSWORD});assert reply.status_code==200
            tokens[index]=reply.json()
        return {'index':index,'user':user_id,'wallet':wallet_id,'link':link_id,'bank':bank_id}
    for action in ['topup','withdraw','transfer','payment','payment_replay','invoice_confirm']:
        def prepare(iteration,action=action):
            a=actor();path=f'/wallets/{a["wallet"]}/';body={};expected=200;key=uuid4().hex
            if action in {'topup','withdraw'}:path+=action;body={'link_id':str(a['link']),'amount':'25000'}
            elif action=='transfer':
                with sessions() as db:
                    other=Wallet(user_id=a['user'],name='SQL target wallet',balance=0);db.add(other);db.commit();target=str(other.id)
                path+='transfers/create';body={'to_wallet_id':target,'amount':'25000'}
            elif action in {'payment','payment_replay'}:
                bill=request(a['index'],'POST','/wallets/bills/qr',{'merchant_name':'SQL write cafe','items':[{'name':'Tea','quantity':1,'unit_price':'25000'}]})
                path+='payments/create';body={'qr_payload':bill['qr_payload']};expected=201
                if action=='payment_replay':request(a['index'],'POST',path,body,key,201)
            else:
                with sessions() as db:
                    row=Invoice(user_id=a['user'],merchant_name='SQL write invoice',invoice_date=now().date(),invoice_number=uuid4().hex,
                                status='REVIEW_REQUIRED',total_amount=25000,currency='VND',revision=1)
                    db.add(row);db.commit();iid=row.id
                path=f'/bookkeeping/invoices/{iid}/confirm';body={'expected_revision':1,'category_id':fixture['categories'][0]};expected=201
            def invoke():
                return request(a['index'],'POST',path,body,key,expected)
            def verify(result):
                with sessions() as db:
                    wallet=db.get(Wallet,a['wallet']);bank=db.get(DemoBankBalance,a['bank'])
                    delta=25000 if action=='topup' else 0 if action=='invoice_confirm' else -25000
                    assert wallet.balance==100000000+delta,'write measurement corrupted balance'
                    count=db.scalar(select(func.count()).select_from(Transaction).where(Transaction.user_id==a['user']))
                    assert count==(3 if action=='transfer' else 2),'write measurement created wrong record count'
                    if action=='invoice_confirm':assert db.get(Invoice,iid).status=='CONFIRMED'
                    elif action in {'payment','payment_replay'}:
                        assert db.scalar(select(func.count()).select_from(WalletEntry).where(WalletEntry.wallet_id==wallet.id,WalletEntry.kind=='PAYMENT'))==1
            return invoke,verify
        measure('6-W02',action,None,prepare=prepare,read=False)
    for action in ['ban','unban','role','bulk_1','bulk_20','bulk_100']:
        def prepare(iteration,action=action):
            if action.startswith('bulk_'):
                count=int(action.split('_')[1]);ids=[]
                with sessions() as db:
                    for _ in range(count):
                        row=User(email=f'bulk-{uuid4().hex}@example.com',full_name='SQL bulk fixture',password_hash=hashed,role='USER',is_active=True)
                        db.add(row);db.flush();ids.append(str(row.id))
                    db.commit()
                def verify_bulk(value):
                    assert value['banned_count']==count,'bulk benchmark silently skipped a target'
                    with sessions() as db:assert db.scalar(select(func.count()).select_from(User).where(User.id.in_([UUID(v) for v in ids]),User.is_active==False))==count
                return (lambda:request(0,'POST','/admin/users/bulk-ban',{'user_ids':ids,'reason':'SQL QA benchmark'})),verify_bulk
            a=actor(active=action!='unban',login=False)
            def verify_admin(value):
                with sessions() as db:
                    row=db.get(User,a['user'])
                    assert row.is_active==(action!='ban')
                    if action=='role':assert row.role=='ADMIN' and row.support_only
            return (lambda:request(0,'PATCH',f'/admin/users/{a["user"]}/{action}',{'role':'ADMIN','support_only':True} if action=='role' else None)),verify_admin
        measure('6-W03',action,None,prepare=prepare,read=False)
    def claim_prepare(iteration):
        with sessions() as db:
            row=enqueue(db,'EMAIL',{'function':'send_test_email','args':['sql@example.com'],'kwargs':{}},owner_user_id=UUID(fixture['users'][3]))
            row.available_at=now()-timedelta(days=800);db.commit()
        def invoke():
            with sessions() as db:return bool(claim(db,kinds={'EMAIL'}))
        return invoke
    measure('6-W04','claim pending email without dispatch',None,prepare=claim_prepare,read=False)
    def sweep_prepare(iteration):
        a=actor(login=False)
        with sessions() as db:
            db.add(Invoice(user_id=a['user'],status='FAILED',deleted_at=now()-timedelta(days=31),revision=1));db.commit()
        return lambda:purge_expired_invoices(sessions,user_id=a['user'])
    measure('6-W04','purge expired invoice SQL',None,prepare=sweep_prepare,read=False)
    def budget_prepare(iteration):
        from app.chuc_nang.nguoi_dung.tai_chinh.giao_dich.luu_tru.giao_dich import Transaction
        with sessions() as db:
            tid=db.scalar(select(Transaction.id).where(Transaction.user_id==UUID(fixture['users'][3]),Transaction.type=='EXPENSE'))
            job=enqueue(db,'BUDGET',{'user_id':fixture['users'][3],'transaction_id':str(tid)},owner_user_id=UUID(fixture['users'][3]))
            job.available_at=now()-timedelta(days=800);db.commit()
        return lambda:worker.run_once(kinds={'BUDGET'})
    measure('6-W04','budget worker SQL without mail dispatch',None,prepare=budget_prepare,read=False)


if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--dataset',choices=['D1','D2'],required=True)
    parser.add_argument('--variant',choices=['baseline','candidate'],default='baseline')
    parser.add_argument('--samples',type=int,default=30);parser.add_argument('--child',action='store_true')
    parser.add_argument('--only-group',help='Remeasure comma-separated groups without rerunning unaffected cases')
    args=parser.parse_args()
    if not 1<=args.samples<=30:parser.error('samples must be 1..30')
    if args.only_group and not re.fullmatch(r'6-[UAW]\d{2}(?:,6-[UAW]\d{2})*',args.only_group):
        parser.error('invalid --only-group list')
    if args.variant == 'candidate' and SOURCE == API:
        parser.error('set CF_SQL_SOURCE to the reviewed API staging directory for candidate runs')
    sys.exit(child(args) if args.child else parent(args))
