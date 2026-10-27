"""Verify the staged wallet/bookkeeping contract and migration in one SQL rollback.
No real email, provider request, committed fixture or existing-user modification.
"""
import importlib.util
import json
import sys
from pathlib import Path
from datetime import timedelta
from decimal import Decimal
from uuid import UUID, uuid4
from unittest.mock import AsyncMock, patch

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / 'capitalflow-api'))
sys.path.insert(0, str(ROOT / 'capitalflow-database/tools'))
from fastapi import FastAPI, Depends, Request
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, select, func, inspect
from sqlalchemy.orm import Session
from alembic.migration import MigrationContext
from alembic.operations import Operations
from apply_bank_otp import snapshot
import app.dung_chung.database.dang_ky_mo_hinh
from app.dung_chung.config import settings
from app.dung_chung.http.phu_thuoc import get_db, get_current_user, require_admin
from app.chuc_nang.quan_tri.nguoi_dung.vong_doi import api as lifecycle, dich_vu as lifecycle_service
from app.chuc_nang.quan_tri.nguoi_dung import api as admin_users
from app.chuc_nang.quan_tri.nguoi_dung.luu_tru.xoa_nguoi_dung import UserDeletionRequest
from app.dung_chung.tac_vu_nen.luu_tru.tac_vu_nen import BackgroundJob
from app.chuc_nang.nguoi_dung.dang_nhap.luu_tru.nguoi_dung import User
from app.chuc_nang.nguoi_dung.dang_nhap.luu_tru.dat_lai_mat_khau import PasswordResetOTP
from app.chuc_nang.nguoi_dung.tai_chinh.vi_tai_khoan import wallet_api
from app.chuc_nang.nguoi_dung.tai_chinh.vi_tai_khoan.luu_tru.wallet import Wallet, WalletEntry, UserBankLink as WalletBankLink, DemoBankBalance
from app.chuc_nang.nguoi_dung.tai_chinh.giao_dich import bookkeeping
from app.chuc_nang.nguoi_dung.tai_chinh.giao_dich.luu_tru.giao_dich import Transaction
from app.chuc_nang.nguoi_dung.tai_chinh.vi_tai_khoan.luu_tru.account import Account
from app.chuc_nang.nguoi_dung.tai_chinh.ngan_sach import api as budgets
from app.chuc_nang.nguoi_dung.tai_chinh.bao_cao_tai_chinh import phan_tich
from app.chuc_nang.nguoi_dung.hoa_don_ai.api.routes import router as invoice_router
from app.chuc_nang.nguoi_dung.hoa_don_ai.luu_tru.invoice import Invoice


def migration():
    spec = importlib.util.spec_from_file_location('independent_migration', ROOT/'capitalflow-database/alembic/versions/cfdb_independent_wallets.py')
    module = importlib.util.module_from_spec(spec); spec.loader.exec_module(module)
    return module

def ensure_spending(conn):
    if 'include_in_reports' not in {c['name'] for c in inspect(conn).get_columns('transactions')}:
        spec=importlib.util.spec_from_file_location('spending_migration',ROOT/'capitalflow-database/alembic/versions/cfdb_wallet_spending.py')
        module=importlib.util.module_from_spec(spec); spec.loader.exec_module(module)
        with Operations.context(MigrationContext.configure(conn)): module.upgrade()


def main():
    engine = create_engine(settings.database_url, hide_parameters=True)
    with engine.connect() as conn:
        before = snapshot(conn); existing_tables = set(inspect(conn).get_table_names()); conn.rollback()
        outer = conn.begin()
        try:
            if 'wallets' not in existing_tables:
                with Operations.context(MigrationContext.configure(conn)):
                    migration().upgrade()
            ensure_spending(conn)
            uids = [uuid4(), uuid4()]; active = [uids[0]]; admin_id = uuid4()
            def sessions():
                return Session(conn, autoflush=False, join_transaction_mode='create_savepoint')
            with sessions() as db:
                db.add(User(id=admin_id, email=f'wallet-admin-{admin_id.hex}@example.invalid', full_name='Wallet QA Admin', role='ADMIN', password_hash='unusable'))
                db.add_all(User(id=uid, email=f'wallet-test-{uid.hex}@example.invalid', full_name=f'Wallet user {i}',
                               password_hash='unusable', token_version=0) for i, uid in enumerate(uids))
                db.commit()
            app = FastAPI()
            for router in (wallet_api.router, bookkeeping.router, budgets.router, phan_tich.router, invoice_router):
                app.include_router(router, prefix='/api/v1')
            app.include_router(lifecycle.router, prefix='/api/v1/admin')
            app.include_router(admin_users.router, prefix='/api/v1/admin')
            def database(request: Request):
                with sessions() as db:
                    db.info['request'] = request
                    yield db
            def current(db=Depends(get_db)):
                return db.get(User, active[0])
            app.dependency_overrides[get_db] = database
            app.dependency_overrides[get_current_user] = current
            app.dependency_overrides[require_admin] = lambda: User(id=admin_id, role='ADMIN')
            mail = AsyncMock()
            with TestClient(app) as client, patch.object(wallet_api, 'send_otp_email', mail):
                def call(method, path, body=None, status=200, key=None):
                    response = client.request(method, '/api/v1'+path, json=body, headers={'Idempotency-Key':key or uuid4().hex})
                    assert response.status_code == status, (method,path,response.status_code,response.text)
                    return response.json() if response.content else None
                def create(name):
                    return call('POST','/wallets',{'name':name},201)['id']
                def link(wid, provider='VCB', pasted=False):
                    with sessions() as db:
                        for otp in db.scalars(select(PasswordResetOTP).where(PasswordResetOTP.user_id == active[0])):
                            otp.created_at = wallet_api.now()-timedelta(minutes=1)
                        db.commit()
                    number = call('GET','/wallets/providers')[provider]['demo_number']
                    submitted = ' ' + number + '\u200b\u00a0' if pasted else number
                    challenge = call('POST','/wallets/banks/send-otp',{'provider':provider,'account_number':submitted})
                    payload = {'provider':provider,'account_number':number,'otp_request_id':challenge['otp_request_id'],'otp':mail.await_args.kwargs['otp_code']}
                    key=uuid4().hex
                    result=call('POST','/wallets/banks',payload,key=key)
                    assert call('POST','/wallets/banks',payload,key=key)==result
                    return result['id']
                def balances():
                    with sessions() as db:
                        return {str(w.id): w.balance for w in db.scalars(select(Wallet).where(Wallet.user_id.in_(uids)))}
                def invariant():
                    with sessions() as db:
                        for w in db.scalars(select(Wallet).where(Wallet.user_id.in_(uids))):
                            total=db.scalar(select(func.coalesce(func.sum(WalletEntry.amount),0)).where(WalletEntry.wallet_id==w.id))
                            assert w.balance >= 0 and w.balance == total
                        for bank in db.scalars(select(DemoBankBalance).where(DemoBankBalance.user_id.in_(uids))):
                            delta=db.scalar(select(func.coalesce(func.sum(WalletEntry.amount),0)).where(WalletEntry.bank_id==bank.id))
                            assert bank.balance >= 0 and bank.balance == bank.opening_balance-delta
                        groups={}
                        for e in db.scalars(select(WalletEntry).join(Wallet, Wallet.id==WalletEntry.wallet_id).where(Wallet.user_id.in_(uids),WalletEntry.kind.in_(['TRANSFER_IN','TRANSFER_OUT']))):
                            groups.setdefault(e.operation_id,[]).append(e.amount)
                        assert all(len(v)==2 and sum(v)==0 for v in groups.values())

                a=create('Daily'); b=create('Savings')
                assert balances()=={a:0,b:0}
                call('POST','/wallets',{'name':'Bad','balance':'100'},422)
                call('POST','/wallets',{'name':'Bad','account_type':'BASIC'},422)
                call('PATCH',f'/wallets/{a}',{'balance':'-1'},422)
                call('POST',f'/wallets/{a}/transfers/create',{'to_wallet_id':b,'amount':'1'},409)
                link_a=link(a, pasted=True); link_b=link(b)
                with sessions() as db:
                    assert db.scalar(select(func.count()).select_from(DemoBankBalance).where(DemoBankBalance.user_id==active[0]))==4
                assert all('balance' not in bank for bank in call('GET',f'/wallets/{a}/banks'))
                call('POST',f'/wallets/{a}/sync',{'action':'sync'},422)
                call('POST',f'/wallets/{a}/topup',{'link_id':link_a,'amount':'-1'},422)
                key=uuid4().hex; body={'link_id':link_a,'amount':'1000000'}
                first=call('POST',f'/wallets/{a}/topup',body,key=key)
                assert call('POST',f'/wallets/{a}/topup',body,key=key)==first
                call('POST',f'/wallets/{a}/topup',{**body,'amount':'2000000'},409,key)
                assert balances()[a]==1000000
                assert link_a == link_b  # A single user-level link works with either wallet.
                call('POST',f'/wallets/{a}/withdraw',{'link_id':link_a,'amount':'1000001'},409)
                call('POST',f'/wallets/{a}/topup',{'link_id':link_a,'amount':'999999999'},409)
                call('POST',f'/wallets/{a}/withdraw',{'link_id':link_a,'amount':'200000'})
                call('POST',f'/wallets/{a}/transfers/create',{'to_wallet_id':b,'amount':'300000'})
                assert balances()=={a:500000,b:300000}; invariant()
                print('PASS: name-only zero wallet; no negative/direct balance; topup/withdraw/replay; shared bank funds; own transfer')

                active[0]=uids[1]; c=create('Recipient')
                active[0]=uids[0]
                recipient=call('GET',f'/wallets/recipients/{c}')
                assert recipient['recipient_name']=='Wallet user 1' and 'balance' not in recipient
                key=uuid4().hex; payload={'to_wallet_id':c,'amount':'100000'}
                result=call('POST',f'/wallets/{a}/transfers/create',payload,key=key)
                assert call('POST',f'/wallets/{a}/transfers/create',payload,key=key)==result
                assert balances()=={a:400000,b:300000,c:100000}
                call('PATCH',f'/wallets/{c}',{'name':'Hijack'},404)
                call('GET',f'/wallets/{c}/history',status=404)
                call('POST',f'/wallets/{c}/transfers/create',{'to_wallet_id':a,'amount':'1'},404)
                call('DELETE',f'/wallets/{a}',status=409)
                before_delete = balances()
                call('DELETE',f'/admin/users/{uids[0]}',{'mode':'hard','reason':'Policy check','confirmation':'xóa vĩnh viễn'},409)
                with sessions() as db:
                    assert db.get(User,uids[0]).is_active
                    assert db.scalar(select(func.count()).select_from(UserDeletionRequest).where(UserDeletionRequest.target_user_id==uids[0]))==0
                    assert db.scalar(select(func.count()).select_from(BackgroundJob).where(BackgroundJob.owner_user_id==uids[0],BackgroundJob.kind=='USER_PURGE'))==0
                call('PATCH',f'/admin/users/{uids[1]}/ban')
                call('POST',f'/wallets/{a}/transfers/create',{'to_wallet_id':c,'amount':'1'},404)
                call('PATCH',f'/admin/users/{uids[1]}/unban')
                assert balances()==before_delete
                old_entry=wallet_api.entry
                def fail_receiver(db,wallet,*args,**kwargs):
                    if str(wallet.id)==c: raise RuntimeError('injected failure')
                    return old_entry(db,wallet,*args,**kwargs)
                with patch.object(wallet_api,'entry',side_effect=fail_receiver):
                    try: call('POST',f'/wallets/{a}/transfers/create',payload)
                    except RuntimeError: pass
                    else: raise AssertionError('failure was not injected')
                assert balances()=={a:400000,b:300000,c:100000}; invariant()
                print('PASS: cross-user transfer, recipient confirmation, owner guards, atomic rollback and both ledger legs')

                call('DELETE',f'/wallets/banks/{link_a}')
                call('POST',f'/wallets/{a}/topup',{'link_id':link_a,'amount':'1'},409)
                assert link(a)==link_a
                with sessions() as db:
                    db.get(WalletBankLink,UUID(link_a)).expires_at=wallet_api.now()-timedelta(seconds=1); db.commit()
                call('POST',f'/wallets/{a}/topup',{'link_id':link_a,'amount':'1'},409)
                assert link(a)==link_a
                invariant()
                print('PASS: unlink/expiry block money; relinking preserves provider funds and source ledger')

                today=bookkeeping.today_vn(); stable=balances()
                budget=call('POST','/budgets',{'name':'Book budget','amount_limit':'1000000','period_type':'CUSTOM',
                    'start_date':today.isoformat(),'end_date':today.isoformat()},201)['id']
                base={'type':'EXPENSE','amount':'200000','transaction_date':today.isoformat(),'description':'Record only'}
                key=uuid4().hex; record=call('POST','/bookkeeping',base,201,key)
                assert record['account_id'] is None
                assert call('POST','/bookkeeping',base,201,key)['id']==record['id']
                call('POST','/bookkeeping',{**base,'account_id':a},422)
                call('POST','/bookkeeping',{**base,'include_in_reports':False},422)
                call('PATCH','/bookkeeping/'+record['id'],{'include_in_reports':False},422)
                assert balances()==stable
                assert Decimal(call('GET',f'/budgets/{budget}')['spent_amount'])==200000
                call('PATCH','/bookkeeping/'+record['id'],{'amount':'300000'})
                report=call('GET',f'/analytics?start_date={today}&end_date={today}')
                assert report['summary']['expense']==300000
                call('DELETE','/bookkeeping/'+record['id'])
                assert Decimal(call('GET',f'/budgets/{budget}')['spent_amount'])==0
                iid=uuid4()
                with sessions() as db:
                    db.add(Invoice(id=iid,user_id=active[0],status='REVIEW_REQUIRED',merchant_name='Book receipt',
                        invoice_date=today,total_amount=Decimal('400000'),file_sha256=uuid4().hex*2,currency='VND'))
                    db.commit()
                key=uuid4().hex
                confirmed=call('POST',f'/bookkeeping/invoices/{iid}/confirm',{},201,key)
                assert call('POST',f'/bookkeeping/invoices/{iid}/confirm',{},201,key)==confirmed
                call('POST',f'/bookkeeping/invoices/{iid}/confirm',{'include_in_reports':False},422)
                assert Decimal(call('GET',f'/budgets/{budget}')['spent_amount'])==400000
                assert balances()==stable
                with patch.object(settings,'independent_wallets_enabled',True):
                    call('POST',f'/invoices/{iid}/confirm',{'account_id':a},409)
                foreign_id=uuid4()
                with sessions() as db:
                    db.add(Invoice(id=foreign_id,user_id=active[0],status='REVIEW_REQUIRED',merchant_name='Foreign receipt',
                        invoice_date=today,total_amount=Decimal('1'),file_sha256=uuid4().hex*2,currency='USD'))
                    db.commit()
                call('POST',f'/bookkeeping/invoices/{foreign_id}/confirm',{},422)
                call('DELETE','/bookkeeping/'+confirmed['transaction_id'])
                with sessions() as db:
                    inv=db.get(Invoice,iid); assert inv.status=='REVIEW_REQUIRED'; revision=inv.revision
                call('POST',f'/bookkeeping/invoices/{iid}/confirm',{'expected_revision':revision},201)
                assert balances()==stable
                summary=call('GET','/bookkeeping/dashboard')
                assert Decimal(summary['net_worth'])==700000 and summary['expense_this_month']==400000
                pay={'merchant_name':'Demo Electricity','bill_reference':'BILL-2026-10','amount':'100000'}
                from app.chuc_nang.nguoi_dung.danh_muc.luu_tru.danh_muc import Category
                shopping_id=uuid4()
                with sessions() as db:
                    db.add(Category(id=shopping_id,owner_user_id=active[0],name='Mua sắm QA',type='EXPENSE',keywords='Demo Electricity'))
                    db.commit()
                shopping_budget=call('POST','/budgets',{'name':'Shopping QA','category_id':str(shopping_id),'amount_limit':'1000000','period_type':'CUSTOM',
                    'start_date':today.isoformat(),'end_date':today.isoformat()},201)['id']
                call('POST',f'/wallets/{a}/payments/create',{**pay,'include_in_reports':False},422)
                payment_key=uuid4().hex
                paid=call('POST',f'/wallets/{a}/payments/create',pay,201,payment_key)
                assert call('POST',f'/wallets/{a}/payments/create',pay,201,payment_key)==paid
                call('POST',f'/wallets/{b}/payments/create',pay,409)
                assert balances()[a]==300000
                txid=paid['bookkeeping_id']; eid=paid['entry_id']; money_after=balances()
                assert Decimal(call('GET',f'/budgets/{budget}')['spent_amount'])==500000
                assert Decimal(call('GET',f'/budgets/{shopping_budget}')['spent_amount'])==100000
                call('PATCH',f'/bookkeeping/{txid}',{'include_in_reports':False})
                assert all(t['id']!=txid for t in call('GET','/bookkeeping')['items'])
                assert Decimal(call('GET',f'/budgets/{shopping_budget}')['spent_amount'])==0
                assert Decimal(call('GET',f'/budgets/{budget}')['spent_amount'])==400000
                assert call('GET',f'/analytics?start_date={today}&end_date={today}')['summary']['expense']==400000
                exported=call('GET',f'/analytics/export-data?start_date={today}&end_date={today}')
                assert len(exported['transactions'])==1
                call('PATCH',f'/bookkeeping/{txid}',{'include_in_reports':True,'amount':'40000'})
                assert Decimal(call('GET',f'/budgets/{shopping_budget}')['spent_amount'])==40000
                assert Decimal(call('GET',f'/budgets/{budget}')['spent_amount'])==440000
                call('PATCH',f'/bookkeeping/{txid}',{'amount':'100001'},422)
                call('PATCH',f'/bookkeeping/{txid}',{'type':'INCOME'},422)
                call('DELETE',f'/bookkeeping/{txid}',status=409)
                call('POST','/bookkeeping',{'type':'EXPENSE','amount':'100000','transaction_date':today.isoformat(),'description':'Repeat payment'},409)
                linked_manual=call('POST','/bookkeeping',{'type':'EXPENSE','amount':'40000','transaction_date':today.isoformat(),
                    'description':'My share','wallet_entry_id':eid},201)
                assert linked_manual['id']==txid
                payment_invoice=uuid4()
                with sessions() as db:
                    db.add(Invoice(id=payment_invoice,user_id=active[0],status='REVIEW_REQUIRED',merchant_name='Demo Electricity',
                        invoice_date=today,total_amount=Decimal('100000'),file_sha256=uuid4().hex*2,currency='VND'))
                    db.commit()
                call('POST',f'/bookkeeping/invoices/{payment_invoice}/confirm',{},409)
                invoice_link=call('POST',f'/bookkeeping/invoices/{payment_invoice}/confirm',{'wallet_entry_id':eid},201)
                assert invoice_link['transaction_id']==txid and invoice_link['outcome']=='LINKED_PAYMENT'
                assert Decimal(call('GET',f'/budgets/{budget}')['spent_amount'])==440000
                assert balances()==money_after
                evidence=next(e for e in call('GET',f'/wallets/{a}/history')['items'] if e['id']==eid)
                assert Decimal(evidence['amount'])==-100000 and Decimal(evidence['recorded_amount'])==40000
                active[0]=uids[1]
                call('PATCH',f'/bookkeeping/{txid}',{'include_in_reports':False},404)
                assert call('GET','/bookkeeping/payments')==[]
                active[0]=uids[0]
                prior=call('POST','/bookkeeping',{'type':'EXPENSE','amount':'10000','transaction_date':today.isoformat(),'description':'Paid later'},201)
                linked_pay=call('POST',f'/wallets/{a}/payments/create',{'merchant_name':'Other bill','bill_reference':'SECOND','amount':'20000','bookkeeping_id':prior['id']},201)
                assert linked_pay['bookkeeping_id']==prior['id']
                assert Decimal(call('GET',f'/budgets/{budget}')['spent_amount'])==450000
                call('POST',f'/wallets/{a}/payments/create',{**pay,'bill_reference':'TOO-LARGE','amount':'999999999'},409)
                print('PASS: payment posts once; duplicate bill blocked; reporting toggle/partial amount never change money; OCR/manual reuse one record; prior record can be linked at payment')
                active[0]=uids[1]
                assert call('GET','/bookkeeping')['total']==0
                assert Decimal(call('GET','/bookkeeping/dashboard')['net_worth'])==100000
                call('POST',f'/wallets/{c}/transfers/create',{'to_wallet_id':a,'amount':'100000'})
                close_key=uuid4().hex
                closed=call('DELETE',f'/wallets/{c}',key=close_key)
                assert call('DELETE',f'/wallets/{c}',key=close_key)==closed
                assert all(w['id']!=c for w in call('GET','/wallets'))
                assert any(w['id']==c and not w['is_active'] for w in call('GET','/wallets?include_closed=true'))
                assert call('GET',f'/wallets/{c}/history')['total']==2
                call('PATCH',f'/wallets/{c}',{'name':'Reopen'},404)
                call('PATCH',f'/wallets/{c}',{'name':'Reopen','is_active':True},422)
                call('POST',f'/wallets/{c}/topup',{'link_id':link_a,'amount':'1'},404)
                call('POST',f'/wallets/{c}/withdraw',{'link_id':link_a,'amount':'1'},404)
                call('POST',f'/wallets/{c}/transfers/create',{'to_wallet_id':a,'amount':'1'},404)
                call('GET',f'/wallets/recipients/{c}',status=404)
                call('DELETE',f'/admin/users/{uids[1]}',{'mode':'hard','reason':'Closed wallet','confirmation':'xóa vĩnh viễn'},409)
                with sessions() as db:
                    target_user=db.get(User,uids[1]); target_user.deletion_status='PURGE_PENDING'
                    req=UserDeletionRequest(id=uuid4(),target_user_id=uids[1],requested_by=admin_id,mode='hard',status='PENDING',
                        reason='Simulate old queued job',target_email_hash='0'*64)
                    db.add(req); db.flush()
                    assert lifecycle_service.purge_user_database(db,req.id,uuid4())=='FAILED'
                    assert req.error_code=='USER_HAS_WALLETS' and db.get(Wallet,UUID(c)) is not None
                    request_id=req.id; db.commit()
                call('POST',f'/admin/user-deletions/{request_id}/retry-purge',status=409)
                active[0]=uids[0]
                call('POST',f'/wallets/{a}/transfers/create',{'to_wallet_id':c,'amount':'1'},404)
                invariant()
                print('PASS: irreversible zero-only closure, retained history, blocked hard-delete/purge/retry and account locking')
                print('PASS: manual/OCR create/edit/delete/reconfirm affect only books, reports and budgets; wallet money stays independent')
        finally:
            outer.rollback()
        assert snapshot(conn)==before and set(inspect(conn).get_table_names())==existing_tables
        print('PASS: rollback restores all existing rows and schema; no email/provider calls sent')
    engine.dispose()


if __name__=='__main__':
    main()
