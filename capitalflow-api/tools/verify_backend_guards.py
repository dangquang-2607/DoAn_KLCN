"""Regression for nullable backend data; SQLite in memory and mocked SMTP only."""
from datetime import date, datetime, timedelta
from pathlib import Path
from smtplib import SMTPServerDisconnected
from unittest.mock import patch
from uuid import uuid4
import sys

from cryptography.fernet import Fernet
from pydantic import ValidationError
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import app.dung_chung.database.dang_ky_mo_hinh
from app.chuc_nang.nguoi_dung.dang_nhap.luu_tru.nguoi_dung import User
from app.chuc_nang.nguoi_dung.hoa_don_ai.luu_tru.invoice import Invoice
from app.chuc_nang.nguoi_dung.hoa_don_ai.luu_tru.tac_vu_ocr import OcrJob
from app.chuc_nang.nguoi_dung.tai_chinh.giao_dich.bookkeeping import RecordCreate
from app.chuc_nang.quan_tri.nhat_ky_quan_tri.api import safe_json
from app.dung_chung.config import settings
from app.dung_chung.database.nen_tang import Base
from app.dung_chung.email.dich_vu import EmailDeliveryUncertain, EmailService, _delivery_job_id
from app.dung_chung.email.luu_tru.nhat_ky_email import EmailLog
from app.dung_chung.tac_vu_nen.hang_doi import enqueue, now
from app.dung_chung.tac_vu_nen.luu_tru.tac_vu_nen import BackgroundJob
from app.dung_chung.tac_vu_nen.trinh_chay import run_once


def verify_text():
    data = {"amount": "1000", "type": "EXPENSE", "transaction_date": date.today()}
    assert RecordCreate(**data, description="a" * 255, note="😀" * 500).note
    for field, value in (("description", "😀" * 128), ("note", "😀" * 501)):
        try:
            RecordCreate.model_validate({**data, field: value})
        except ValidationError:
            pass
        else:
            raise AssertionError("Oversized NVARCHAR content was accepted")
    assert safe_json('"plain text"') == "[Nội dung văn bản đã ẩn]"
    assert safe_json('["USER", "free text"]') == ["[Nội dung văn bản đã ẩn]"] * 2
    assert safe_json('{"role":"ADMIN","token":"secret","note":"private"}') == {
        "role": "ADMIN", "token": "[Đã ẩn]", "note": "[Nội dung văn bản đã ẩn]",
    }


def verify_ocr(sessions):
    with sessions() as db:
        owner = User(email="guards@example.test", full_name="Guard test", password_hash="fake")
        db.add(owner)
        db.commit()
        user_id = owner.id
    for case in ("terminal", "missing_invoice", "missing_ocr", "stale_revision", "invalid_ids", "retry"):
        iid, oid = uuid4(), uuid4()
        with sessions() as db:
            if case != "missing_invoice":
                db.add(Invoice(id=iid, user_id=user_id, status="PROCESSING", revision=1))
                db.flush()
            if case != "missing_ocr":
                db.add(OcrJob(id=oid, user_id=user_id, invoice_id=iid if case != "missing_invoice" else None,
                              status="PROCESSING", started_at=now() - timedelta(seconds=2)))
            payload = {"invoice_id": str(iid), "user_id": str(user_id), "ocr_job_id": str(oid),
                       "invoice_revision": 2 if case == "stale_revision" else 1}
            if case == "invalid_ids":
                payload.pop("invoice_id")
            job = enqueue(db, "OCR", payload)
            job.attempts = 0 if case == "retry" else 2
            job_id = job.id
            db.commit()
        with patch("app.dung_chung.tac_vu_nen.trinh_chay.dispatch", side_effect=ValueError("Mock OCR failure")):
            assert run_once(sessions, kinds={"OCR"})
        with sessions() as db:
            job = db.get(BackgroundJob, job_id)
            assert job is not None and job.status == ("PENDING" if case == "retry" else "DEAD")
            assert job.error_code == "ValueError" and job.lease_token is None
            invoice, ocr = db.get(Invoice, iid), db.get(OcrJob, oid)
            if case == "terminal":
                assert invoice is not None and invoice.status == "FAILED" and invoice.revision == 2
                assert ocr is not None and ocr.status == "FAILED" and ocr.completed_at is not None
                assert ocr.processing_ms is not None and ocr.processing_ms >= 0
            else:
                assert invoice is None or (invoice.status == "PROCESSING" and invoice.revision == 1)
                assert ocr is None or ocr.status == "PROCESSING"


def verify_email(sessions):
    smtp = {"smtp_host": "smtp.example.test", "smtp_port": 587, "smtp_user": "sender@example.test",
            "smtp_password": "fake", "smtp_tls": False, "smtp_ssl": False,
            "emails_from_email": "sender@example.test", "emails_from_name": "Test"}
    outer, inner = uuid4(), uuid4()
    with EmailService.delivery_job(outer):
        assert _delivery_job_id.get() == outer
        with EmailService.delivery_job(inner):
            assert _delivery_job_id.get() == inner
        assert _delivery_job_id.get() == outer
    assert _delivery_job_id.get() is None
    with patch("app.dung_chung.email.dich_vu.SessionLocal", sessions), patch(
        "app.dung_chung.email.dich_vu._get_effective_smtp", return_value=smtp
    ):
        accepted = uuid4()
        with patch("smtplib.SMTP") as transport, EmailService.delivery_job(accepted):
            transport.return_value.__exit__.side_effect = SMTPServerDisconnected("Mock QUIT failure")
            assert EmailService.send_email_sync("receiver@example.test", "Test", "<p>Test</p>", "SUPPORT_REPLY")
            assert transport.return_value.__enter__.return_value.sendmail.call_count == 1
        uncertain = uuid4()
        with patch("smtplib.SMTP") as transport, EmailService.delivery_job(uncertain):
            transport.return_value.__enter__.return_value.sendmail.side_effect = SMTPServerDisconnected("Mock disconnect")
            for _ in range(2):
                try:
                    EmailService.send_email_sync("receiver@example.test", "Test", "<p>Test</p>", "SUPPORT_REPLY")
                except EmailDeliveryUncertain:
                    pass
                else:
                    raise AssertionError("Unconfirmed delivery must not be retried automatically")
            assert transport.return_value.__enter__.return_value.sendmail.call_count == 1
        with sessions() as db:
            assert db.get(EmailLog, accepted).status == "SENT"
            assert db.get(EmailLog, uncertain).status == "UNKNOWN"


def main():
    verify_text()
    engine = create_engine("sqlite://", poolclass=StaticPool, connect_args={"check_same_thread": False})

    @event.listens_for(engine, "connect")
    def sql_functions(connection, _):
        connection.create_function("sysutcdatetime", 0, lambda: datetime.now().isoformat(" "))

    for table in Base.metadata.tables.values():
        for index in table.indexes:
            predicate = index.dialect_options["mssql"].get("where")
            if predicate is not None and index.dialect_options["sqlite"].get("where") is None:
                index.dialect_options["sqlite"]["where"] = predicate
    Base.metadata.create_all(engine)
    sessions = sessionmaker(bind=engine, expire_on_commit=False)
    try:
        with patch.object(settings, "job_encryption_key", Fernet.generate_key().decode()):
            verify_ocr(sessions)
        verify_email(sessions)
    finally:
        engine.dispose()
    print("PASS: text validation, audit redaction, OCR terminal/retry/missing targets, email context and delivery fences")


if __name__ == "__main__":
    main()
