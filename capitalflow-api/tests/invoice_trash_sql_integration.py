"""SQL/HTTP retention checks in a rolled-back outer transaction; no real file purge."""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from datetime import timedelta
from decimal import Decimal
from uuid import uuid4
from fastapi import FastAPI, Request
from fastapi.testclient import TestClient
from sqlalchemy import select, func
from sqlalchemy.orm import Session
import app.dung_chung.database.dang_ky_mo_hinh
from app.dung_chung.database.ket_noi import engine
from app.dung_chung.http.phu_thuoc import get_db, get_current_user
from app.chuc_nang.nguoi_dung.dang_nhap.luu_tru.nguoi_dung import User
from app.chuc_nang.nguoi_dung.hoa_don_ai.luu_tru.invoice import Invoice
from app.chuc_nang.nguoi_dung.hoa_don_ai.luu_tru.invoice_item import InvoiceItem
from app.chuc_nang.nguoi_dung.tai_chinh.vi_tai_khoan.luu_tru.account import Account
from app.chuc_nang.nguoi_dung.tai_chinh.giao_dich.luu_tru.giao_dich import Transaction
from app.dung_chung.tac_vu_nen.luu_tru.tac_vu_nen import BackgroundJob
from app.dung_chung.tac_vu_nen.hang_doi import decode
from app.chuc_nang.nguoi_dung.hoa_don_ai.nghiep_vu.deletion import utc_now, safe_delete_invoice, purge_expired_invoices
from app.chuc_nang.nguoi_dung.hoa_don_ai.api.routes import router


def main():
    with engine.connect() as conn:
        before = conn.scalar(select(func.count()).select_from(Invoice)); conn.rollback()
        outer = conn.begin()
        uid, iid, aid, tid = (uuid4() for _ in range(4))
        def sessions():
            return Session(conn, join_transaction_mode='create_savepoint')
        try:
            with sessions() as db:
                db.add(User(id=uid, email=f'trash-{uid.hex}@example.invalid', full_name='Trash QA', password_hash='unusable', token_version=0)); db.flush()
                db.add(Account(id=aid, user_id=uid, name='QA', account_type='BASIC', balance=Decimal('123456'), currency='VND')); db.flush()
                inv=Invoice(id=iid,user_id=uid,status='REVIEW_REQUIRED',storage_key=f'qa-{iid}.jpg',original_filename='qa.jpg',revision=1)
                db.add(inv); db.flush()
                db.add(InvoiceItem(invoice_id=iid,line_no=1,name='QA',quantity=1,unit_price=10,line_total=10)); db.commit()
            app=FastAPI(); app.include_router(router,prefix='/api/v1')
            def db_override(request: Request):
                with sessions() as db:
                    db.info['request']=request; yield db
            app.dependency_overrides[get_db]=db_override
            app.dependency_overrides[get_current_user]=lambda:User(id=uid,token_version=0)
            with TestClient(app) as client:
                assert client.delete(f'/api/v1/invoices/{iid}').status_code==204
                detail=client.get(f'/api/v1/invoices/{iid}').json()
                assert detail['can_restore'] and detail['trash_expires_at'] and detail['items']
                with sessions() as db:
                    inv=db.get(Invoice,iid); first=inv.deleted_at
                    assert inv.storage_key==f'qa-{iid}.jpg'
                    assert db.scalar(select(BackgroundJob.id).where(BackgroundJob.dedupe_key==f'delete-file:qa-{iid}.jpg')) is None
                    safe_delete_invoice(db,inv);db.commit()
                    assert inv.deleted_at==first
                assert client.get('/api/v1/invoices?visibility=trash').json()['total']==1
                assert client.get('/api/v1/invoices?visibility=hidden').json()['total']==1
                assert client.get('/api/v1/invoices').json()['total']==0
                restored=client.post(f'/api/v1/invoices/{iid}/restore',json={'expected_revision':detail['revision']})
                assert restored.status_code==200 and restored.json()['requires_file'] is False
                assert client.get('/api/v1/invoices').json()['total']==1
                assert purge_expired_invoices(sessions, user_id=uid)==0
                copy_ids=[uuid4(),uuid4()]
                outsider, outsider_invoice=uuid4(),uuid4()
                with sessions() as db:
                    for copy_id in copy_ids:
                        db.add(Invoice(id=copy_id,user_id=uid,status='REVIEW_REQUIRED',revision=1,deleted_at=utc_now()))
                    db.add(User(id=outsider,email=f'trash-{outsider.hex}@example.invalid',full_name='QA other',password_hash='unusable',token_version=0));db.flush()
                    db.add(Invoice(id=outsider_invoice,user_id=outsider,status='REVIEW_REQUIRED',revision=1,deleted_at=utc_now()));db.commit()
                # A batch containing a restored/active invoice is atomic.
                mixed=client.post('/api/v1/invoices/batch-purge',json={'invoice_ids':[str(iid),str(copy_ids[0])]})
                assert mixed.status_code==409
                assert client.get(f'/api/v1/invoices/{copy_ids[0]}').status_code==200
                assert client.post('/api/v1/invoices/batch-purge',json={'invoice_ids':[]}).status_code==422
                assert client.post('/api/v1/invoices/batch-purge',json={'invoice_ids':[str(uuid4()) for _ in range(101)]}).status_code==422
                body={'invoice_ids':[str(i) for i in copy_ids]+[str(copy_ids[0]),str(outsider_invoice)]}
                purged=client.post('/api/v1/invoices/batch-purge',json=body)
                assert purged.status_code==200 and purged.json()['deleted']==2
                assert purged.json()['not_found']==[str(outsider_invoice)]
                assert client.post('/api/v1/invoices/batch-purge',json=body).json()['deleted']==0
                with sessions() as db:
                    assert db.get(Invoice,outsider_invoice) is not None
                print('PASS: manual bulk purge, deduplicated IDs, safe retry, owner scope, active invoice blocks entire batch, 100-item limit')
                print('PASS: trash retains source/items, no file-delete job, repeated delete preserves deadline, restore and legacy filter work')
                assert client.delete(f'/api/v1/invoices/{iid}').status_code==204
                with sessions() as db:
                    inv=db.get(Invoice,iid); inv.deleted_at=utc_now()-timedelta(days=30,seconds=1);db.commit()
                expired=client.get(f'/api/v1/invoices/{iid}').json()
                assert expired['can_restore'] is False
                assert client.post(f'/api/v1/invoices/{iid}/restore',json={'expected_revision':expired['revision']}).status_code==410
                assert client.get(f'/api/v1/invoices/{iid}/file').status_code==410
                print('PASS: expiry denies restore/file even before background sweep')
            # Restrict cleanup fixture to its owner, never sweep real users in tests.
            with sessions() as db:
                inv=db.get(Invoice,iid)
                db.add(Transaction(id=tid,user_id=uid,account_id=aid,invoice_id=iid,type='EXPENSE',amount=-10,transaction_date=utc_now().date()))
                db.commit()
            with TestClient(app) as client:
                single=client.post('/api/v1/invoices/batch-purge',json={'invoice_ids':[str(iid)]})
                assert single.status_code==200 and single.json()['deleted']==1
            assert purge_expired_invoices(sessions,user_id=uid)==0
            with sessions() as db:
                assert db.get(Invoice,iid) is None
                assert db.get(Transaction,tid).invoice_id is None
                assert db.get(Account,aid).balance==Decimal('123456')
                assert db.scalar(select(func.count()).select_from(InvoiceItem).where(InvoiceItem.invoice_id==iid))==0
                job=db.scalar(select(BackgroundJob).where(BackgroundJob.dedupe_key==f'delete-file:qa-{iid}.jpg'))
                assert job and decode(job)['storage_key']==f'qa-{iid}.jpg'
                print('PASS: permanent purge removes invoice/items, queues file deletion, preserves transaction and balance')
        finally:
            outer.rollback()
        assert conn.scalar(select(func.count()).select_from(Invoice))==before
        print('PASS: all test changes rolled back; no physical files deleted')

if __name__=='__main__': main()
