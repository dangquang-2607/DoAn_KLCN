"""One live OCR worker iteration, synthetic image, QA-only in-memory database."""
import os, json, logging
from pathlib import Path
from datetime import datetime, timezone
from cryptography.fernet import Fernet
ROOT = Path(__file__).resolve().parent
os.environ['DATABASE_URL'] = 'sqlite://'
os.environ['JOB_ENCRYPTION_KEY'] = Fernet.generate_key().decode()
os.environ['UPLOAD_DIR'] = str(ROOT)
from sqlalchemy import create_engine, event, select
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from app.dung_chung.config import settings
from app.dung_chung.database.dang_ky_mo_hinh import Base
from app.chuc_nang.nguoi_dung.dang_nhap.luu_tru.nguoi_dung import User
from app.chuc_nang.nguoi_dung.hoa_don_ai.luu_tru.invoice import Invoice
from app.chuc_nang.nguoi_dung.hoa_don_ai.luu_tru.invoice_item import InvoiceItem
from app.chuc_nang.nguoi_dung.hoa_don_ai.api.routes import _enqueue_ocr
from app.dung_chung.tac_vu_nen.trinh_chay import run_once
from app.dung_chung.tac_vu_nen.luu_tru.tac_vu_nen import BackgroundJob

def main():
    marker = ROOT / 'live-ocr-result.json'
    if marker.exists():
        raise SystemExit('Existing attempt marker: refusing duplicate live OCR.')
    if not settings.google_ai_api_key:
        marker.write_text(json.dumps({'status':'BLOCKED','reason':'missing provider configuration'}), encoding='utf-8')
        return
    engine = create_engine('sqlite://', poolclass=StaticPool)
    @event.listens_for(engine, 'connect')
    def setup(conn, _):
        conn.create_function('sysutcdatetime', 0, lambda: datetime.now(timezone.utc).replace(tzinfo=None).isoformat(' '))
        conn.execute('PRAGMA foreign_keys=ON')
    Base.metadata.create_all(engine)
    sessions = sessionmaker(bind=engine, autoflush=False)
    with sessions() as db:
        user = User(email='qa-ocr@example.com', full_name='Synthetic QA', password_hash='not-a-login', role='USER', is_active=True)
        db.add(user); db.flush()
        invoice = Invoice(user_id=user.id, storage_key='synthetic-invoice.png', mime_type='image/png', status='UPLOADED')
        db.add(invoice); db.flush()
        _enqueue_ocr(db, invoice.id, user.id); db.commit()
        iid = invoice.id
    marker.write_text(json.dumps({'status':'ATTEMPT_STARTED'}), encoding='utf-8')
    logging.getLogger('httpx').setLevel(logging.WARNING)
    run_once(sessions, kinds={'OCR'})
    with sessions() as db:
        job = db.scalar(select(BackgroundJob).where(BackgroundJob.kind=='OCR'))
        inv = db.get(Invoice, iid)
        lines = db.scalars(select(InvoiceItem).where(InvoiceItem.invoice_id==iid)).all()
        result = {'worker_status':job.status, 'attempts':job.attempts, 'error_code':job.error_code,
                  'invoice_status':inv.status, 'merchant':inv.merchant_name, 'invoice_date':str(inv.invoice_date),
                  'subtotal':str(inv.subtotal_amount), 'tax':str(inv.tax_amount), 'total':str(inv.total_amount),
                  'items':[{'name':i.name,'quantity':str(i.quantity),'unit_price':str(i.unit_price),'line_total':str(i.line_total)} for i in lines],
                  'synthetic_sample_only':True, 'production_database_writes':False}
    marker.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding='utf-8')
    print(json.dumps(result, ensure_ascii=False))

if __name__ == '__main__': main()
