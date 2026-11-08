"""Development API integration checks against SQL Server; all fixture data rolls back.

Run from capitalflow-api: .venv/Scripts/python.exe tools/verify_api_integration.py
SMTP/Gemini network boundaries are mocked. Existing accounts/files are never mutated.
"""
from __future__ import annotations

import json
import logging
import re
import secrets
import sys
import tempfile
import uuid
from contextlib import ExitStack
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from pathlib import Path
from unittest.mock import AsyncMock, patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from fastapi import Request
from fastapi.testclient import TestClient
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.main import app
from app.dung_chung.config import settings
from app.dung_chung.database.ket_noi import engine
from app.dung_chung.database.session import SessionLocal
from app.dung_chung.http.phu_thuoc import get_db
from app.dung_chung.http.gioi_han_tan_suat import limiter
from app.dung_chung.security.tokens import decode_token
from app.dung_chung.tac_vu_nen.hang_doi import decode
from app.dung_chung.tac_vu_nen.luu_tru.tac_vu_nen import BackgroundJob
from app.dung_chung.tac_vu_nen import trinh_chay as worker
from app.dung_chung.email.dich_vu import EmailService
from app.chuc_nang.nguoi_dung.dang_nhap.luu_tru.nguoi_dung import User, UserRole
from app.chuc_nang.nguoi_dung.tai_chinh.giao_dich.luu_tru.giao_dich import Transaction
from app.chuc_nang.nguoi_dung.tai_chinh.vi_tai_khoan.luu_tru.wallet import Wallet, WalletEntry, DemoBankBalance

logging.getLogger("httpx").setLevel(logging.WARNING)
logging.getLogger("capitalflow.invoice_metrics").setLevel(logging.WARNING)
HTTP_METHODS = {"get", "post", "patch", "put", "delete", "options", "head"}
BASE_EMAIL = "quanghong5742@gmail.com"


def main() -> None:
    if settings.app_env != "development":
        raise RuntimeError("This integration suite requires app_env=development")
    nonce = uuid.uuid4().hex[:10]
    emails = [BASE_EMAIL, f"quanghong5742+integration-{nonce}@gmail.com",
              f"quanghong5742+admin-{nonce}@gmail.com"]
    with SessionLocal() as db:
        if db.scalar(select(User.id).where(User.email.in_(emails))) is not None:
            raise RuntimeError("Test email already exists; no existing account was changed")
    passwords = [secrets.token_urlsafe(24) for _ in emails]
    today = datetime.now(timezone(timedelta(hours=7))).date()
    first = today.replace(day=1)
    schema = app.openapi()
    operations = [(method.upper(), path, op) for path, value in schema["paths"].items()
                  for method, op in value.items() if method in HTTP_METHODS]
    patterns = [(method, path, re.compile("^" + re.sub(r"\{[^}]+\}", r"[^/]+", path) + "$"))
                for method, path, _ in operations]
    calls: list[str] = []
    covered: set[tuple[str, str]] = set()
    assertions: list[str] = []
    connection = engine.connect()
    outer = connection.begin()
    original_overrides = app.dependency_overrides.copy()
    rate_enabled = limiter.enabled
    tokens: list[dict] = []

    def session():
        return Session(bind=connection, join_transaction_mode="create_savepoint", expire_on_commit=False)

    def test_db(request: Request):
        with session() as db:
            db.info["request"] = request
            try:
                yield db
            except Exception:
                db.rollback()
                raise

    def check(name, condition):
        if not condition:
            raise AssertionError(name)
        assertions.append(name)

    def call(name, method, path, *, status=200, body=None, owner=0, token=None, key=None, **kwargs):
        absolute = path if path.startswith("/health") or path.startswith("/ready") else "/api/v1" + path
        headers = dict(kwargs.pop("headers", {}))
        if token is None and owner is not None:
            token = tokens[owner]["access_token"]
        if token is not None:
            headers["Authorization"] = "Bearer " + token
        if key is not None:
            headers["Idempotency-Key"] = key
        response = client.request(method, absolute, json=body, headers=headers, **kwargs)
        pure_path = absolute.split("?", 1)[0]
        for candidate_method, candidate_path, pattern in patterns:
            if method.upper() == candidate_method and pattern.fullmatch(pure_path):
                covered.add((candidate_method, candidate_path))
        if response.status_code != status:
            # Avoid logging tokens, OTPs, passwords or full database exceptions.
            raise AssertionError(f"{name}: expected HTTP {status}, got {response.status_code}")
        calls.append(name)
        return response.json() if response.content and "application/json" in response.headers.get("content-type", "") else response.content

    def mutate(name, method, path, body=None, **kwargs):
        return call(name, method, path, body=body, key=kwargs.pop("key", uuid.uuid4().hex), **kwargs)

    def login(owner):
        result = call("login", "POST", "/auth/login", owner=None,
                      body={"email": emails[owner], "password": passwords[owner]})
        if len(tokens) > owner:
            tokens[owner] = result
        else:
            tokens.append(result)
        return result

    def balance(wallet):
        with session() as db:
            row = db.get(Wallet, uuid.UUID(wallet))
            assert row is not None, "Test wallet missing"
            return row.balance

    def totals():
        return call("financial_report", "GET", f"/analytics?month={today.month}&year={today.year}")["summary"]

    def progress(budget):
        return Decimal(call("budget_progress", "GET", f"/budgets/{budget}")["spent_amount"])

    def rows():
        return call("bookkeeping_list", "GET", "/bookkeeping?page_size=1000")["items"]

    def upload(name, data, *, filename="receipt.jpg", status=201, owner=0, key=None):
        return call(name, "POST", "/invoices", status=status, owner=owner, key=key or uuid.uuid4().hex,
                    files={"file": (filename, data, "application/xml" if filename.endswith(".xml") else "image/jpeg")})

    app.dependency_overrides[get_db] = test_db
    limiter.enabled = False
    try:
        with tempfile.TemporaryDirectory(prefix="capitalflow-api-integration-") as upload_dir, ExitStack() as stack:
            stack.enter_context(patch.object(settings, "upload_dir", upload_dir))
            # Keep real encrypted outbox rows, but never dispatch mail.
            stack.enter_context(patch("app.dung_chung.http.trung_gian.kiem_toan._write_audit_log"))
            reset_mail = stack.enter_context(patch.object(EmailService, "send_password_reset_otp"))
            bank_mail = stack.enter_context(patch(
                "app.chuc_nang.nguoi_dung.tai_chinh.vi_tai_khoan.wallet_api.send_otp_email", new_callable=AsyncMock))
            ocr = stack.enter_context(patch(
                "app.chuc_nang.nguoi_dung.hoa_don_ai.nghiep_vu.kiem_tra_tai_len.run_gemini_ocr", new_callable=AsyncMock))
            worker_ocr = stack.enter_context(patch(
                "app.chuc_nang.nguoi_dung.hoa_don_ai.ha_tang.gemini.run_gemini_ocr", new_callable=AsyncMock))
            stack.enter_context(patch(
                "app.chuc_nang.nguoi_dung.hoa_don_ai.ha_tang.gemini._call_gemini_model",
                new_callable=AsyncMock, side_effect=AssertionError("Unexpected Gemini network call")))
            # Fail closed if an unexpected path reaches either SMTP implementation.
            stack.enter_context(patch("smtplib.SMTP", side_effect=AssertionError("Unexpected SMTP call")))
            stack.enter_context(patch("smtplib.SMTP_SSL", side_effect=AssertionError("Unexpected SMTP call")))
            stack.enter_context(patch("fastapi_mail.FastMail.send_message", new_callable=AsyncMock,
                                      side_effect=AssertionError("Unexpected SMTP call")))
            client = stack.enter_context(TestClient(app, raise_server_exceptions=False))
            # Every documented protected operation requires authentication.
            protected = 0
            for method, path, operation in operations:
                if not operation.get("security"):
                    continue
                concrete = re.sub(r"\{([^}]+)\}", lambda m: "1" if m[1] == "log_id" and "audit-logs" in path
                                  else "topup" if m[1] == "action" else str(uuid.uuid4()), path)
                response = client.request(method, concrete, json={})
                check("authentication:" + method + " " + path, response.status_code in {401, 403})
                covered.add((method, path))
                protected += 1
            call("health", "GET", "/health", owner=None)
            call("readiness", "GET", "/ready", owner=None)
            # Unicode boundaries must fail validation before SQL writes.
            call("register_utf16_limit", "POST", "/auth/register", owner=None, status=422,
                 body={"email": emails[1], "password": passwords[1], "full_name": "😀" * 100})
            for index, email in enumerate(emails):
                call("register", "POST", "/auth/register", owner=None, status=201,
                     body={"email": email, "password": passwords[index], "full_name": "Integration " + nonce})
                login(index)
            with session() as db:
                ids = [db.scalar(select(User.id).where(User.email == email)) for email in emails]
                admin = db.get(User, ids[2])
                assert admin is not None, "Test admin missing"
                admin.role = UserRole.ADMIN
                admin.is_system_account = True
                db.commit()
            call("profile", "GET", "/auth/me")
            call("duplicate_email", "POST", "/auth/register", owner=None, status=409,
                 body={"email": emails[0], "password": passwords[0]})
            call("blank_password", "POST", "/auth/register", owner=None, status=422,
                 body={"email": "quanghong5742+invalid-" + nonce + "@gmail.com", "password": "      "})
            call("earliest_payment_day", "GET", "/bookkeeping/payments?paid_on=0001-01-01")
            call("latest_payment_day", "GET", "/bookkeeping/payments?paid_on=9999-12-31")
            # Registration/login/list must create exactly one empty default wallet.
            owned_wallets = [call("default_wallet", "GET", "/wallets", owner=i)[0]["id"] for i in (0, 1)]
            wallet, peer_wallet = owned_wallets
            call("default_wallet_repeat", "GET", "/wallets")
            check("single_empty_default", balance(wallet) == 0 and len(call("wallet_list", "GET", "/wallets")) == 1)
            second = mutate("create_wallet", "POST", "/wallets", {"name": "Second " + nonce}, status=201)["id"]
            mutate("rename_wallet", "PATCH", f"/wallets/{second}", {"name": "Savings " + nonce})
            call("no_money_key", "POST", "/wallets", body={"name": "missing"}, status=428)
            code = call("receiving_qr_contract", "GET", f"/wallets/{peer_wallet}/receive", owner=1)
            for recipient in (emails[1], code["qr_payload"], peer_wallet):
                resolved = call("recipient_resolve", "POST", "/wallets/recipients/resolve", body={"recipient": recipient})
                check("recipient_identity", resolved["id"] == peer_wallet and not resolved["is_own"])
            call("recipient_by_id", "GET", f"/wallets/recipients/{peer_wallet}")
            call("foreign_wallet_qr_denied", "GET", f"/wallets/{peer_wallet}/receive", status=404)
            # User-specific simulated banks, OTP, topup and exact replay.
            providers = call("bank_providers", "GET", "/wallets/providers")
            provider, info = next(iter(providers.items()))
            bank_body = {"provider": provider, "account_number": info["demo_number"]}
            otp_challenge = call("bank_otp", "POST", "/wallets/banks/send-otp", body=bank_body)
            otp = bank_mail.call_args.kwargs["otp_code"]
            call("bank_otp_cooldown", "POST", "/wallets/banks/send-otp", body=bank_body, status=429)
            linked = mutate("bank_link", "POST", "/wallets/banks",
                            {**bank_body, "otp_request_id": otp_challenge["otp_request_id"], "otp": otp})
            link_id = linked["id"]
            call("bank_list", "GET", "/wallets/banks")
            call("wallet_bank_legacy_bridge", "GET", f"/wallets/{wallet}/banks")
            money_key = uuid.uuid4().hex
            amount = Decimal("1000000")
            topup_body = {"link_id": link_id, "amount": str(amount)}
            deposited = mutate("topup", "POST", f"/wallets/{wallet}/topup", topup_body, key=money_key)
            repeated = mutate("topup_replay", "POST", f"/wallets/{wallet}/topup", topup_body, key=money_key)
            check("topup_once", deposited == repeated and balance(wallet) == amount)
            mutate("key_reuse_changed_body", "POST", f"/wallets/{wallet}/topup",
                   {**topup_body, "amount": "1"}, key=money_key, status=409)
            # Real financial invariants across wallet movements and reports.
            mutate("transfer_own", "POST", f"/wallets/{wallet}/transfers/create", {"to_wallet_id": second, "amount": "100000"})
            check("internal_movement_not_personal_income", totals() == {"income": 0.0, "expense": 0.0, "net": 0.0})
            transfer = mutate("transfer_peer", "POST", f"/wallets/{wallet}/transfers/create", {"to_wallet_id": peer_wallet, "amount": "50000"})
            check("transfer_conserves_money", balance(wallet) + balance(second) + balance(peer_wallet) == amount)
            check("external_transfer_default_expense", totals()["expense"] == 50000.0)
            with session() as db:
                transfer_records = db.execute(select(Transaction.id, Transaction.user_id).join(
                    WalletEntry, WalletEntry.id == Transaction.wallet_entry_id).where(
                    WalletEntry.operation_id == uuid.UUID(transfer["operation_id"]))).all()
            for record_id, record_owner in transfer_records:
                mutate("exclude_transfer_from_personal_reports", "PATCH", f"/bookkeeping/{record_id}",
                       {"include_in_reports": False}, owner=ids.index(record_owner))
            check("excluded_movements_not_personal_income", totals() == {"income": 0.0, "expense": 0.0, "net": 0.0})
            mutate("withdraw", "POST", f"/wallets/{wallet}/withdraw", {"link_id": link_id, "amount": "20000"})
            check("withdraw_not_expense", totals()["expense"] == 0)
            # A personal category shared by payment, OCR, budgets and reports.
            category = call("category_create", "POST", "/categories", status=201,
                            body={"name": "Integration " + nonce, "type": "EXPENSE", "keywords": "integrationfood"})
            cid = category["id"]
            call("category_list", "GET", "/categories")
            call("category_suggest", "POST", "/categories/suggest",
                 body={"type": "EXPENSE", "description": "integrationfood"})
            call("category_update", "PATCH", f"/categories/{cid}", body={"icon": "cup"})
            budget = call("budget_create", "POST", "/budgets", status=201, body={
                "category_id": cid, "amount_limit": "500000", "period_type": "MONTHLY", "is_recurring": True, "start_date": first.isoformat()})["id"]
            bill = call("issue_demo_bill", "POST", "/wallets/bills/qr", body={
                "merchant_name": "Integration Cafe " + nonce,
                "items": [{"name": "Coffee", "quantity": 1, "unit_price": "184000"}],
            })
            payment_body = {"qr_payload": bill["qr_payload"], "category_id": cid}
            payment_key = uuid.uuid4().hex
            before_payment = balance(wallet)
            payment = mutate("payment", "POST", f"/wallets/{wallet}/payments/create", payment_body,
                             key=payment_key, status=201)
            replay = mutate("payment_replay", "POST", f"/wallets/{wallet}/payments/create", payment_body,
                            key=payment_key, status=201)
            tid, eid = payment["bookkeeping_id"], payment["entry_id"]
            check("payment_exactly_once", payment == replay and balance(wallet) == before_payment - Decimal("184000"))
            check("payment_budget_report_match", progress(budget) == Decimal("184000") and totals()["expense"] == 184000.0)
            mutate("same_bill_new_key_blocked", "POST", f"/wallets/{wallet}/payments/create", payment_body, status=409)
            mutate("linked_payment_cannot_change_amount", "PATCH", f"/bookkeeping/{tid}", {"amount": "1"}, status=409)
            mutate("linked_payment_cannot_delete", "DELETE", f"/bookkeeping/{tid}", status=409)
            mutate("exclude_payment", "PATCH", f"/bookkeeping/{tid}", {"include_in_reports": False})
            check("exclude_updates_budget_report_not_wallet", progress(budget) == 0 and totals()["expense"] == 0
                  and balance(wallet) == before_payment - Decimal("184000"))
            mutate("include_payment", "PATCH", f"/bookkeeping/{tid}", {"include_in_reports": True})
            call("payment_detail", "GET", f"/bookkeeping/{tid}/payment-detail")
            call("payment_candidates", "GET", f"/bookkeeping/payments?amount=184000&paid_on={today.isoformat()}")
            mutate("manual_duplicate_payment_requires_review", "POST", "/bookkeeping", {
                "type": "EXPENSE", "amount": "184000", "transaction_date": today.isoformat()}, status=409)
            # Upload, edit, confirm against the existing wallet payment: no second expense.
            def ocr_result(total="184000", merchant=None):
                return {"ten_nguoi_ban": merchant or bill["merchant_name"], "ngay_lap": today.strftime("%d/%m/%Y"),
                        "so_hoa_don": nonce, "tong_thanh_toan": total, "tien_te": None, "do_tin_cay": 0.98,
                        "items": [{"ten_hang": "Coffee", "so_luong": "1", "don_gia": total, "thanh_tien": total}]}
            ocr.return_value = ocr_result()
            image = b"\xff\xd8\xff" + nonce.encode() + b"-receipt"
            ocr_calls = ocr.await_count
            for filename, contents, expected in [
                ("receipt.pdf", b"%PDF-1.7", 415), ("receipt.docx", b"PK", 415),
                ("receipt.xml", b"<HDon/>", 415), ("empty.jpg", b"", 422),
                ("renamed.jpg", b"%PDF-1.7", 415),
                ("large.jpg", b"\xff\xd8\xff" + b"x" * (2 * 1024 * 1024), 413),
            ]:
                upload("reject_invalid_invoice_image", contents, filename=filename, status=expected)
            check("invalid_images_never_call_ocr", ocr.await_count == ocr_calls)
            monitor_before = call("ocr_monitor_before_upload", "GET", "/admin/system/ocr-monitor", owner=2)["ocr_jobs"]
            uploaded = upload("upload_invoice", image)
            monitor_after = call("ocr_monitor_after_upload", "GET", "/admin/system/ocr-monitor", owner=2)["ocr_jobs"]
            check("upload_ocr_counted_and_timed", monitor_after["total"] == monitor_before["total"] + 1
                  and monitor_after["measured"] == monitor_before["measured"] + 1
                  and monitor_after["average_processing_ms"] >= 1)
            iid = uploaded["id"]
            call("invoice_read", "GET", f"/invoices/{iid}")
            check("uploaded_file_exact", call("invoice_file", "GET", f"/invoices/{iid}/file") == image)
            call("invoice_items", "GET", f"/invoices/{iid}/items")
            call("invoice_items_edit", "PUT", f"/invoices/{iid}/items", body={
                "expected_revision": uploaded["revision"], "items": [{"name": "Coffee", "quantity": "1", "line_total": "184000"}]})
            invoice = call("invoice_after_edit", "GET", f"/invoices/{iid}")
            call("invoice_stale_revision", "PUT", f"/invoices/{iid}/items", status=409,
                 body={"expected_revision": uploaded["revision"], "items": []})
            call("duplicate_preview", "POST", f"/invoices/{iid}/duplicate-check", body={})
            cleared = call("duplicate_clear", "POST", f"/invoices/{iid}/duplicate-resolution",
                           body={"action": "CLEAR", "expected_revision": invoice["revision"]}, key=uuid.uuid4().hex)
            invoice = call("invoice_after_resolution", "GET", f"/invoices/{iid}")
            check("duplicate_resolution_revision", cleared["revision"] == invoice["revision"])
            call("retired_invoice_confirmation", "POST", f"/invoices/{iid}/confirm", status=409,
                 body={"account_id": str(uuid.uuid4())})
            confirmation_body = {"expected_revision": invoice["revision"], "category_id": cid, "wallet_entry_id": eid}
            confirmation_key = uuid.uuid4().hex
            confirmed = call("invoice_link_payment", "POST", f"/bookkeeping/invoices/{iid}/confirm",
                             body=confirmation_body, key=confirmation_key, status=201)
            call("invoice_confirmation_replay", "POST", f"/bookkeeping/invoices/{iid}/confirm",
                 body=confirmation_body, key=confirmation_key, status=201)
            check("linked_invoice_reuses_record", confirmed["transaction_id"] == tid and len([r for r in rows() if r["wallet_entry_id"] == eid]) == 1)
            check("linked_invoice_no_double_charge", balance(wallet) == before_payment - Decimal("184000")
                  and totals()["expense"] == 184000.0 and progress(budget) == Decimal("184000"))
            ocr_calls = ocr.await_count
            upload("same_file_reuses_invoice", image, status=200)
            check("identical_image_does_not_repeat_ocr", ocr.await_count == ocr_calls)
            # Trashing and purging retain wallet facts, report totals and dedup evidence.
            call("invoice_trash", "DELETE", f"/invoices/{iid}", status=204)
            check("trash_keeps_expense", totals()["expense"] == 184000.0)
            trashed = call("invoice_trash_list", "GET", "/invoices?visibility=trash")["items"][0]
            restored = call("invoice_restore", "POST", f"/invoices/{iid}/restore", body={"expected_revision": trashed["revision"]},
                            key=uuid.uuid4().hex)
            call("invoice_trash_again", "DELETE", f"/invoices/{iid}", status=204)
            call("invoice_purge", "POST", "/invoices/batch-purge", body={"invoice_ids": [iid]})
            call("purged_invoice_missing", "GET", f"/invoices/{iid}", status=404)
            upload("purged_invoice_cannot_repost", image, status=409)
            check("purge_keeps_expense_and_wallet", totals()["expense"] == 184000.0 and balance(wallet) == before_payment - Decimal("184000"))
            # Incomplete OCR drafts can be completed manually before confirmation.
            ocr.return_value = {"items": [], "tien_te": None}
            incomplete = upload("incomplete_ocr_draft", image + b"-incomplete")
            draft = call("incomplete_ocr_detail", "GET", f"/invoices/{incomplete['id']}")
            check("incomplete_defaults_vnd", draft["currency"] == "VND")
            call("incomplete_cannot_confirm", "POST", f"/bookkeeping/invoices/{incomplete['id']}/confirm", body={}, key=uuid.uuid4().hex, status=422)
            manual = call("complete_ocr_then_confirm", "POST", f"/bookkeeping/invoices/{incomplete['id']}/confirm", status=201,
                          key=uuid.uuid4().hex, body={"merchant_name": "Different Vendor " + nonce, "invoice_date": today.isoformat(),
                                                       "total_amount": "10000", "category_id": cid})
            check("ocr_expense_updates_totals", totals()["expense"] == 194000.0 and progress(budget) == Decimal("194000"))
            # Deleting an OCR-only record permits a fresh revision-checked confirmation.
            mutate("remove_ocr_record", "DELETE", f"/bookkeeping/{manual['transaction_id']}")
            draft = call("invoice_after_record_removal", "GET", f"/invoices/{incomplete['id']}")
            call("old_confirmation_cannot_revive_record", "POST", f"/bookkeeping/invoices/{incomplete['id']}/confirm",
                 body={"merchant_name": "Different Vendor " + nonce, "invoice_date": today.isoformat(),
                       "total_amount": "10000", "category_id": cid}, key=uuid.uuid4().hex, status=409)
            check("removed_record_updates_reports", totals()["expense"] == 184000.0)
            # Actual OCR worker persistence with a mocked Gemini network response.
            call("queue_ocr", "POST", f"/invoices/{incomplete['id']}/ocr", status=202)
            with session() as db:
                task = db.scalar(select(BackgroundJob).where(BackgroundJob.owner_user_id == ids[0], BackgroundJob.kind == "OCR")
                                 .order_by(BackgroundJob.created_at.desc()))
                assert task is not None, "OCR outbox job missing"
                payload = decode(task)
                task.status = "RUNNING"; task.lease_token = uuid.uuid4(); task.lease_until = datetime.now(timezone.utc) + timedelta(minutes=3)
                job_id, lease = task.id, task.lease_token
                db.commit()
            worker_ocr.return_value = ocr_result("10000", "Worker Vendor " + nonce)
            worker.process_ocr(job_id, lease, payload, session)
            after_worker = call("worker_result_via_api", "GET", f"/invoices/{incomplete['id']}")
            check("worker_api_bridge", after_worker["status"] == "REVIEW_REQUIRED" and after_worker["currency"] == "VND")
            call("batch_ocr_partial", "POST", "/invoices/batch-ocr", body={"invoice_ids": [incomplete["id"], str(uuid.uuid4())]}, status=202)
            # Stop only this test invoice so the rest of the test does not enqueue another OCR.
            call("draft_batch_trash", "POST", "/invoices/batch-delete", body={"invoice_ids": [incomplete["id"]]})
            jobs_before = call("ocr_monitor_before_failure", "GET", "/admin/system/ocr-monitor", owner=2)["ocr_jobs"]
            ocr.side_effect = TimeoutError("QA simulated timeout")
            upload("upload_ocr_timeout", image + b"-timeout", status=503)
            ocr.side_effect = None
            ocr.return_value = {"items": "invalid OCR result"}
            upload("upload_ocr_invalid_result", image + b"-invalid-result", status=422)
            failed_monitor = call("ocr_monitor_after_failure", "GET", "/admin/system/ocr-monitor", owner=2)
            jobs_after = failed_monitor["ocr_jobs"]
            check("failed_upload_ocr_counted_and_timed", jobs_after["total"] == jobs_before["total"] + 2
                  and jobs_after["failed"] == jobs_before["failed"] + 2
                  and jobs_after["measured"] == jobs_before["measured"] + 2)
            initial_failures = [job for job in failed_monitor["recent_failures"] if job["error_code"] in {"UPLOAD_OCR_UNAVAILABLE", "UPLOAD_INVALID_OCR"}]
            check("admin_directs_initial_failure_to_user_retry", len(initial_failures) == 2 and all(
                not job["can_retry"] and job["resolution_label"] == "Chưa tạo hóa đơn" for job in initial_failures))
            ocr.return_value = {**ocr_result("12345", "Photo Vendor " + nonce), "so_hoa_don": nonce + "-photo"}
            extra_invoice = upload("additional_image_upload", image + b"-photo")
            call("additional_image_confirm", "POST", f"/bookkeeping/invoices/{extra_invoice['id']}/confirm", status=201,
                 body={"category_id": cid}, key=uuid.uuid4().hex)
            # Manual bookkeeping, exports, budget history and notification ownership.
            income = mutate("manual_income", "POST", "/bookkeeping", {"type": "INCOME", "amount": "30000",
                            "transaction_date": today.isoformat(), "description": "Income " + nonce}, status=201)
            expense = mutate("manual_expense", "POST", "/bookkeeping", {"type": "EXPENSE", "amount": "500",
                             "transaction_date": today.isoformat(), "category_id": cid, "description": "Expense " + nonce}, status=201)
            mutate("manual_update", "PATCH", f"/bookkeeping/{expense['id']}", {"amount": "1000"})
            mutate("batch_record_remove", "POST", "/bookkeeping/batch-delete", {"transaction_ids": [income["id"], expense["id"]]})
            check("cross_module_final_totals", totals()["expense"] == 196345.0 and progress(budget) == Decimal("196345"))
            dashboard = call("dashboard", "GET", "/bookkeeping/dashboard")
            check("dashboard_matches_report", dashboard["expense_this_month"] == totals()["expense"]
                  and Decimal(dashboard["net_worth"]) == balance(wallet) + balance(second))
            call("bookkeeping_export", "GET", "/bookkeeping/export-data")
            call("analytics_export", "GET", f"/analytics/export-data?start_date={first.isoformat()}&end_date={today.isoformat()}")
            call("analytics_csv", "GET", f"/analytics/export.csv?start_date={first.isoformat()}&end_date={today.isoformat()}")
            call("budgets_list", "GET", "/budgets")
            call("budget_history", "GET", f"/budgets/history?year={today.year}")
            for field, value in (("is_active", False), ("is_active", True),
                                 ("recurrence_end_date", today.isoformat()), ("recurrence_end_date", None)):
                call("retired_budget_action", "PATCH", f"/budgets/{budget}", status=422,
                     body={field: value})
            call("retired_budget_end_on_create", "POST", "/budgets", status=422, body={
                "category_id": cid, "amount_limit": "500000", "period_type": "MONTHLY",
                "is_recurring": True, "start_date": first.isoformat(), "recurrence_end_date": today.isoformat(),
            })
            unchanged = call("budget_after_rejected_actions", "GET", f"/budgets/{budget}")
            check("rejected_actions_preserve_budget", unchanged["period_state"] == "CURRENT"
                  and unchanged["recurrence_end_date"] is None and unchanged["next_state_date"] is None)
            call("budget_update_alert", "PATCH", f"/budgets/{budget}", body={"amount_limit": "200000", "effective_from": "CURRENT"})
            notes = call("notification_list", "GET", "/notifications")
            check("budget_alert_visible", any(n["kind"] == "BUDGET" for n in notes["items"]))
            nid = notes["items"][0]["id"]
            call("foreign_notification_read_denied", "POST", f"/notifications/{nid}/read", owner=1, status=404)
            call("foreign_notification_delete_denied", "DELETE", f"/notifications/{nid}", owner=1, status=404)
            call("notification_read", "POST", f"/notifications/{nid}/read")
            call("notification_delete", "DELETE", f"/notifications/{nid}", status=204)
            call("notification_read_all", "POST", "/notifications/read-all")
            call("notification_clear_read", "DELETE", "/notifications", status=204)
            # Cross-user writes and reads must not change any owner's data.
            for method, path, body, status in [
                ("PATCH", f"/wallets/{wallet}", {"name": "stolen"}, 404),
                ("PATCH", f"/bookkeeping/{tid}", {"include_in_reports": False}, 404),
                ("DELETE", f"/bookkeeping/{tid}", None, 404),
                ("GET", f"/bookkeeping/{tid}/payment-detail", None, 404),
                ("GET", f"/invoices/{extra_invoice['id']}", None, 404),
                ("GET", f"/invoices/{extra_invoice['id']}/file", None, 404),
                ("GET", f"/invoices/{extra_invoice['id']}/items", None, 404),
                ("GET", f"/budgets/{budget}", None, 404),
                ("PATCH", f"/budgets/{budget}", {"amount_limit": "1"}, 404),
                ("DELETE", f"/budgets/{budget}", None, 404),
                ("PATCH", f"/categories/{cid}", {"name": "stolen"}, 404),
            ]:
                mutate("cross_user_denied", method, path, body, owner=1, status=status)
            peer_report = call("peer_financial_report", "GET", f"/analytics?month={today.month}&year={today.year}", owner=1)
            check("peer_transfer_not_income", peer_report["summary"]["income"] == 0 and peer_report["summary"]["expense"] == 0)
            # Admin affects authentication of all modules, including idempotency replays.
            call("admin_ban", "PATCH", f"/admin/users/{ids[0]}/ban", owner=2)
            for path in ("/wallets", "/bookkeeping", "/invoices", "/budgets", "/analytics", "/notifications"):
                call("banned_session_denied", "GET", path, status=401)
            mutate("banned_replay_denied", "POST", f"/wallets/{wallet}/payments/create", payment_body, key=payment_key, status=401)
            call("admin_unban", "PATCH", f"/admin/users/{ids[0]}/unban", owner=2)
            call("unban_does_not_restore_session", "GET", "/wallets", status=401)
            login(0)
            call("category_archive", "DELETE", f"/categories/{cid}", status=204)
            check("archived_category_history_kept", totals()["expense"] == 196345.0)
            call("category_restore", "POST", f"/categories/{cid}/restore", body={})
            # Password reset OTP invalidates all outstanding sessions.
            call("forgot_unknown_email", "POST", "/auth/forgot-password", owner=None, status=404,
                 body={"email": f"quanghong5742+missing-{nonce}@gmail.com"})
            call("forgot_password", "POST", "/auth/forgot-password", owner=None, body={"email": emails[0]})
            check("bank_otp_does_not_throttle_password_otp", reset_mail.call_count == 1)
            reset_code = reset_mail.call_args.args[2]
            call("password_otp_resend_cooldown", "POST", "/auth/forgot-password", owner=None, body={"email": emails[0]})
            check("password_otp_own_cooldown", reset_mail.call_count == 1)
            call("verify_reset_otp", "POST", "/auth/verify-otp", owner=None, body={"email": emails[0], "otp_code": reset_code})
            new_password = secrets.token_urlsafe(24)
            call("reset_password", "POST", "/auth/reset-password", owner=None,
                 body={"email": emails[0], "otp_code": reset_code, "new_password": new_password})
            call("reset_revokes_wallet_session", "GET", "/wallets", status=401)
            passwords[0] = new_password; login(0)
            # Rotation, replay attack, individual revocation and revoke-others.
            original = tokens[0].copy()
            rotated = call("refresh_rotation", "POST", "/auth/refresh", owner=None, body={"refresh_token": original["refresh_token"]})
            call("refresh_reuse_rejected", "POST", "/auth/refresh", owner=None, status=401, body={"refresh_token": original["refresh_token"]})
            call("reuse_revokes_successor", "GET", "/wallets", status=401, token=rotated["access_token"])
            login(0)
            current = tokens[0].copy()
            another = login(0)
            tokens[0] = current
            sessions = call("sessions", "GET", "/auth/sessions")
            another_family = decode_token(another["access_token"])["sid"]
            call("revoke_one_session", "DELETE", f"/auth/sessions/{another_family}")
            call("revoked_device_denied", "GET", "/wallets", status=401, token=another["access_token"])
            login(0); other = tokens[0].copy(); tokens[0] = current
            call("revoke_other_sessions", "DELETE", "/auth/sessions/others")
            call("other_device_denied", "GET", "/invoices", status=401, token=other["access_token"])
            changed = secrets.token_urlsafe(24)
            call("change_password", "POST", "/auth/change-password",
                 body={"current_password": passwords[0], "new_password": changed})
            passwords[0] = changed
            call("change_revokes_session", "GET", "/wallets", status=401)
            login(0)
            # Final owner-only cleanup through public APIs, still inside the outer rollback.
            mutate("unlink_bank", "DELETE", f"/wallets/banks/{link_id}")
            mutate("archiving_nonempty_wallet_denied", "DELETE", f"/wallets/{second}", status=409)
            empty = mutate("create_empty_wallet", "POST", "/wallets", {"name": "Empty"}, status=201)["id"]
            mutate("archive_empty_wallet", "DELETE", f"/wallets/{empty}")
            call("all_wallet_history", "GET", "/wallets/history")
            call("wallet_history", "GET", f"/wallets/{wallet}/history")
            expenses_before_budget_delete = totals()["expense"]
            call("budget_delete", "DELETE", f"/budgets/{budget}", status=204)
            call("deleted_budget_missing", "GET", f"/budgets/{budget}", status=404)
            check("budget_delete_preserves_expenses", totals()["expense"] == expenses_before_budget_delete)
            call("logout", "POST", "/auth/logout", owner=None, status=204, body={"refresh_token": tokens[0]["refresh_token"]})
            call("logout_revokes_session", "GET", "/wallets", status=401)
            with session() as db:
                jobs = db.scalars(select(BackgroundJob).where(BackgroundJob.owner_user_id.in_(ids))).all()
                check("real_encrypted_outbox", len(jobs) > 0 and all(passwords[0] not in j.payload for j in jobs))
                check("all_test_jobs_owned", all(j.owner_user_id in ids for j in jobs))
                check("wallet_ledger_consistent", all(
                    db.scalar(select(func.coalesce(func.sum(WalletEntry.amount), 0)).where(WalletEntry.wallet_id == w.id)) == w.balance
                    for w in db.scalars(select(Wallet).where(Wallet.user_id.in_(ids)))))
                bank_funding = db.scalar(select(func.sum(DemoBankBalance.opening_balance - DemoBankBalance.balance)).where(
                    DemoBankBalance.user_id.in_(ids))) or Decimal(0)
                wallet_money = db.scalar(select(func.sum(Wallet.balance)).where(Wallet.user_id.in_(ids))) or Decimal(0)
                check("bank_wallet_payment_conservation", bank_funding == wallet_money + Decimal("184000"))
            check("outer_transaction_still_active", outer.is_active)
    finally:
        app.dependency_overrides.clear()
        app.dependency_overrides.update(original_overrides)
        limiter.enabled = rate_enabled
        outer.rollback()
        connection.close()
    with SessionLocal() as db:
        check("all_test_users_rolled_back", db.scalar(select(User.id).where(User.email.in_(emails))) is None)
        check("all_test_outbox_rolled_back", db.scalar(select(BackgroundJob.id).where(BackgroundJob.owner_user_id.in_(ids))) is None)
    print(json.dumps({"api_calls_passed": len(calls), "invariants_passed": len(assertions),
                      "protected_operations_checked": protected, "operations_touched": len(covered),
                      "documented_operations": len(operations), "sql_rollback_clean": True,
                      "real_emails_sent": 0, "real_gemini_calls": 0}, ensure_ascii=True))


if __name__ == "__main__":
    main()
