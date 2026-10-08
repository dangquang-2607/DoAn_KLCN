"""Current acceptance invariants, isolated SQLite and mocked external providers."""
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal
from io import BytesIO
from pathlib import Path
from uuid import UUID, uuid4
from unittest.mock import AsyncMock, MagicMock, patch
import jwt
import pytest
from sqlalchemy import select, func
from sqlalchemy.orm import sessionmaker
from app.dung_chung.config import settings
from app.dung_chung.email.dich_vu import EmailService
from app.dung_chung.tac_vu_nen.trinh_chay import run_once
from app.dung_chung.tac_vu_nen.hang_doi import enqueue, now
from app.dung_chung.tac_vu_nen.luu_tru.tac_vu_nen import BackgroundJob
from app.chuc_nang.nguoi_dung.hoa_don_ai.luu_tru.invoice import Invoice
from app.chuc_nang.nguoi_dung.hoa_don_ai.luu_tru.tac_vu_ocr import OcrJob
from app.chuc_nang.nguoi_dung.tai_chinh.giao_dich.luu_tru.giao_dich import Transaction
from app.chuc_nang.nguoi_dung.dang_nhap.luu_tru.refresh_token import RefreshToken
from app.chuc_nang.nguoi_dung.dang_nhap.luu_tru.nguoi_dung import User
from app.dung_chung.security.tokens import create_access_token
from tests.integration.taichinh.test_transactions import account, headers

REAL_SEND = EmailService.send_email_sync

def balances(client, token):
    return {x['id']: Decimal(x['balance']) for x in client.get('/api/v1/accounts', headers=headers(token)).json()}

def test_transfer_repeat_20_times_one_pair(client, db, user_token):
    a, b = account(client,user_token,'A',1000), account(client,user_token,'B',200)
    payload = {'from_account_id':a,'to_account_id':b,'amount':100}
    auth = {**headers(user_token),'Idempotency-Key':'qa-transfer-repeat-20'}
    results = [client.post('/api/v1/transactions/transfer',headers=auth,json=payload) for _ in range(20)]
    assert all(r.status_code == 201 for r in results)
    assert all(r.json() == results[0].json() for r in results)
    assert balances(client,user_token) == {a:Decimal(900), b:Decimal(300)}
    assert db.scalar(select(func.count()).select_from(Transaction).where(Transaction.kind=='TRANSFER')) == 2
    assert client.post('/api/v1/transactions/transfer',headers=auth,json={**payload,'amount':200}).status_code==409
    assert balances(client,user_token) == {a:Decimal(900),b:Decimal(300)}

def test_transfer_current_paired_delete_restores_both_wallets(client,db,user_token):
    a,b=account(client,user_token,'A',1000),account(client,user_token,'B',200)
    r=client.post('/api/v1/transactions/transfer',headers=headers(user_token),json={'from_account_id':a,'to_account_id':b,'amount':100})
    assert r.status_code==201
    pair=r.json()
    assert client.patch('/api/v1/transactions/'+pair['transfer_out_id'],headers=headers(user_token),json={'amount':1}).status_code==409
    assert client.get('/api/v1/analytics',headers=headers(user_token)).json()['summary']=={'income':0,'expense':0,'net':0}
    assert client.delete('/api/v1/transactions/'+pair['transfer_out_id'],headers=headers(user_token)).status_code==204
    assert balances(client,user_token)=={a:Decimal(1000),b:Decimal(200)}
    assert db.scalar(select(func.count()).select_from(Transaction).where(Transaction.kind=='TRANSFER'))==0

@pytest.mark.parametrize('kind', ['INCOME','EXPENSE'])
def test_crud_balance_and_replay(client,user_token,kind):
    a=account(client,user_token,'CRUD',1000)
    auth={**headers(user_token),'Idempotency-Key':'qa-crud-create-001'}
    payload={'account_id':a,'type':kind,'amount':100,'transaction_date':str(date.today())}
    r=client.post('/api/v1/transactions',headers=auth,json=payload); assert r.status_code==201
    assert client.post('/api/v1/transactions',headers=auth,json=payload).json()==r.json()
    sign=1 if kind=='INCOME' else -1
    assert balances(client,user_token)[a]==1000+sign*100
    tid=r.json()['id']
    assert client.patch('/api/v1/transactions/'+tid,headers=headers(user_token),json={'amount':250}).status_code==200
    assert balances(client,user_token)[a]==1000+sign*250
    assert client.delete('/api/v1/transactions/'+tid,headers=headers(user_token)).status_code==204
    assert balances(client,user_token)[a]==1000

def test_two_users_cannot_read_or_mutate_each_others_data(client,db,test_user,user_token):
    other=User(email='qa-other@example.com',full_name='Other',password_hash=test_user.password_hash,role='USER',is_active=True)
    db.add(other);db.commit()
    token=create_access_token(str(other.id),'USER',other.token_version)
    a=account(client,user_token,'Private',1000); b=account(client,token,'Other',100)
    tx=client.post('/api/v1/transactions',headers=headers(user_token),json={'account_id':a,'type':'EXPENSE','amount':20,'transaction_date':str(date.today())}).json()['id']
    assert client.get('/api/v1/transactions',headers=headers(token)).json()['total']==1 # own opening adjustment only
    assert a not in balances(client,token)
    for method,route,data in [('patch','accounts/'+a,{'name':'Stolen'}),('delete','accounts/'+a,None),('patch','transactions/'+tx,{'amount':1}),('delete','transactions/'+tx,None)]:
        kwargs={'headers':headers(token)}
        if data is not None:kwargs['json']=data
        assert getattr(client,method)('/api/v1/'+route,**kwargs).status_code==404
    r=client.post('/api/v1/transactions/transfer',headers=headers(token),json={'from_account_id':a,'to_account_id':b,'amount':1})
    assert r.status_code == 400 # ownership guard intentionally uses 400 for invalid account references
    inv=client.post('/api/v1/invoices',headers=headers(user_token),files={'file':('qa.png',BytesIO(b'\x89PNG\r\n\x1a\nqa'),'image/png')}).json()['id']
    for suffix in ('','/file','/items'):
        assert client.get('/api/v1/invoices/'+inv+suffix,headers=headers(token)).status_code==404
    assert client.post('/api/v1/invoices/'+inv+'/ocr',headers=headers(token)).status_code==404
    assert client.delete('/api/v1/invoices/'+inv,headers=headers(token)).status_code==404
    assert balances(client,user_token)[a]==980

def test_expired_access_expired_refresh_and_logout(client,db,test_user,user_token):
    expired=jwt.encode({'sub':str(test_user.id),'role':'ADMIN','type':'access','ver':test_user.token_version,'exp':datetime.now(timezone.utc)-timedelta(seconds=10)},settings.jwt_secret_key,algorithm=settings.jwt_algorithm)
    assert client.get('/api/v1/auth/me',headers=headers(expired)).status_code==401
    r=client.post('/api/v1/auth/login',json={'email':test_user.email,'password':'password123'}); assert r.status_code==200
    raw=r.json()['refresh_token']
    session=db.scalar(select(RefreshToken));session.expires_at=datetime.now(timezone.utc)-timedelta(days=1);db.commit()
    assert client.post('/api/v1/auth/refresh',json={'refresh_token':raw}).status_code==401
    r=client.post('/api/v1/auth/login',json={'email':test_user.email,'password':'password123'});raw=r.json()['refresh_token']
    assert client.post('/api/v1/auth/logout',json={'refresh_token':raw}).status_code in (200,204)
    assert client.post('/api/v1/auth/refresh',json={'refresh_token':raw}).status_code==401

def test_admin_permission_uses_database_not_claim(client,db,test_user,test_admin,user_token,admin_token):
    forged_role=create_access_token(str(test_user.id),'ADMIN',test_user.token_version)
    assert client.get('/api/v1/admin/users',headers=headers(forged_role)).status_code==403
    assert client.get('/api/v1/admin/users',headers=headers(admin_token)).status_code==200
    test_admin.role='USER';db.commit()
    assert client.get('/api/v1/admin/users',headers=headers(admin_token)).status_code==403

def queue_ocr(client,db,user_token):
    r=client.post('/api/v1/invoices',headers=headers(user_token),files={'file':('qa.png',BytesIO(b'\x89PNG\r\n\x1a\nqa'),'image/png')});assert r.status_code==201
    iid=r.json()['id'];assert client.post('/api/v1/invoices/'+iid+'/ocr',headers=headers(user_token)).status_code==202
    job=db.scalar(select(BackgroundJob).where(BackgroundJob.kind=='OCR'))
    return UUID(iid),job.id

@pytest.mark.parametrize('outcome',['success','timeout','bad_amount'])
def test_real_worker_ocr_success_or_dead_letter(client,db,user_token,outcome):
    iid,jid=queue_ocr(client,db,user_token)
    result={'ten_nguoi_ban':'QA Store','ngay_lap':'2026-10-08','doanh_so_chua_thue':'100000','tien_thue_gtgt':'10000','tong_thanh_toan':'110000','items':[{'ten_hang':'QA Item','so_luong':'1','don_gia':'100000','thanh_tien':'100000'}]}
    if outcome=='bad_amount':result['tong_thanh_toan']='-1'
    provider=AsyncMock(return_value=result,side_effect=TimeoutError('qa-provider-timeout') if outcome=='timeout' else None)
    sessions=sessionmaker(bind=db.bind,autoflush=False)
    with patch('app.chuc_nang.nguoi_dung.hoa_don_ai.ha_tang.gemini.run_gemini_ocr',provider):
        for _ in range(1 if outcome=='success' else 3):
            assert run_once(sessions,kinds={'OCR'})
            db.expire_all();job=db.get(BackgroundJob,jid)
            if job.status=='PENDING':job.available_at=now()-timedelta(seconds=1);db.commit()
    db.expire_all();job=db.get(BackgroundJob,jid);inv=db.get(Invoice,iid)
    assert job.status==('DONE' if outcome=='success' else 'DEAD')
    assert inv.status==('REVIEW_REQUIRED' if outcome=='success' else 'FAILED')
    if outcome=='success':
        assert inv.total_amount==110000 and inv.merchant_name=='QA Store'
        detail=client.get('/api/v1/invoices/'+str(iid),headers=headers(user_token)).json()
        assert len(detail['items'])==1 and detail['items'][0]['name']=='QA Item'
    else:assert provider.await_count==3

@pytest.mark.parametrize('outcome',['success','timeout','missing_config'])
def test_real_email_worker_with_smtp_transport_double(db,monkeypatch,outcome):
    from app.dung_chung.email import dich_vu as email
    from app.dung_chung.email.luu_tru.nhat_ky_email import EmailLog
    sessions=sessionmaker(bind=db.bind,autoflush=False)
    monkeypatch.setattr(email,'SessionLocal',sessions)
    monkeypatch.setattr(EmailService,'send_email_sync',REAL_SEND)
    cfg={'smtp_host':'qa.invalid','smtp_port':587,'smtp_user':'qa@example.com','smtp_password':'test-only','smtp_tls':True,'smtp_ssl':False,'emails_from_email':'qa@example.com','emails_from_name':'QA'}
    if outcome=='missing_config':cfg['smtp_password']=''
    monkeypatch.setattr(email,'_get_effective_smtp',lambda:cfg)
    smtp=MagicMock()
    if outcome=='timeout':smtp.return_value.__enter__.return_value.sendmail.side_effect=TimeoutError('sensitive-test-detail')
    monkeypatch.setattr(email.smtplib,'SMTP',smtp)
    job=enqueue(db,'EMAIL',{'function':'send_welcome_email','args':['qa-recipient@example.com','QA'],'kwargs':{}},'qa-smtp-'+outcome);db.commit();jid=job.id
    for _ in range(1 if outcome=='success' else 3):
        assert run_once(sessions,kinds={'EMAIL'})
        db.expire_all();job=db.get(BackgroundJob,jid)
        if job.status=='PENDING':job.available_at=now()-timedelta(seconds=1);db.commit()
    db.expire_all();job=db.get(BackgroundJob,jid)
    assert job.status==('DONE' if outcome=='success' else 'DEAD')
    logs=db.scalars(select(EmailLog)).all()
    assert len(logs)==(1 if outcome=='success' else 3)
    assert all(x.status==('SENT' if outcome=='success' else 'FAILED') for x in logs)
    assert 'sensitive-test-detail' not in str([x.error_message for x in logs])
