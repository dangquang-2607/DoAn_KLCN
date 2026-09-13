from datetime import timedelta
from unittest.mock import patch
from uuid import UUID

import pytest
from sqlalchemy import select, func
from sqlalchemy.orm import sessionmaker

from app.models.account import Account
from app.models.background_job import BackgroundJob
from app.services.jobs import enqueue, claim, now
from app.services.worker import run_once, owns, validated_amount
from tests.test_transactions import headers


def test_money_replay_conflict_and_missing_key(client, db, user_token):
    auth = {**headers(user_token), "Idempotency-Key": "account-create-001"}
    body = {"name": "Replay", "account_type": "CASH", "balance": "100", "currency": "VND"}
    first = client.post("/api/v1/accounts", headers=auth, json=body)
    assert first.status_code == 201, first.text
    second = client.post("/api/v1/accounts", headers=auth, json=body)
    assert second.json() == first.json()
    assert db.scalar(select(func.count()).select_from(Account)) == 1
    assert client.post("/api/v1/accounts", headers=auth, json={**body, "balance": "200"}).status_code == 409
    assert client.post("/api/v1/accounts", headers={**auth, "Idempotency-Key": ""}, json=body).status_code == 428


def test_outbox_rolls_back_and_encrypts(db):
    job = enqueue(db, "EMAIL", {"secret": "otp-123456"}, "unique-email")
    assert "otp-123456" not in job.payload
    assert enqueue(db, "EMAIL", {}, "unique-email").id == job.id
    db.rollback()
    assert db.scalar(select(func.count()).select_from(BackgroundJob)) == 0


def test_worker_retries_then_dead_letters_without_leaking_error(db):
    sessions = sessionmaker(bind=db.bind)
    job = enqueue(db, "EMAIL", {}, "retry-test"); db.commit()
    jid = job.id
    with patch("app.services.worker.dispatch", side_effect=RuntimeError("sensitive-secret")) as dispatch:
        for attempt in range(1, 4):
            assert run_once(sessions)
            db.expire_all(); job = db.get(BackgroundJob, jid)
            assert job.attempts == attempt
            assert job.error_code == "RuntimeError"
            assert job.status == ("DEAD" if attempt == 3 else "PENDING")
            job.available_at = now() - timedelta(seconds=1); db.commit()
        assert not run_once(sessions)
        assert dispatch.call_count == 3


def test_expired_worker_cannot_complete_new_lease(db):
    job = enqueue(db, "EMAIL", {}, "lease-test"); db.commit()
    first = claim(db)
    job.lease_until = now() - timedelta(seconds=1); db.commit()
    second = claim(db)
    assert first[1] != second[1]
    assert owns(db, job.id, first[1]) is None
    assert owns(db, job.id, second[1]) is not None


def test_crashed_worker_stops_after_retry_limit(db):
    sessions = sessionmaker(bind=db.bind)
    job = enqueue(db, "EMAIL", {}, "crash-test"); db.commit()
    for _ in range(3):
        claim(db)
        job.lease_until = now() - timedelta(seconds=1); db.commit()
    with patch("app.services.worker.dispatch") as dispatch:
        assert run_once(sessions)
        dispatch.assert_not_called()
    db.expire_all()
    assert db.get(BackgroundJob, job.id).status == "DEAD"


@pytest.mark.parametrize("amount", ["-1", "NaN", "Infinity", "100000000000000000"])
def test_invalid_ocr_amount_rejected(amount):
    with pytest.raises(ValueError): validated_amount(amount)


def test_oversized_payload_rejected_before_auth(client):
    response = client.post("/api/v1/auth/register", content=b"x" * (256 * 1024 + 1), headers={"Content-Type": "application/json"})
    assert response.status_code == 413


def test_otp_is_hashed_single_use_and_revokes_tokens(client, db, test_user, user_token):
    from app.models.password_reset import PasswordResetOTP
    from app.api.routes.auth import _otp_digest
    with patch("app.api.routes.auth.secrets.randbelow", return_value=234567):
        response = client.post("/api/v1/auth/forgot-password", json={"email": test_user.email})
    assert response.status_code == 200
    otp = db.scalar(select(PasswordResetOTP))
    assert otp.otp_code == _otp_digest(test_user.email, "334567")
    assert otp.otp_code != "334567"
    payload = {"email": test_user.email, "otp_code": "334567", "new_password": "new-password-123"}
    assert client.post("/api/v1/auth/reset-password", json=payload).status_code == 200
    assert client.post("/api/v1/auth/reset-password", json=payload).status_code == 400
    assert client.get("/api/v1/auth/me", headers=headers(user_token)).status_code == 401


def test_ocr_enqueue_does_not_call_provider(client, db, test_user, user_token):
    from tests.test_audit_p0 import invoice_fixture
    from app.models.invoice import Invoice
    _, iid = invoice_fixture(db, test_user)
    with patch("app.services.gemini_service.run_gemini_ocr") as provider:
        response = client.post(f"/api/v1/invoices/{iid}/ocr", headers=headers(user_token))
        assert response.status_code == 202
        assert client.post(f"/api/v1/invoices/{iid}/ocr", headers=headers(user_token)).status_code == 202
        provider.assert_not_called()
    assert db.get(Invoice, iid).status == "PROCESSING"
    assert db.scalar(select(func.count()).select_from(BackgroundJob).where(BackgroundJob.kind == "OCR")) == 1


def test_invoice_delete_rollback_keeps_file(db, test_user, tmp_path):
    from app.models.invoice import Invoice
    from app.api.routes.invoices import _safe_delete_invoice
    path = tmp_path / "invoice.png"; path.write_bytes(b"image")
    invoice = Invoice(user_id=test_user.id, status="UPLOADED", storage_key=path.name, currency="VND")
    db.add(invoice); db.commit(); iid = invoice.id
    _safe_delete_invoice(db, invoice)
    db.rollback()
    assert path.exists()
    assert db.get(Invoice, iid) is not None
    assert db.scalar(select(func.count()).select_from(BackgroundJob)) == 0


def test_upload_refresh_failure_keeps_committed_file(db, test_user, tmp_path, monkeypatch):
    from io import BytesIO
    from fastapi import UploadFile
    from app.models.invoice import Invoice
    from app.api.routes.invoices import upload_invoice
    from app.core.config import settings
    monkeypatch.setattr(settings, "upload_dir", str(tmp_path))
    upload = UploadFile(filename="image.png", file=BytesIO(b"\x89PNG\r\n\x1a\nimage"))
    with patch.object(db, "refresh", side_effect=RuntimeError("Lost acknowledgement")):
        with pytest.raises(RuntimeError): upload_invoice(file=upload, db=db, user=test_user)
    invoice = db.scalar(select(Invoice))
    assert invoice is not None
    assert (tmp_path / invoice.storage_key).exists()


def test_money_rolls_back_if_replay_record_cannot_be_saved(db, test_user):
    from starlette.requests import Request
    from app.api.routes.accounts import create_account
    from app.schemas.account import AccountCreate
    from app.models.transaction import Transaction
    from app.models.idempotency import IdempotencyRecord
    from sqlalchemy import event
    db.info["request"] = Request({"type": "http", "method": "POST", "path": "/api/v1/accounts", "headers": [(b"idempotency-key", b"rollback-replay")], "query_string": b""})
    def fail_insert(*_):raise RuntimeError("Replay write failed")
    event.listen(IdempotencyRecord, "before_insert", fail_insert)
    try:
        with pytest.raises(RuntimeError):
            create_account(payload=AccountCreate(name="Rollback", account_type="BANK", balance="1000", currency="VND"), db=db, user=test_user)
    finally:
        event.remove(IdempotencyRecord, "before_insert", fail_insert)
    assert db.scalar(select(func.count()).select_from(Account)) == 0
    assert db.scalar(select(func.count()).select_from(Transaction)) == 0


def test_category_type_must_match_transaction(client, db, user_token):
    auth = headers(user_token)
    account = client.post("/api/v1/accounts", headers=auth, json={"name": "Type check", "account_type": "CASH", "balance": "1000", "currency": "VND"}).json()
    category = client.post("/api/v1/categories", headers=auth, json={"name": "Expense only", "type": "EXPENSE"}).json()
    payload = {"account_id": account["id"], "category_id": category["id"], "amount": "100", "type": "INCOME", "transaction_date": "2026-09-11"}
    assert client.post("/api/v1/transactions", headers=auth, json=payload).status_code == 422
    assert db.get(Account, UUID(account["id"])).balance == 1000


def test_worker_cli_once_executes_one_iteration():
    from app.services.worker import main
    with patch("app.services.worker.run_once", return_value=False) as process:
        main(["--once"])
    process.assert_called_once_with()


@pytest.mark.parametrize("failure", [None, RuntimeError("temporary database failure")])
def test_worker_ctrl_c_during_wait_exits_cleanly(failure, capsys):
    from app.services.worker import main
    with patch("app.services.worker.run_once", return_value=False, side_effect=failure), patch("app.services.worker.time.sleep", side_effect=KeyboardInterrupt):
        main([])
    assert "Worker stopped." in capsys.readouterr().out


def test_worker_ctrl_c_during_once_exits_cleanly(capsys):
    from app.services.worker import main
    with patch("app.services.worker.run_once", side_effect=KeyboardInterrupt):
        main(["--once"])
    assert "Worker stopped." in capsys.readouterr().out


@pytest.mark.parametrize("host,password,expected", [
    ("smtp.gmail.com", "abcd efgh ijkl mnop", "abcdefghijklmnop"),
    ("smtp.gmail.com", "abcdefghijklmnop", "abcdefghijklmnop"),
    ("smtp.example.com", "abcd efgh ijkl mnop", "abcd efgh ijkl mnop"),
    ("smtp.gmail.com", "a different password", "a different password"),
])
def test_gmail_app_password_display_spacing(host, password, expected):
    from app.services.email_service import _smtp_login_password
    assert _smtp_login_password(host, password) == expected
