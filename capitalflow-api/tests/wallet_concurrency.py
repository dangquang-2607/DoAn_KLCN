"""Real concurrent SQL sessions in a unique tempdb schema; never write app data.

Creates only synthetic users/money in tempdb and removes its own schema in finally.
Exercises production handlers and locks, including both orderings of close vs receive.
"""
import sys
from pathlib import Path
from uuid import uuid4, UUID
from decimal import Decimal
from datetime import timedelta
from concurrent.futures import ThreadPoolExecutor
from threading import Event
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from sqlalchemy import create_engine, text, select, func
from sqlalchemy.engine import make_url
from sqlalchemy.orm import Session
from starlette.requests import Request
from fastapi import HTTPException
import app.dung_chung.database.dang_ky_mo_hinh
from app.dung_chung.database.nen_tang import Base
from app.dung_chung.config import settings
from app.chuc_nang.nguoi_dung.dang_nhap.luu_tru.nguoi_dung import User
from app.chuc_nang.nguoi_dung.tai_chinh.vi_tai_khoan import wallet_api as api
from app.chuc_nang.nguoi_dung.tai_chinh.vi_tai_khoan.luu_tru.wallet import Wallet, WalletEntry, UserBankLink as WalletBankLink, DemoBankBalance
from app.chuc_nang.nguoi_dung.tai_chinh.giao_dich.luu_tru.ban_ghi_luy_dang import IdempotencyRecord
from app.chuc_nang.nguoi_dung.tai_chinh.thong_bao.luu_tru.thong_bao import Notification


def main():
    schema = 'qa_wallet_' + uuid4().hex
    url = make_url(settings.database_url)
    assert url.get_backend_name() == 'mssql' and 'odbc_connect' not in url.query
    engine = create_engine(url.set(database='tempdb'), hide_parameters=True)
    dbengine = engine.execution_options(schema_translate_map={None: schema})
    tables = [m.__table__ for m in (User, Wallet, DemoBankBalance, WalletBankLink, WalletEntry, IdempotencyRecord, Notification)]
    with engine.begin() as conn:
        assert conn.scalar(text('SELECT DB_NAME()')) == 'tempdb'
        conn.execute(text(f'CREATE SCHEMA [{schema}]'))
    try:
        Base.metadata.create_all(dbengine, tables=tables)
        users = [uuid4(), uuid4()]
        with Session(dbengine) as db:
            db.add_all(User(id=u, email=f'{u}@example.invalid', full_name='Concurrent QA', password_hash='unusable') for u in users)
            db.commit()

        def call(uid, fn, path, method='POST', key=None, **kwargs):
            with Session(dbengine, autoflush=False) as db:
                db.execute(text('SET LOCK_TIMEOUT 10000'))
                user = db.get(User, uid)
                db.info['request'] = Request({'type':'http','method':method,'path':path,'headers':[(b'idempotency-key',(key or uuid4().hex).encode())], 'query_string':b''})
                try:
                    return 200, fn(db=db, user=user, **kwargs)
                except HTTPException as exc:
                    return exc.status_code, exc.detail

        def wallet(uid):
            status, result = call(uid,api.create_wallet,'/wallets',payload=api.WalletName(name='Concurrent QA'))
            assert status==200
            return UUID(result['id'])

        source = wallet(users[0])
        with Session(dbengine) as db:
            bank = DemoBankBalance(user_id=users[0],provider='VCB',account_number='1234567890123',account_number_masked='***123',opening_balance=1000,balance=1000)
            db.add(bank); db.flush()
            link = WalletBankLink(user_id=users[0],bank_id=bank.id,expires_at=api.now()+timedelta(days=1))
            db.add(link); db.commit(); link_id=link.id
        assert call(users[0],api.bank_money,f'/wallets/{source}/topup',wallet_id=source,action='topup',payload=api.BankMoney(link_id=link_id,amount=100))[0]==200

        def transfer(target, amount=10, key=None):
            return call(users[0],api.transfer,f'/wallets/{source}/transfers/create',key=key,wallet_id=source,payload=api.Transfer(to_wallet_id=target,amount=amount))

        def close(target):
            return call(users[1],api.archive,f'/wallets/{target}',method='DELETE',wallet_id=target)

        # First request owns the wallet locks while the second request starts.
        def race(first, second, hook_name, hook):
            held, release, started = Event(), Event(), Event()
            original = getattr(api,hook_name)
            def held_hook(*args, **kwargs):
                result=original(*args, **kwargs)
                if hook(*args, **kwargs):
                    held.set()
                    assert release.wait(5), 'test release timed out'
                return result
            def competitor():
                started.set()
                return second()
            with patch.object(api,hook_name,held_hook), ThreadPoolExecutor(max_workers=2) as pool:
                a=pool.submit(first)
                try:
                    assert held.wait(5), 'first request never obtained lock'
                    b=pool.submit(competitor)
                    assert started.wait(5)
                    # A blocked competing request must not complete while the lock is held.
                    from concurrent.futures import TimeoutError
                    try:
                        b.result(timeout=0.2)
                    except TimeoutError:
                        pass
                    else:
                        raise AssertionError('competing request bypassed wallet lock')
                finally:
                    release.set()
                return a.result(timeout=12), b.result(timeout=12)

        recipient=wallet(users[1])
        a,b=race(lambda:transfer(recipient),lambda:close(recipient),'entry',lambda db,w,op,kind,*args,**kwargs: kind=='TRANSFER_IN')
        assert a[0]==200 and b[0]==409, (a,b)
        recipient2=wallet(users[1])
        a,b=race(lambda:close(recipient2),lambda:transfer(recipient2),'owned',lambda db,u,wid: wid==recipient2)
        assert a[0]==200 and b[0]==404, (a,b)
        print('PASS: transfer wins -> closure rejected; closure wins -> transfer rejected; real competing SQL locks')

        with ThreadPoolExecutor(max_workers=2) as pool:
            key=uuid4().hex
            tasks=[pool.submit(transfer,recipient,10,key) for _ in range(2)]
            results=[task.result(timeout=15) for task in tasks]
            assert results[0]==results[1] and results[0][0]==200
            withdrawals=[pool.submit(call,users[0],api.bank_money,f'/wallets/{source}/withdraw',wallet_id=source,action='withdraw',payload=api.BankMoney(link_id=link_id,amount=70)) for _ in range(2)]
            assert sorted(task.result(timeout=15)[0] for task in withdrawals)==[200,409]
        with Session(dbengine) as db:
            assert db.get(Wallet,source).balance==10
            assert db.get(Wallet,recipient).balance==20
            assert not db.get(Wallet,recipient2).is_active and db.get(Wallet,recipient2).balance==0
            for w in db.scalars(select(Wallet)):
                assert w.balance==db.scalar(select(func.coalesce(func.sum(WalletEntry.amount),0)).where(WalletEntry.wallet_id==w.id))
            assert db.scalar(select(func.count()).select_from(WalletEntry).where(WalletEntry.kind=='TRANSFER_IN'))==2
        print('PASS: concurrent retry posts once; concurrent overspend blocked; balances equal immutable ledger')
    finally:
        Base.metadata.drop_all(dbengine, tables=tables)
        with engine.begin() as conn:
            assert conn.scalar(text('SELECT DB_NAME()')) == 'tempdb'
            conn.execute(text(f'DROP SCHEMA [{schema}]'))
        engine.dispose()
        print('CLEANUP: removed only this test synthetic tempdb schema')


if __name__=='__main__': main()
