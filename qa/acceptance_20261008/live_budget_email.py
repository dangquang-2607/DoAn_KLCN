"""One authorized budget alert: synthetic records, real BUDGET/EMAIL workers/SMTP.
No production writes, no automatic network retry; marker prevents duplicate send.
"""
import argparse
import json
import logging
from pathlib import Path
from datetime import datetime, timezone, date
from decimal import Decimal
from unittest.mock import patch
from sqlalchemy import create_engine, event, select
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from app.dung_chung.database.dang_ky_mo_hinh import Base, User
from app.chuc_nang.nguoi_dung.tai_chinh.vi_tai_khoan.luu_tru.account import Account
from app.chuc_nang.nguoi_dung.tai_chinh.ngan_sach.luu_tru.ngan_sach import Budget
from app.chuc_nang.nguoi_dung.tai_chinh.giao_dich.luu_tru.giao_dich import Transaction
from app.dung_chung.email import dich_vu as email
from app.dung_chung.email.luu_tru.nhat_ky_email import EmailLog
from app.dung_chung.tac_vu_nen.hang_doi import enqueue
from app.dung_chung.tac_vu_nen.trinh_chay import run_once
from app.dung_chung.tac_vu_nen.luu_tru.tac_vu_nen import BackgroundJob

def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('--recipient',required=True)
    parser.add_argument('--send-once',action='store_true',required=True)
    args=parser.parse_args()
    marker=Path(__file__).with_name('live-budget-email-result.json')
    if marker.exists(): raise SystemExit('Attempt marker exists; do not resend.')
    cfg=email._get_effective_smtp()  # Read only; never print secrets.
    engine=create_engine('sqlite://',connect_args={'check_same_thread':False},poolclass=StaticPool)
    @event.listens_for(engine,'connect')
    def configure(conn,_): conn.create_function('sysutcdatetime',0,lambda:datetime.now(timezone.utc).replace(tzinfo=None).isoformat(' '))
    Base.metadata.create_all(engine)
    sessions=sessionmaker(bind=engine,autoflush=False)
    with sessions() as db:
        user=User(email=args.recipient,full_name='QA - Du lieu gia lap, khong phai chi tieu that',password_hash='disabled-qa-account',role='USER',is_active=True)
        db.add(user);db.flush()
        account=Account(user_id=user.id,name='QA synthetic wallet',account_type='CASH',balance=Decimal('880000'))
        budget=Budget(user_id=user.id,name='[CapitalFlow QA 08-10-2026] Ngan sach gia lap',amount_limit=Decimal('100000'),start_date=date(2026,10,1),end_date=date(2026,10,31))
        db.add_all([account,budget]);db.flush()
        txn=Transaction(user_id=user.id,account_id=account.id,description='QA synthetic expense',amount=Decimal('-120000'),type='EXPENSE',kind='NORMAL',transaction_date=date(2026,10,8))
        db.add(txn);db.flush()
        enqueue(db,'BUDGET',{'transaction_id':str(txn.id),'user_id':str(user.id)},'qa-live-budget-20261008')
        db.commit()
    # Budget worker only queues email; it cannot send it in this iteration.
    run_once(sessions,kinds={'BUDGET'})
    with sessions() as db:
        jobs=db.scalars(select(BackgroundJob)).all()
        assert len(jobs)==2 and sum(j.kind=='EMAIL' for j in jobs)==1
        assert next(j for j in jobs if j.kind=='BUDGET').status=='DONE'
    with marker.open('x',encoding='utf-8') as f:
        json.dump({'status':'ATTEMPT_STARTED','authorized_messages':1,'production_writes':False},f)
    logging.getLogger('capitalflow.email').setLevel(logging.CRITICAL)
    with patch.object(email,'_get_effective_smtp',return_value=cfg),patch.object(email,'SessionLocal',sessions):
        run_once(sessions,kinds={'EMAIL'})
    with sessions() as db:
        result={'jobs':[{'kind':j.kind,'status':j.status,'attempts':j.attempts,'error_code':j.error_code} for j in db.scalars(select(BackgroundJob))],
                'email_logs':[{'type':e.email_type,'status':e.status} for e in db.scalars(select(EmailLog))],
                'inbox_delivery':'awaiting recipient confirmation','production_writes':False,'synthetic_budget':100000,'synthetic_spent':120000}
    marker.write_text(json.dumps(result,indent=2),encoding='utf-8')
    print(json.dumps(result))

if __name__=='__main__': main()
