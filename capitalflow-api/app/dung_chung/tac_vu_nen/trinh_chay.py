"""Worker bền vững với giới hạn công việc, khóa thuê, thử lại và trạng thái lỗi cuối."""
import asyncio
import json
import logging
import time
from uuid import UUID
from pathlib import Path
from datetime import datetime, timedelta
from decimal import Decimal
from sqlalchemy import select, delete
from sqlalchemy.orm import lazyload
from app.chuc_nang.nguoi_dung.hoa_don_ai.nghiep_vu.phan_tich_du_lieu import parse_amount, parse_date, draft_currency
from app.dung_chung.config import settings
from app.dung_chung.text.unicode import truncate_utf16
from app.dung_chung.database.session import SessionLocal
# A standalone worker has no FastAPI startup to register the complete schema.
# Load every FK target before its first OCR flush, regardless of prior job kinds.
import app.dung_chung.database.dang_ky_mo_hinh  # noqa: F401
from app.dung_chung.tac_vu_nen.luu_tru.tac_vu_nen import BackgroundJob
from app.chuc_nang.nguoi_dung.hoa_don_ai.luu_tru.invoice import Invoice
from app.chuc_nang.nguoi_dung.hoa_don_ai.luu_tru.invoice_item import InvoiceItem
from app.chuc_nang.nguoi_dung.hoa_don_ai.luu_tru.tac_vu_ocr import OcrJob
from app.chuc_nang.nguoi_dung.tai_chinh.giao_dich.luu_tru.giao_dich import Transaction
from app.chuc_nang.nguoi_dung.dang_nhap.luu_tru.nguoi_dung import User
from app.dung_chung.tac_vu_nen.hang_doi import claim, now
from app.dung_chung.email.dich_vu import EmailDeliveryUncertain
from app.dung_chung.email.luu_tru.nhat_ky_email import EmailLog

logger = logging.getLogger("capitalflow.worker")


def storage_path(key):
    root=Path(settings.upload_dir).resolve()
    path=(root/key).resolve()
    if path.parent != root: raise ValueError("Invalid storage key")
    return path


def owns(db, job_id, lease):
    job=db.scalar(select(BackgroundJob).where(BackgroundJob.id==job_id).with_hint(
        BackgroundJob,"WITH (UPDLOCK, ROWLOCK)",dialect_name="mssql").execution_options(populate_existing=True))
    return job if job and job.status=="RUNNING" and job.lease_token==lease else None


def ocr_identifiers(payload) -> tuple[UUID, UUID, UUID]:
    """Validate once before failure handling can reference OCR identifiers."""
    try:
        return (UUID(str(payload["invoice_id"])), UUID(str(payload["user_id"])),
                UUID(str(payload["ocr_job_id"])))
    except (KeyError, TypeError, ValueError) as exc:
        raise ValueError("Invalid OCR job identifiers") from exc


def current_ocr_target(invoice, ocr, user_id, revision):
    return bool(
        invoice and ocr and invoice.user_id == user_id and ocr.user_id == user_id
        and ocr.invoice_id == invoice.id and invoice.status == "PROCESSING"
        and ocr.status in {"QUEUED", "PROCESSING"}
        and not invoice.deleted_at and (revision is None or invoice.revision == revision)
    )


def process_ocr(job_id, lease, payload, sessions):
    from app.chuc_nang.nguoi_dung.hoa_don_ai.ha_tang.gemini import run_gemini_ocr
    iid,uid,oid=ocr_identifiers(payload)
    with sessions() as db:
        user=db.scalar(select(User).where(User.id==uid).with_hint(User,"WITH (UPDLOCK, ROWLOCK)",dialect_name="mssql"))
        if not user or not owns(db,job_id,lease):return
        invoice=db.scalar(select(Invoice).where(Invoice.id==iid,Invoice.user_id==uid))
        ocr=db.get(OcrJob,oid)
        if not current_ocr_target(invoice,ocr,uid,payload.get("invoice_revision")):return
        key,mime=invoice.storage_key,invoice.mime_type
        ocr.status="PROCESSING";ocr.started_at=now();ocr.completed_at=None
        ocr.processing_ms=None;ocr.progress_percent=10;ocr.attempt_count+=1
        db.commit()
    # Không giữ kết nối CSDL trong lúc đọc file hoặc chờ nhà cung cấp bên ngoài.
    with storage_path(key).open("rb") as source:
        data=source.read(10*1024*1024+1)
    if len(data)>10*1024*1024:raise ValueError("Oversized OCR file")
    async def bounded():return await asyncio.wait_for(run_gemini_ocr(data,mime),timeout=90)
    result=asyncio.run(bounded())
    if not isinstance(result,dict) or not isinstance(result.get("items",[]),list) or len(result.get("items",[]))>200:
        raise ValueError("Invalid OCR result")
    with sessions() as db:
        user=db.scalar(select(User).where(User.id==uid).with_hint(User,"WITH (UPDLOCK, ROWLOCK)",dialect_name="mssql").execution_options(populate_existing=True))
        if not user:return
        if not owns(db,job_id,lease):return
        invoice=db.scalar(select(Invoice).where(Invoice.id==iid,Invoice.user_id==uid).with_hint(Invoice,"WITH (UPDLOCK, ROWLOCK)",dialect_name="mssql"))
        ocr=db.get(OcrJob,oid)
        if not current_ocr_target(invoice,ocr,uid,payload.get("invoice_revision")):return
        invoice.currency = draft_currency(result.get("tien_te"))
        invoice.invoice_date=parse_date(result.get("ngay_lap")) or invoice.invoice_date
        for field,key in (("subtotal_amount","doanh_so_chua_thue"),("tax_amount","tien_thue_gtgt"),("total_amount","tong_thanh_toan")):
            amount=parse_amount(result.get(key))
            if not amount.is_finite() or amount<0 or amount>Decimal("99999999999999999.99"):raise ValueError("Invalid OCR amount")
            setattr(invoice,field,amount.quantize(Decimal("0.01")))
        invoice.merchant_name=truncate_utf16(str(result.get("ten_nguoi_ban") or result.get("ten_nguoi_ban_mua") or ""), 255)
        invoice.merchant_address=truncate_utf16(str(result.get("dia_chi_nguoi_ban") or ""), 500)
        invoice.merchant_tax_code=truncate_utf16(str(result.get("ma_so_thue") or ""), 100)
        invoice.invoice_number=truncate_utf16(str(result.get("so_hoa_don") or ""), 100)
        invoice.invoice_symbol=truncate_utf16(str(result.get("mau_so_ky_hieu") or ""), 100)
        invoice.vat_rate=truncate_utf16(str(result.get("thue_suat_gtgt") or ""), 50)
        invoice.payment_method=truncate_utf16(str(result.get("hinh_thuc_thanh_toan") or ""), 50)
        invoice.ocr_confidence=validated_confidence(result.get("do_tin_cay"))
        invoice.extracted_json=json.dumps(result,ensure_ascii=False)
        from app.chuc_nang.nguoi_dung.hoa_don_ai.nghiep_vu.chuan_hoa_hoa_don import refresh_identity, parse_invoice_time
        invoice.invoice_time = parse_invoice_time(result.get("gio_lap"))
        refresh_identity(invoice)
        invoice.revision += 1
        invoice.status="REVIEW_REQUIRED"
        db.execute(delete(InvoiceItem).where(InvoiceItem.invoice_id==iid))
        for index,item in enumerate(result.get("items",[]),1):
            if not isinstance(item,dict):raise ValueError("Invalid OCR line")
            db.add(InvoiceItem(
                invoice_id=iid,
                line_no=index,
                name=truncate_utf16(str(item.get("ten_hang") or "Hàng hóa"), 500),
                sku=truncate_utf16(str(item.get("ma_hang") or ""), 100) or None,
                unit=truncate_utf16(str(item.get("don_vi") or ""), 50) or None,
                quantity=validated_amount(item.get("so_luong"), quantity=True),
                unit_price=validated_amount(item.get("don_gia")),
                discount_amount=validated_amount(item.get("giam_gia")),
                tax_amount=validated_amount(item.get("thue")),
                line_total=validated_amount(item.get("thanh_tien")),
                confidence=validated_confidence(item.get("do_tin_cay")),
                raw_text=truncate_utf16(str(item.get("raw_text") or ""), 1000) or None,
            ))
        completed_at=now()
        ocr.status="COMPLETED";ocr.progress_percent=100;ocr.completed_at=completed_at;ocr.response_json=invoice.extracted_json
        from app.chuc_nang.nguoi_dung.goi_dich_vu.han_muc import consume_ai
        consume_ai(db, oid)
        if ocr.started_at:
            ocr.processing_ms=max(0,int((completed_at-ocr.started_at).total_seconds()*1000))
        db.commit()


def validated_amount(value, quantity=False):
    if quantity:
        raw = str(value or "0").strip().replace(" ", "").replace(",", ".")
        if len(raw) > 32 or not raw or not all(char.isdigit() or char in {".", "-"} for char in raw):
            raise ValueError("Invalid OCR quantity")
        try:
            amount = Decimal(raw)
        except Exception as exc:
            raise ValueError("Invalid OCR quantity") from exc
    else:
        amount = parse_amount(value)
    limit = Decimal("99999999999999.9999" if quantity else "99999999999999999.99")
    if not amount.is_finite() or amount < 0 or amount > limit:
        raise ValueError("Invalid OCR line amount")
    return amount.quantize(Decimal("0.0001" if quantity else "0.01"))


def validated_confidence(value):
    if value in (None, ""):
        return None
    try:
        confidence = Decimal(str(value))
    except Exception as exc:
        raise ValueError("Invalid OCR confidence") from exc
    if not confidence.is_finite() or confidence < 0 or confidence > 1:
        raise ValueError("Invalid OCR confidence")
    return confidence.quantize(Decimal("0.0001"))


def dispatch(job_id,lease,kind,payload,sessions):
    if kind=="BILLING":
        from app.chuc_nang.nguoi_dung.goi_dich_vu.dich_vu import reconcile_in_background
        return reconcile_in_background(payload, sessions)
    if kind=="OCR":return process_ocr(job_id,lease,payload,sessions)
    if kind=="EMAIL":
        from app.dung_chung.email.dich_vu import EmailService
        allowed={"send_welcome_email","send_password_reset_otp","send_budget_alert_email","send_temporary_password_email","send_account_banned_email","send_account_unbanned_email","send_role_updated_email","send_test_email","send_support_reply"}
        if payload["function"] not in allowed:raise ValueError("Unsupported email job")
        with EmailService.delivery_job(job_id):
            if not getattr(EmailService,payload["function"])(*payload["args"],**payload["kwargs"]):raise RuntimeError("Email delivery failed")
    elif kind=="FILE_DELETE":
        with sessions() as db:
            if db.scalar(select(Invoice.id).where(Invoice.storage_key==payload["storage_key"]).limit(1)):return
        storage_path(payload["storage_key"]).unlink(missing_ok=True)
    elif kind=="BUDGET":
        from app.chuc_nang.nguoi_dung.tai_chinh.giao_dich.so_cai import check_budget_alerts_background
        with sessions() as db:
            if not owns(db,job_id,lease):return
            txn=db.get(Transaction,UUID(payload["transaction_id"]))
            if txn and txn.user_id != UUID(payload["user_id"]):
                return
            if txn and txn.type == "EXPENSE" and txn.include_in_reports:
                from datetime import datetime, time as calendar_time
                from app.chuc_nang.nguoi_dung.tai_chinh.ngan_sach.ky_han import today_vn
                day = txn.transaction_date.date() if hasattr(txn.transaction_date, 'date') else txn.transaction_date
                if day > today_vn():
                    return datetime.combine(day, calendar_time.min) - timedelta(hours=7)
            if txn:check_budget_alerts_background(db,UUID(payload["user_id"]),txn)
            db.commit()
    else:raise ValueError("Unknown job kind")


def run_once(sessions=SessionLocal, kinds=None):
    with sessions() as db:
        work=claim(db, kinds=kinds)
    if not work:return False
    jid,lease,kind,payload=work
    started = time.perf_counter()
    error=None
    result=None
    ocr_ids: tuple[UUID, UUID, UUID] | None = None
    stop_retry=False
    try:
        if payload.get("_invalid_payload"):
            raise ValueError("Invalid encrypted job payload")
        if kind == "OCR":
            ocr_ids=ocr_identifiers(payload)
        with sessions() as db:
            job = owns(db, jid, lease)
            if not job:return True
            if job.attempts > 3:raise RuntimeError("Retry limit exceeded")
        result=dispatch(jid,lease,kind,payload,sessions)
    except Exception as exc:
        error=type(exc).__name__
        stop_retry=kind=="EMAIL" and isinstance(exc,EmailDeliveryUncertain)
    with sessions() as db:
        if ocr_ids:
            iid,uid,oid=ocr_ids
            db.scalar(select(User).where(User.id == uid)
                .with_hint(User, "WITH (UPDLOCK, ROWLOCK)", dialect_name="mssql"))
        job=owns(db,jid,lease)
        if not job:return True
        if not error and isinstance(result, datetime):
            job.status="PENDING";job.available_at=result;job.attempts=0
            job.lease_until=None;job.lease_token=None
            db.commit();return True
        if not error and result=="RESCHEDULE":
            job.status="PENDING";job.available_at=now();job.attempts=0
            job.lease_until=None;job.lease_token=None
            db.commit();return True
        if error:
            job.error_code=error
            job.status="DEAD" if stop_retry or job.attempts>=3 else "PENDING"
            if stop_retry:
                delivery=db.scalar(select(EmailLog).options(lazyload(EmailLog.user)).where(EmailLog.id==jid))
                if delivery and delivery.status not in {"SENT","LOGGED_DEV"}:
                    delivery.status="UNKNOWN"
                    delivery.error_message="DELIVERY_UNCONFIRMED"
            job.available_at=now()+timedelta(seconds=min(300,10*2**job.attempts))
            if job.status=="DEAD" and ocr_ids:
                iid,uid,oid=ocr_ids
                invoice=db.scalar(select(Invoice).where(Invoice.id == iid,Invoice.user_id == uid)
                    .with_hint(Invoice, "WITH (UPDLOCK, ROWLOCK)", dialect_name="mssql"))
                ocr=db.get(OcrJob,oid)
                if invoice is not None and ocr is not None and current_ocr_target(invoice,ocr,uid,payload.get("invoice_revision")):
                    completed_at=now()
                    invoice.status="FAILED";ocr.status="FAILED";ocr.error_code=error;ocr.completed_at=completed_at
                    invoice.revision += 1
                    if ocr.started_at:
                        ocr.processing_ms=max(0,int((completed_at-ocr.started_at).total_seconds()*1000))
        else:
            job.status="DONE";job.payload="";job.error_code=None
        job.lease_until=None;job.lease_token=None
        db.commit()
        if kind == "OCR":
            logger.log(
                logging.WARNING if error else logging.INFO,
                "ocr_worker_attempt status=%s attempt=%d error=%s elapsed_ms=%d",
                job.status, job.attempts, error or "none",
                int((time.perf_counter() - started) * 1000),
            )
    return True


def main(argv=None):
    """Phân tích tham số CLI của worker trong một phạm vi tường minh."""
    import argparse

    parser = argparse.ArgumentParser()
    parser.add_argument("--once", action="store_true")
    parser.add_argument(
        "--kinds",
        # Chuỗi CLI giữ ASCII để hoạt động trên terminal Windows dùng bảng mã cp1252.
        help="Comma-separated job kinds handled by this worker lane",
    )
    args = parser.parse_args(argv)
    logging.basicConfig(level=logging.INFO,
                        format="%(asctime)s %(levelname)s %(name)s %(message)s")
    allowed_kinds = {"OCR", "EMAIL", "FILE_DELETE", "BUDGET", "BILLING"}
    kinds = {value.strip().upper() for value in (args.kinds or "").split(",") if value.strip()}
    unknown = kinds - allowed_kinds
    if unknown:
        parser.error(f"unsupported job kinds: {', '.join(sorted(unknown))}")

    try:
        if args.once:
            if not kinds or 'OCR' in kinds:
                from app.chuc_nang.nguoi_dung.hoa_don_ai.nghiep_vu.kiem_tra_tai_len import recover_interrupted_uploads
                recover_interrupted_uploads(SessionLocal)
            if not kinds or 'FILE_DELETE' in kinds:
                from app.chuc_nang.nguoi_dung.hoa_don_ai.nghiep_vu.deletion import purge_expired_invoices
                purge_expired_invoices(SessionLocal)
            run_once() if not kinds else run_once(kinds=kinds)
            return

        lane = ",".join(sorted(kinds)) if kinds else "ALL"
        print(f"Worker started for {lane}. Waiting for jobs; press Ctrl+C to stop.", flush=True)
        next_trash_sweep = 0
        next_upload_sweep = 0
        while True:
            try:
                if (not kinds or 'OCR' in kinds) and time.monotonic() >= next_upload_sweep:
                    from app.chuc_nang.nguoi_dung.hoa_don_ai.nghiep_vu.kiem_tra_tai_len import recover_interrupted_uploads
                    recover_interrupted_uploads(SessionLocal)
                    next_upload_sweep = time.monotonic() + 60
                if (not kinds or 'FILE_DELETE' in kinds) and time.monotonic() >= next_trash_sweep:
                    from app.chuc_nang.nguoi_dung.hoa_don_ai.nghiep_vu.deletion import purge_expired_invoices
                    purge_expired_invoices(SessionLocal)
                    next_trash_sweep = time.monotonic() + 60
                processed = run_once() if not kinds else run_once(kinds=kinds)
                if not processed:
                    time.sleep(1)
            except Exception:
                # Tạm lùi khi SQL Server không khả dụng; tuyệt đối không log payload/bí mật.
                time.sleep(5)
    except KeyboardInterrupt:
        # Job đang chạy vẫn có thể được phục hồi nhờ cơ chế lease hiện hữu.
        print("Worker stopped.", flush=True)


if __name__ == "__main__":
    main()
