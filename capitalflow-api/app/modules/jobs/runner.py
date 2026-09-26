"""Worker bền vững với giới hạn công việc, khóa thuê, thử lại và trạng thái lỗi cuối."""
import asyncio
import json
import time
from uuid import UUID
from pathlib import Path
from datetime import timedelta
from decimal import Decimal
from sqlalchemy import select, delete, func
from app.shared.config import settings
from app.shared.database.session import SessionLocal
from app.modules.jobs.persistence.background_job import BackgroundJob
from app.modules.hoadon.persistence.invoice import Invoice
from app.modules.hoadon.persistence.invoice_item import InvoiceItem
from app.modules.hoadon.persistence.ocr_job import OcrJob
from app.modules.taichinh.persistence.transaction import Transaction
from app.modules.dangnhap.persistence.user import User
from app.modules.admin.persistence.user_deletion import UserDeletionFile, UserDeletionRequest
from app.modules.jobs.queue import claim, now


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
    from app.modules.hoadon.infrastructure.gemini import run_gemini_ocr
    from app.modules.hoadon.api.routes import _parse_date, _parse_amount
    iid=UUID(payload["invoice_id"]);uid=UUID(payload["user_id"]);oid=UUID(payload["ocr_job_id"])
    with sessions() as db:
        user=db.get(User,uid)
        invoice=db.scalar(select(Invoice).where(Invoice.id==iid,Invoice.user_id==uid))
        ocr=db.get(OcrJob,oid)
        if not user or user.is_deleted or not invoice or not ocr or invoice.status != "PROCESSING":return
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
        if not owns(db,job_id,lease):return
        user=db.scalar(select(User).where(User.id==uid).with_hint(User,"WITH (UPDLOCK, ROWLOCK)",dialect_name="mssql").execution_options(populate_existing=True))
        if not user or user.is_deleted:return
        invoice=db.scalar(select(Invoice).where(Invoice.id==iid,Invoice.user_id==uid).with_hint(Invoice,"WITH (UPDLOCK, ROWLOCK)",dialect_name="mssql"))
        ocr=db.get(OcrJob,oid)
        if not invoice or not ocr or invoice.status!="PROCESSING":return
        invoice.invoice_date=_parse_date(result.get("ngay_lap")) or invoice.invoice_date
        for field,key in (("subtotal_amount","doanh_so_chua_thue"),("tax_amount","tien_thue_gtgt"),("total_amount","tong_thanh_toan")):
            amount=_parse_amount(result.get(key))
            if not amount.is_finite() or amount<0 or amount>Decimal("99999999999999999.99"):raise ValueError("Invalid OCR amount")
            setattr(invoice,field,amount.quantize(Decimal("0.01")))
        invoice.merchant_name=str(result.get("ten_nguoi_ban") or result.get("ten_nguoi_ban_mua") or "")[:255]
        invoice.merchant_address=str(result.get("dia_chi_nguoi_ban") or "")[:500]
        invoice.merchant_tax_code=str(result.get("ma_so_thue") or "")[:100]
        invoice.invoice_number=str(result.get("so_hoa_don") or "")[:100]
        invoice.invoice_symbol=str(result.get("mau_so_ky_hieu") or "")[:100]
        invoice.vat_rate=str(result.get("thue_suat_gtgt") or "")[:50]
        invoice.payment_method=str(result.get("hinh_thuc_thanh_toan") or "")[:50]
        invoice.ocr_confidence=validated_confidence(result.get("do_tin_cay"))
        invoice.extracted_json=json.dumps(result,ensure_ascii=False)
        invoice.status="REVIEW_REQUIRED"
        db.execute(delete(InvoiceItem).where(InvoiceItem.invoice_id==iid))
        for index,item in enumerate(result.get("items",[]),1):
            if not isinstance(item,dict):raise ValueError("Invalid OCR line")
            db.add(InvoiceItem(
                invoice_id=iid,
                line_no=index,
                name=str(item.get("ten_hang") or "Hàng hóa")[:500],
                sku=str(item.get("ma_hang") or "")[:100] or None,
                unit=str(item.get("don_vi") or "")[:50] or None,
                quantity=validated_amount(item.get("so_luong"), quantity=True),
                unit_price=validated_amount(item.get("don_gia")),
                discount_amount=validated_amount(item.get("giam_gia")),
                tax_amount=validated_amount(item.get("thue")),
                line_total=validated_amount(item.get("thanh_tien")),
                confidence=validated_confidence(item.get("do_tin_cay")),
                raw_text=str(item.get("raw_text") or "")[:1000] or None,
            ))
        completed_at=now()
        ocr.status="COMPLETED";ocr.progress_percent=100;ocr.completed_at=completed_at;ocr.response_json=invoice.extracted_json
        if ocr.started_at:
            ocr.processing_ms=max(0,int((completed_at-ocr.started_at).total_seconds()*1000))
        db.commit()


def validated_amount(value, quantity=False):
    from app.modules.hoadon.api.routes import _parse_amount
    if quantity:
        raw = str(value or "0").strip().replace(" ", "").replace(",", ".")
        if len(raw) > 32 or not raw or not all(char.isdigit() or char in {".", "-"} for char in raw):
            raise ValueError("Invalid OCR quantity")
        try:
            amount = Decimal(raw)
        except Exception as exc:
            raise ValueError("Invalid OCR quantity") from exc
    else:
        amount = _parse_amount(value)
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


def process_user_file_purge(job_id, lease, payload, sessions):
    request_id=UUID(payload["request_id"])
    with sessions() as db:
        if not owns(db,job_id,lease):return None
        request=db.scalar(select(UserDeletionRequest).where(UserDeletionRequest.id==request_id).with_hint(
            UserDeletionRequest,"WITH (UPDLOCK, ROWLOCK)",dialect_name="mssql").execution_options(populate_existing=True))
        if not request or request.status=="COMPLETE":return None
        rows=db.scalars(select(UserDeletionFile).where(
            UserDeletionFile.request_id==request_id,UserDeletionFile.status=="PENDING"
        ).order_by(UserDeletionFile.id).limit(50)).all()
        work=[(row.id,row.storage_key) for row in rows]

    outcomes=[]
    for file_id,key in work:
        try:
            with sessions() as db:
                referenced=bool(db.scalar(select(Invoice.id).where(Invoice.storage_key==key).limit(1)))
            if referenced:
                outcomes.append((file_id,"SKIPPED_REFERENCE",None))
            else:
                storage_path(key).unlink(missing_ok=True)
                outcomes.append((file_id,"DONE",None))
        except Exception as exc:
            outcomes.append((file_id,"ERROR",type(exc).__name__))

    with sessions() as db:
        if not owns(db,job_id,lease):return None
        request=db.scalar(select(UserDeletionRequest).where(UserDeletionRequest.id==request_id).with_hint(
            UserDeletionRequest,"WITH (UPDLOCK, ROWLOCK)",dialect_name="mssql").execution_options(populate_existing=True))
        if not request:return None
        for file_id,status,error_code in outcomes:
            row=db.scalar(select(UserDeletionFile).where(UserDeletionFile.id==file_id).with_hint(
                UserDeletionFile,"WITH (UPDLOCK, ROWLOCK)",dialect_name="mssql").execution_options(populate_existing=True))
            if not row or row.status!="PENDING":continue
            row.attempts+=1
            if status in {"DONE","SKIPPED_REFERENCE"}:
                row.status=status;row.error_code=None;row.deleted_at=now()
            elif row.attempts>=3:
                row.status="FAILED";row.error_code=(error_code or "FILE_DELETE_FAILED")[:100]
            else:
                row.error_code=(error_code or "FILE_DELETE_FAILED")[:100]

        db.flush()
        pending=db.scalar(select(func.count(UserDeletionFile.id)).where(
            UserDeletionFile.request_id==request_id,UserDeletionFile.status=="PENDING")) or 0
        failed=db.scalar(select(func.count(UserDeletionFile.id)).where(
            UserDeletionFile.request_id==request_id,UserDeletionFile.status=="FAILED")) or 0
        request.files_deleted=db.scalar(select(func.count(UserDeletionFile.id)).where(
            UserDeletionFile.request_id==request_id,UserDeletionFile.status.in_(["DONE","SKIPPED_REFERENCE"]))) or 0
        request.updated_at=now()
        if pending:
            db.commit();return "RESCHEDULE"
        if failed:
            request.status="FAILED";request.error_code="FILE_DELETE_FAILED"
        else:
            request.status="COMPLETE";request.purge_checkpoint="COMPLETE";request.completed_at=now();request.error_code=None
        db.commit()
    return None


def dispatch(job_id,lease,kind,payload,sessions):
    if kind=="OCR":return process_ocr(job_id,lease,payload,sessions)
    if kind=="EMAIL":
        from app.modules.email.service import EmailService
        allowed={"send_welcome_email","send_password_reset_otp","send_budget_alert_email","send_account_created_by_admin_email","send_temporary_password_email","send_account_banned_email","send_account_unbanned_email","send_role_updated_email","send_account_deleted_email","send_account_restored_email","send_test_email"}
        if payload["function"] not in allowed:raise ValueError("Unsupported email job")
        if not getattr(EmailService,payload["function"])(*payload["args"],**payload["kwargs"]):raise RuntimeError("Email delivery failed")
    elif kind=="FILE_DELETE":
        with sessions() as db:
            if db.scalar(select(Invoice.id).where(Invoice.storage_key==payload["storage_key"]).limit(1)):return
        storage_path(payload["storage_key"]).unlink(missing_ok=True)
    elif kind=="BUDGET":
        from app.modules.taichinh.ledger import check_budget_alerts_background
        with sessions() as db:
            if not owns(db,job_id,lease):return
            txn=db.get(Transaction,UUID(payload["transaction_id"]))
            if txn:check_budget_alerts_background(db,UUID(payload["user_id"]),txn)
            db.commit()
    elif kind=="USER_PURGE":
        from app.modules.admin.user_lifecycle.service import purge_user_database
        with sessions() as db:
            if not owns(db,job_id,lease):return
            purge_user_database(db,UUID(payload["request_id"]),job_id)
            db.commit()
    elif kind=="USER_FILE_PURGE":
        return process_user_file_purge(job_id,lease,payload,sessions)
    else:raise ValueError("Unknown job kind")


def run_once(sessions=SessionLocal, kinds=None):
    with sessions() as db:
        work=claim(db, kinds=kinds)
    if not work:return False
    jid,lease,kind,payload=work
    error=None
    result=None
    try:
        if payload.get("_invalid_payload"):
            raise ValueError("Invalid encrypted job payload")
        with sessions() as db:
            job = owns(db, jid, lease)
            if not job:return True
            if job.attempts > 3:raise RuntimeError("Retry limit exceeded")
        result=dispatch(jid,lease,kind,payload,sessions)
    except Exception as exc:error=type(exc).__name__
    with sessions() as db:
        job=owns(db,jid,lease)
        if not job:return True
        if not error and result=="RESCHEDULE":
            job.status="PENDING";job.available_at=now();job.attempts=0
            job.lease_until=None;job.lease_token=None
            db.commit();return True
        if error:
            job.error_code=error
            job.status="DEAD" if job.attempts>=3 else "PENDING"
            job.available_at=now()+timedelta(seconds=min(300,10*2**job.attempts))
            if job.status=="DEAD" and kind=="OCR" and not payload.get("_invalid_payload"):
                invoice=db.get(Invoice,UUID(str(payload["invoice_id"])));ocr=db.get(OcrJob,UUID(str(payload["ocr_job_id"])))
                if invoice and ocr and invoice.status=="PROCESSING":
                    completed_at=now()
                    invoice.status="FAILED";ocr.status="FAILED";ocr.error_code=error;ocr.completed_at=completed_at
                    if ocr.started_at:
                        ocr.processing_ms=max(0,int((completed_at-ocr.started_at).total_seconds()*1000))
            if job.status=="DEAD" and kind in {"USER_PURGE","USER_FILE_PURGE"} and not payload.get("_invalid_payload"):
                from app.modules.admin.user_lifecycle.service import mark_purge_failed
                mark_purge_failed(db,UUID(str(payload["request_id"])),error)
            if job.status=="DEAD" and kind=="EMAIL" and payload.get("function")=="send_account_deleted_email":
                # Đã hết ngân sách retry; không giữ địa chỉ đã xóa vô thời hạn trong
                # payload dead-letter dù payload đang được mã hóa.
                job.payload=""
        else:
            job.status="DONE";job.payload="";job.error_code=None
        job.lease_until=None;job.lease_token=None
        db.commit()
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
    allowed_kinds = {"OCR", "EMAIL", "FILE_DELETE", "BUDGET", "USER_PURGE", "USER_FILE_PURGE"}
    kinds = {value.strip().upper() for value in (args.kinds or "").split(",") if value.strip()}
    unknown = kinds - allowed_kinds
    if unknown:
        parser.error(f"unsupported job kinds: {', '.join(sorted(unknown))}")

    try:
        if args.once:
            run_once() if not kinds else run_once(kinds=kinds)
            return

        lane = ",".join(sorted(kinds)) if kinds else "ALL"
        print(f"Worker started for {lane}. Waiting for jobs; press Ctrl+C to stop.", flush=True)
        while True:
            try:
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
