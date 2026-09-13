"""Durable worker: bounded work, lease fencing, retry, and dead-letter state."""
import asyncio
import json
import time
from uuid import UUID
from pathlib import Path
from datetime import timedelta
from decimal import Decimal
from sqlalchemy import select, delete
from app.core.config import settings
from app.core.database import SessionLocal
from app.models.background_job import BackgroundJob
from app.models.invoice import Invoice
from app.models.invoice_item import InvoiceItem
from app.models.ocr_job import OcrJob
from app.models.transaction import Transaction
from app.services.jobs import claim, now


def storage_path(key):
    root=Path(settings.upload_dir).resolve()
    path=(root/key).resolve()
    if path.parent != root: raise ValueError("Invalid storage key")
    return path


def owns(db, job_id, lease):
    job=db.scalar(select(BackgroundJob).where(BackgroundJob.id==job_id).with_hint(
        BackgroundJob,"WITH (UPDLOCK, ROWLOCK)",dialect_name="mssql").execution_options(populate_existing=True))
    return job if job and job.status=="RUNNING" and job.lease_token==lease else None


def process_ocr(job_id, lease, payload, sessions):
    from app.services.gemini_service import run_gemini_ocr
    from app.api.routes.invoices import _parse_date, _parse_amount
    iid=UUID(payload["invoice_id"]);uid=UUID(payload["user_id"]);oid=UUID(payload["ocr_job_id"])
    with sessions() as db:
        invoice=db.scalar(select(Invoice).where(Invoice.id==iid,Invoice.user_id==uid))
        ocr=db.get(OcrJob,oid)
        if not invoice or not ocr or invoice.status != "PROCESSING":return
        key,mime=invoice.storage_key,invoice.mime_type
    # No database connection is held while reading files or awaiting the provider.
    with storage_path(key).open("rb") as source:
        data=source.read(10*1024*1024+1)
    if len(data)>10*1024*1024:raise ValueError("Oversized OCR file")
    async def bounded():return await asyncio.wait_for(run_gemini_ocr(data,mime),timeout=90)
    result=asyncio.run(bounded())
    if not isinstance(result,dict) or not isinstance(result.get("items",[]),list) or len(result.get("items",[]))>200:
        raise ValueError("Invalid OCR result")
    with sessions() as db:
        if not owns(db,job_id,lease):return
        invoice=db.scalar(select(Invoice).where(Invoice.id==iid,Invoice.user_id==uid).with_hint(Invoice,"WITH (UPDLOCK, ROWLOCK)",dialect_name="mssql"))
        ocr=db.get(OcrJob,oid)
        if not invoice or not ocr or invoice.status!="PROCESSING":return
        invoice.invoice_date=_parse_date(result.get("ngay_lap")) or invoice.invoice_date
        for field,key in (("subtotal_amount","doanh_so_chua_thue"),("tax_amount","tien_thue_gtgt"),("total_amount","tong_thanh_toan")):
            amount=_parse_amount(result.get(key))
            if not amount.is_finite() or amount<0 or amount>Decimal("99999999999999999.99"):raise ValueError("Invalid OCR amount")
            setattr(invoice,field,amount.quantize(Decimal("0.01")))
        invoice.merchant_name=str(result.get("ten_nguoi_ban") or result.get("ten_nguoi_ban_mua") or "")[:255]
        invoice.merchant_tax_code=str(result.get("ma_so_thue") or "")[:100]
        invoice.invoice_number=str(result.get("so_hoa_don") or "")[:100]
        invoice.extracted_json=json.dumps(result,ensure_ascii=False)
        invoice.status="REVIEW_REQUIRED"
        db.execute(delete(InvoiceItem).where(InvoiceItem.invoice_id==iid))
        for index,item in enumerate(result.get("items",[]),1):
            if not isinstance(item,dict):raise ValueError("Invalid OCR line")
            db.add(InvoiceItem(invoice_id=iid,line_no=index,name=str(item.get("ten_hang") or "Hàng hóa")[:500],
                               quantity=validated_amount(item.get("so_luong"), quantity=True),
                               unit_price=validated_amount(item.get("don_gia")),line_total=validated_amount(item.get("thanh_tien"))))
        ocr.status="COMPLETED";ocr.progress_percent=100;ocr.completed_at=now();ocr.response_json=invoice.extracted_json
        db.commit()


def validated_amount(value, quantity=False):
    from app.api.routes.invoices import _parse_amount
    amount = _parse_amount(value)
    limit = Decimal("99999999999999.9999" if quantity else "99999999999999999.99")
    if not amount.is_finite() or amount < 0 or amount > limit:
        raise ValueError("Invalid OCR line amount")
    return amount.quantize(Decimal("0.0001" if quantity else "0.01"))


def dispatch(job_id,lease,kind,payload,sessions):
    if kind=="OCR":return process_ocr(job_id,lease,payload,sessions)
    if kind=="EMAIL":
        from app.services.email_service import EmailService
        allowed={"send_welcome_email","send_password_reset_otp","send_budget_alert_email","send_account_created_by_admin_email","send_temporary_password_email","send_account_banned_email","send_account_unbanned_email","send_role_updated_email","send_test_email"}
        if payload["function"] not in allowed:raise ValueError("Unsupported email job")
        if not getattr(EmailService,payload["function"])(*payload["args"],**payload["kwargs"]):raise RuntimeError("Email delivery failed")
    elif kind=="FILE_DELETE":
        with sessions() as db:
            if db.scalar(select(Invoice.id).where(Invoice.storage_key==payload["storage_key"]).limit(1)):return
        storage_path(payload["storage_key"]).unlink(missing_ok=True)
    elif kind=="BUDGET":
        from app.services.transaction_service import check_budget_alerts_background
        with sessions() as db:
            if not owns(db,job_id,lease):return
            txn=db.get(Transaction,UUID(payload["transaction_id"]))
            if txn:check_budget_alerts_background(db,UUID(payload["user_id"]),txn)
            db.commit()
    else:raise ValueError("Unknown job kind")


def run_once(sessions=SessionLocal):
    with sessions() as db:
        work=claim(db)
    if not work:return False
    jid,lease,kind,payload=work
    error=None
    try:
        if payload.get("_invalid_payload"):
            raise ValueError("Invalid encrypted job payload")
        with sessions() as db:
            job = owns(db, jid, lease)
            if not job:return True
            if job.attempts > 3:raise RuntimeError("Retry limit exceeded")
        dispatch(jid,lease,kind,payload,sessions)
    except Exception as exc:error=type(exc).__name__
    with sessions() as db:
        job=owns(db,jid,lease)
        if not job:return True
        if error:
            job.error_code=error
            job.status="DEAD" if job.attempts>=3 else "PENDING"
            job.available_at=now()+timedelta(seconds=min(300,10*2**job.attempts))
            if job.status=="DEAD" and kind=="OCR" and not payload.get("_invalid_payload"):
                invoice=db.get(Invoice,UUID(payload["invoice_id"]));ocr=db.get(OcrJob,UUID(payload["ocr_job_id"]))
                if invoice and ocr and invoice.status=="PROCESSING":
                    invoice.status="FAILED";ocr.status="FAILED";ocr.error_code=error;ocr.completed_at=now()
        else:
            job.status="DONE";job.payload="";job.error_code=None
        job.lease_until=None;job.lease_token=None
        db.commit()
    return True


def main(argv=None):
    """Parse worker CLI arguments in one explicit scope."""
    import argparse

    parser = argparse.ArgumentParser()
    parser.add_argument("--once", action="store_true")
    args = parser.parse_args(argv)

    try:
        if args.once:
            run_once()
            return

        print("Worker started. Waiting for jobs; press Ctrl+C to stop.", flush=True)
        while True:
            try:
                if not run_once():
                    time.sleep(1)
            except Exception:
                # Back off if SQL Server is unavailable; never log payloads/secrets.
                time.sleep(5)
    except KeyboardInterrupt:
        # In-flight jobs remain recoverable through the existing lease mechanism.
        print("Worker stopped.", flush=True)


if __name__ == "__main__":
    main()
