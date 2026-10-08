"""Real SQL Server, separate synthetic database. Never deletes databases.
Runs production decorated transfer route with independent sessions/threads.
"""
import json, threading, uuid
from pathlib import Path
from datetime import date
from decimal import Decimal
from concurrent.futures import ThreadPoolExecutor
from sqlalchemy import create_engine, text, select, func, event
from sqlalchemy.orm import sessionmaker
from sqlalchemy.engine import make_url
from starlette.requests import Request
from app.dung_chung.config import settings

ROOT=Path(__file__).resolve().parent
marker=ROOT/'sql-concurrency-result.json'
if marker.exists(): raise SystemExit('Existing result: do not create duplicate staging runs accidentally.')
source=make_url(settings.database_url)
assert source.get_backend_name()=='mssql' and 'odbc_connect' not in source.query
DB='CapitalFlow_QA_20261008_'+uuid.uuid4().hex[:8]
master=create_engine(source.set(database='master'),isolation_level='AUTOCOMMIT',hide_parameters=True)
with master.connect() as c:
    assert c.scalar(text('SELECT DB_ID(:name)'),{'name':DB}) is None
    c.exec_driver_sql('CREATE DATABASE ['+DB+']')
master.dispose()
settings.database_url=source.set(database=DB).render_as_string(hide_password=False)
settings.smtp_user='';settings.smtp_password='';settings.google_ai_api_key=''
marker.write_text(json.dumps({'database':DB,'status':'STARTED'}),encoding='utf-8')
from app.dung_chung.database.dang_ky_mo_hinh import Base
from app.chuc_nang.nguoi_dung.dang_nhap.luu_tru.nguoi_dung import User
from app.chuc_nang.nguoi_dung.tai_chinh.vi_tai_khoan.luu_tru.account import Account
from app.chuc_nang.nguoi_dung.tai_chinh.giao_dich.luu_tru.giao_dich import Transaction
from app.chuc_nang.nguoi_dung.tai_chinh.giao_dich.luu_tru.ban_ghi_luy_dang import IdempotencyRecord
from app.chuc_nang.nguoi_dung.tai_chinh.giao_dich.api import transfer_tx
from app.chuc_nang.nguoi_dung.tai_chinh.giao_dich.schemas import TransactionTransfer

engine=create_engine(settings.database_url,pool_size=12,max_overflow=4,hide_parameters=True)
@event.listens_for(engine,'connect')
def configure(conn,_):
    conn.timeout=25
    cur=conn.cursor();cur.execute('SET LOCK_TIMEOUT 20000');cur.close()
with engine.connect() as c: assert c.scalar(text('SELECT DB_NAME()'))==DB
Base.metadata.create_all(engine)
sessions=sessionmaker(bind=engine,expire_on_commit=False)
with sessions.begin() as db:
    user=User(email='sql-qa@example.com',full_name='SQL concurrency QA',password_hash='not-a-login',role='USER',is_active=True)
    db.add(user);db.flush();uid=user.id
    a=Account(user_id=uid,name='QA A',account_type='BANK',balance=100000,currency='VND')
    b=Account(user_id=uid,name='QA B',account_type='CASH',balance=1000,currency='VND')
    db.add_all([a,b]);db.flush();aid,bid=a.id,b.id
    for acc in (a,b):db.add(Transaction(user_id=uid,account_id=acc.id,amount=acc.balance,type='INCOME',kind='ADJUSTMENT',source='SYSTEM',transaction_date=date.today()))

def transfer(key,amount=100,barrier=None,low=False):
    with sessions() as db:
        if low:db.execute(text('SET DEADLOCK_PRIORITY LOW'))
        user=db.get(User,uid)
        db.info['request']=Request({'type':'http','method':'POST','path':'/api/v1/transactions/transfer','headers':[(b'idempotency-key',key.encode())]})
        if barrier:barrier.wait(timeout=15)
        return transfer_tx(payload=TransactionTransfer(from_account_id=aid,to_account_id=bid,amount=amount),db=db,user=user)

def snapshot():
    with sessions() as db:
        amounts=[db.get(Account,x).balance for x in (aid,bid)]
        sums=[db.scalar(select(func.sum(Transaction.amount)).where(Transaction.account_id==x)) for x in (aid,bid)]
        assert amounts==sums and sum(amounts)==101000
        return {'balances':[str(x) for x in amounts], 'ledger_sums':[str(x) for x in sums],
                'transfer_legs':db.scalar(select(func.count()).select_from(Transaction).where(Transaction.kind=='TRANSFER')),
                'replay_records':db.scalar(select(func.count()).select_from(IdempotencyRecord))}

results={'database':DB,'schema':'current SQLAlchemy model DDL; not a restored production database','sql_server_real':True,'production_writes':False,'cases':{}}
def save():marker.write_text(json.dumps(results,indent=2),encoding='utf-8')
try:
    barrier=threading.Barrier(10)
    with ThreadPoolExecutor(max_workers=10) as pool:
        responses=list(pool.map(lambda _:transfer('qa-same-key-0001',barrier=barrier),range(10)))
    assert all(r==responses[0] for r in responses)
    s=snapshot();assert s['balances']==['99900.00','1100.00'] and s['transfer_legs']==2
    results['cases']['same_key_10_concurrent']={'passed':True,**s};save()
    barrier=threading.Barrier(10)
    with ThreadPoolExecutor(max_workers=10) as pool:
        responses=list(pool.map(lambda i:transfer('qa-distinct-key-'+str(i),barrier=barrier),range(10)))
    assert len({r['transfer_out_id'] for r in responses})==10
    s=snapshot();assert s['balances']==['98900.00','2100.00'] and s['transfer_legs']==22
    results['cases']['different_keys_10_concurrent']={'passed':True,**s};save()
    before=snapshot()
    def fail_replay(conn,cursor,statement,parameters,context,executemany):
        if statement.lstrip().upper().startswith('INSERT INTO IDEMPOTENCY_RECORDS'):
            raise RuntimeError('QA injected replay persistence failure')
    event.listen(engine,'before_cursor_execute',fail_replay)
    failed=False
    try:transfer('qa-rollback-key-0001')
    except RuntimeError:failed=True
    finally:event.remove(engine,'before_cursor_execute',fail_replay)
    assert failed and snapshot()==before
    results['cases']['rollback_after_money_before_replay']={'passed':True,**snapshot()};save()
    # Raw staging session locks an account; production route locks user first.
    # Inverting order then asks SQL Server to pick the route as deadlock victim.
    user_locked=threading.Event()
    def signal_lock(conn,cursor,statement,parameters,context,executemany):
        if 'FROM users WITH (UPDLOCK' in statement:user_locked.set()
    event.listen(engine,'after_cursor_execute',signal_lock)
    with engine.connect() as blocker:
        tx=blocker.begin()
        blocker.execute(text('SET DEADLOCK_PRIORITY HIGH'))
        blocker.execute(text('UPDATE accounts SET balance=balance WHERE id=:id'),{'id':str(aid)})
        with ThreadPoolExecutor(max_workers=1) as pool:
            future=pool.submit(transfer,'qa-deadlock-key-0001',100,None,True)
            assert user_locked.wait(10), 'Production user lock not observed'
            blocker.execute(text('UPDATE users SET full_name=full_name WHERE id=:id'),{'id':str(uid)})
            tx.rollback()
            try:
                future.result(timeout=25)
                raise AssertionError('Expected a real deadlock victim')
            except Exception as exc:
                assert '1205' in str(exc), type(exc).__name__
        event.remove(engine,'after_cursor_execute',signal_lock)
    assert snapshot()==before
    transfer('qa-deadlock-key-0001')
    s=snapshot();assert s['balances']==['98800.00','2200.00'] and s['transfer_legs']==24
    results['cases']['real_deadlock_1205_then_explicit_retry']={'passed':True,'automatic_retry':False,**s};save()
    results['status']='PASSED'
except Exception as exc:
    results['status']='FAILED';results['failure_type']=type(exc).__name__;results['failure_hint']=str(exc).splitlines()[0][:180]
finally:
    save();engine.dispose()
print(json.dumps(results))
raise SystemExit(0 if results.get('status')=='PASSED' else 1)
