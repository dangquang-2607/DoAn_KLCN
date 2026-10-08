"""One authorized email via the real worker; all job/log writes stay in QA SQLite.
Requires --recipient and --send-once. Never drains production jobs.
"""
import argparse, json, logging
from pathlib import Path
from datetime import datetime, timezone
from unittest.mock import patch
from sqlalchemy import create_engine,event,select
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from app.dung_chung.database.dang_ky_mo_hinh import Base
from app.dung_chung.email import dich_vu as email
from app.dung_chung.email.luu_tru.nhat_ky_email import EmailLog
from app.dung_chung.tac_vu_nen.hang_doi import enqueue
from app.dung_chung.tac_vu_nen.trinh_chay import run_once
from app.dung_chung.tac_vu_nen.luu_tru.tac_vu_nen import BackgroundJob

def main():
    p=argparse.ArgumentParser();p.add_argument('--recipient',required=True);p.add_argument('--send-once',action='store_true',required=True);a=p.parse_args()
    root=Path(__file__).resolve().parent
    marker=root/'live-email-result.json'
    if marker.exists():raise SystemExit('Result already exists; refusing an accidental duplicate email.')
    # Read current SMTP configuration; credentials remain in memory and are not logged.
    cfg=email._get_effective_smtp()
    engine=create_engine('sqlite://',connect_args={'check_same_thread':False},poolclass=StaticPool)
    @event.listens_for(engine,'connect')
    def configure(conn,_):conn.create_function('sysutcdatetime',0,lambda:datetime.now(timezone.utc).replace(tzinfo=None).isoformat(' '))
    Base.metadata.create_all(engine);sessions=sessionmaker(bind=engine,autoflush=False)
    with sessions() as db:
        job=enqueue(db,'EMAIL',{'function':'send_test_email','args':[a.recipient],'kwargs':{'subject':'[CapitalFlow QA] Kiem thu nghiem thu 08-10-2026','message':'Email kiem thu duoc ban cho phep. Chi xac minh worker va SMTP; khong chua du lieu giao dich that.'}},'qa-live-email-20261008');db.commit();jid=job.id
    # Persist an attempt marker BEFORE network; a crash must not trigger an automatic resend.
    marker.write_text(json.dumps({'status':'ATTEMPT_STARTED','provider':'SMTP','recipient':'user-authorized, omitted'},indent=2),encoding='utf-8')
    logging.getLogger('capitalflow.email').setLevel(logging.CRITICAL)
    with patch.object(email,'_get_effective_smtp',return_value=cfg),patch.object(email,'SessionLocal',sessions):
        run_once(sessions,kinds={'EMAIL'})
    with sessions() as db:
        job=db.get(BackgroundJob,jid);logs=db.scalars(select(EmailLog)).all()
        result={'worker_status':job.status,'attempts':job.attempts,'error_code':job.error_code,'email_logs':[{'status':x.status,'error':x.error_message} for x in logs],'inbox_delivery':'requires recipient confirmation','production_database_writes':False}
    marker.write_text(json.dumps(result,indent=2),encoding='utf-8');print(json.dumps(result))

if __name__=='__main__':main()
