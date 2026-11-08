"""Payment/entitlement/quota regression in memory. No real payment, email or AI call."""
from datetime import datetime, timedelta
import base64
import binascii
from pathlib import Path
from time import perf_counter
from unittest.mock import patch
from uuid import UUID, uuid4
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from fastapi import FastAPI, HTTPException
from starlette.requests import Request
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

import app.dung_chung.database.dang_ky_mo_hinh
from app.dung_chung.database.nen_tang import Base
from app.dung_chung.config import settings
from app.dung_chung.http.gioi_han_tan_suat import limiter
from app.dung_chung.http.phu_thuoc import get_current_user, get_db
from app.chuc_nang.nguoi_dung.dang_nhap.luu_tru.nguoi_dung import User
from app.chuc_nang.nguoi_dung.goi_dich_vu.api import router
from app.chuc_nang.nguoi_dung.goi_dich_vu import payos
from app.chuc_nang.nguoi_dung.goi_dich_vu.checkout import capture, checkout_out, valid_qr
from app.chuc_nang.nguoi_dung.goi_dich_vu.han_muc import counts, consume_ai, month_vn, plan_for, require_capacity, reserve_ai, utcnow
from app.chuc_nang.nguoi_dung.goi_dich_vu.luu_tru import PaymentOrder, Subscription
from app.chuc_nang.nguoi_dung.hoa_don_ai.luu_tru.tac_vu_ocr import OcrJob
from app.chuc_nang.nguoi_dung.hoa_don_ai.nghiep_vu.kiem_tra_tai_len import _complete_attempt
from app.chuc_nang.nguoi_dung.tai_chinh.vi_tai_khoan.luu_tru.wallet import Wallet
from app.chuc_nang.nguoi_dung.tai_chinh.ngan_sach.luu_tru.ngan_sach import Budget
from app.dung_chung.tac_vu_nen.trinh_chay import run_once
from app.chuc_nang.nguoi_dung.tai_chinh.vi_tai_khoan.wallet_api import router as wallet_router
from app.chuc_nang.nguoi_dung.tai_chinh.ngan_sach.api import router as budget_router
from app.chuc_nang.quan_tri.nguoi_dung.api import router as admin_users_router


def expect_error(status, action):
    try:
        action()
    except HTTPException as exc:
        assert exc.status_code == status, exc.detail
    else:
        raise AssertionError(f"Expected {status}")


def provider_checkout(amount=30_000, description="CFDEMO01"):
    def tlv(tag, value):
        return f"{tag}{len(value.encode('utf-8')):02d}{value}"
    bank = tlv("00", "970422") + tlv("01", "VQRDEMO30000")
    merchant = tlv("00", "A000000727") + tlv("01", bank) + tlv("02", "QRIBFTTA")
    payload = (tlv("00", "01") + tlv("01", "12") + tlv("38", merchant) + tlv("53", "704")
               + tlv("54", str(amount)) + tlv("58", "VN") + tlv("62", tlv("08", description)) + "6304")
    payload += f"{binascii.crc_hqx(payload.encode('utf-8'), 0xFFFF):04X}"
    return {"qrCode": payload, "bin": "970422", "accountNumber": "VQRDEMO30000",
            "accountName": "CAPITALFLOW TEST", "description": description, "amount": amount}


def verify_checkout_fields():
    sample = provider_checkout()
    assert valid_qr(sample["qrCode"], 30_000)
    stored = capture(sample, 30_000)
    details = checkout_out(stored, 30_000)
    assert details is not None and details["qr_code"] == sample["qrCode"]
    assert base64.b64decode(details["qr_image"].split(",", 1)[1]).startswith(b"\x89PNG\r\n\x1a\n")
    assert capture({**sample, "qrCode": sample["qrCode"][:-4] + "0000"}, 30_000) is None
    assert capture({**provider_checkout(29_000), "amount": 30_000}, 30_000) is None
    assert capture({**sample, "qrCode": "000201\ud800"}, 30_000) is None
    assert capture({**sample, "accountNumber": "<script>"}, 30_000) is None
    assert checkout_out("{bad json", 30_000) is None
    assert checkout_out(stored, 29_000) is None
    assert checkout_out(None, 30_000) is None


def main():
    verify_checkout_fields()
    engine = create_engine("sqlite://", poolclass=StaticPool, connect_args={"check_same_thread": False})
    @event.listens_for(engine, "connect")
    def sql_functions(conn, _):
        conn.create_function("sysutcdatetime", 0, lambda: datetime.now().isoformat(" "))
    # Reproduce SQL Server filtered unique indexes in this in-memory engine.
    for table in Base.metadata.tables.values():
        for index in table.indexes:
            predicate = index.dialect_options["mssql"].get("where")
            if predicate is not None and index.dialect_options["sqlite"].get("where") is None:
                index.dialect_options["sqlite"]["where"] = predicate
    Base.metadata.create_all(engine)
    sessions = sessionmaker(bind=engine, expire_on_commit=False, autoflush=False)
    with sessions() as db:
        users = [User(email=f"billing-{index}@example.test", full_name="Billing test", password_hash="test") for index in range(3)]
        admin = User(email="billing-admin@example.test", full_name="Admin", password_hash="test", role="ADMIN", is_system_account=True)
        db.add_all([*users, admin])
        db.commit()
        user, other, quota_user = users

    remote = {}
    def provider(method, path, body=None):
        if method == "POST":
            code = body["orderCode"]
            assert body["amount"] == 30_000
            assert body["returnUrl"].startswith(settings.frontend_url.rstrip("/") + "/settings/subscription/checkout?payment_order=")
            assert body["cancelUrl"] == body["returnUrl"]
            signed = {key: body[key] for key in ("amount", "cancelUrl", "description", "orderCode", "returnUrl")}
            assert payos.verify(signed, body["signature"])
            remote.setdefault(code, {"id": uuid4().hex, "orderCode": code, "amount": 30_000, "amountPaid": 0, "status": "PENDING", **provider_checkout(description=body["description"])})
            return remote[code]
        # GET status does not include the original transfer/QR fields.
        return {key: value for key, value in remote[int(path[1:])].items()
                if key not in {"qrCode", "bin", "accountNumber", "accountName", "description"}}

    app = FastAPI()
    app.include_router(router)
    app.include_router(wallet_router)
    app.include_router(budget_router)
    app.include_router(admin_users_router, prefix="/admin")
    actor = {"user": user}
    def db_dependency(request: Request):
        with sessions() as db:
            db.info["request"] = request
            yield db
    def user_dependency():
        if actor["user"] is None:
            raise HTTPException(401)
        return actor["user"]
    app.dependency_overrides[get_db] = db_dependency
    app.dependency_overrides[get_current_user] = user_dependency
    enabled = limiter.enabled
    limiter.enabled = False
    try:
        with patch.object(settings, "payos_client_id", "fake-client"), patch.object(settings, "payos_api_key", "fake-api"), patch.object(settings, "payos_checksum_key", "fake-checksum"), patch.object(payos, "call", side_effect=provider), TestClient(app) as client:
            assert client.get("/billing/subscription").json()["plan"] == "FREE"
            request_id = str(uuid4())
            bad = client.post("/billing/checkout", json={"request_id": request_id, "amount": 1})
            assert bad.status_code == 422
            result = client.post("/billing/checkout", json={"request_id": request_id})
            assert result.status_code == 201, result.text
            first = result.json()
            assert first["amount"] == 30_000 and first["days"] == 30 and first["status"] == "PENDING"
            assert first["checkout_url"].startswith("https://pay.payos.vn/web/")
            assert first["checkout"]["account_number"] == "VQRDEMO30000"
            assert first["checkout"]["qr_code"] == remote[int(first["order_code"])]["qrCode"]
            assert "no-store" in result.headers["cache-control"]
            assert client.post(f"/billing/orders/{first['id']}/refresh").json()["checkout"] == first["checkout"]
            with sessions() as db:
                saved = db.get(PaymentOrder, UUID(request_id))
                expiry, details = saved.expires_at, saved.checkout_data
                saved.expires_at = utcnow() - timedelta(seconds=1)
                db.commit()
            assert client.get(f"/billing/orders/{first['id']}").json()["checkout"] is None
            with sessions() as db:
                saved = db.get(PaymentOrder, UUID(request_id))
                saved.expires_at, saved.checkout_data = expiry, "{invalid"
                db.commit()
            assert client.get(f"/billing/orders/{first['id']}").json()["checkout"] is None
            with sessions() as db:
                db.get(PaymentOrder, UUID(request_id)).checkout_data = details
                db.commit()
            with patch.object(payos, "call", side_effect=HTTPException(503, "Mock outage")):
                assert client.post(f"/billing/orders/{first['id']}/refresh").status_code == 503
                assert client.get(f"/billing/orders/{first['id']}").json()["checkout"] == first["checkout"]
            assert client.post("/billing/checkout", json={"request_id": str(uuid4())}).json()["id"] == first["id"]
            assert len(remote) == 1
            actor["user"] = other
            assert client.get(f"/billing/orders/{first['id']}").status_code == 404
            assert client.post(f"/billing/orders/{first['id']}/refresh").status_code == 404
            assert client.post("/billing/checkout", json={"request_id": first["id"]}).status_code == 409
            actor["user"] = user
            # Forged return URL and invalid webhook do not upgrade an account.
            assert client.get(f"/billing/orders/{first['id']}?status=PAID").json()["status"] == "PENDING"
            assert client.post("/billing/payos/webhook", json={"data": {}, "signature": "wrong"}).status_code == 400
            for malformed in ({}, {"data": None}, {"data": "invalid"}, {"data": []},
                              {"data": {}, "signature": None}, {"data": {}, "signature": "chữ ký không hợp lệ"}):
                assert client.post("/billing/payos/webhook", json=malformed).status_code == 400
            for invalid_code in (None, True, 1.5, [], {}, "invalid", 0, -1, 9_007_199_254_740_992):
                invalid_data = {"code": "00", "orderCode": invalid_code}
                invalid_webhook = {"code": "00", "success": True, "data": invalid_data, "signature": payos.signature(invalid_data)}
                assert client.post("/billing/payos/webhook", json=invalid_webhook).status_code == 400
            assert client.get("/billing/subscription").json()["plan"] == "FREE"
            code = int(first["order_code"])
            data = {"code": "00", "orderCode": code, "paymentLinkId": remote[code]["id"], "amount": 30_000}
            webhook = {"code": "00", "success": True, "data": data, "signature": payos.signature(data)}
            assert client.post("/billing/payos/webhook", json=webhook).status_code == 200
            assert client.get("/billing/subscription").json()["plan"] == "FREE"
            remote[code].update(status="PAID", amountPaid=30_000)
            assert client.post("/billing/payos/webhook", json=webhook).status_code == 200
            paid = client.get(f"/billing/orders/{first['id']}").json()
            assert paid["status"] == "PAID"
            assert paid["checkout"] is None
            start = datetime.fromisoformat(paid["premium_from"].replace("Z", "+00:00"))
            until = datetime.fromisoformat(paid["premium_until"].replace("Z", "+00:00"))
            assert until - start == timedelta(days=30)
            for _ in range(3):
                assert client.post("/billing/payos/webhook", json=webhook).status_code == 200
                assert client.post(f"/billing/orders/{first['id']}/refresh").json()["premium_until"] == paid["premium_until"]
            premium = client.get("/billing/subscription").json()
            assert premium["plan"] == "PREMIUM" and premium["limits"] == {"wallets": 10, "budgets": 20, "ai": 100}
            assert client.get("/admin/users").status_code == 403
            actor["user"] = admin
            directory = client.get("/admin/users").json()
            displayed = next(item for item in directory["items"] if item["id"] == str(user.id))
            assert displayed["plan"] == "PREMIUM" and displayed["premium_until"] == paid["premium_until"]
            assert client.get(f"/admin/users/{other.id}").json()["plan"] == "FREE"
            actor["user"] = user
            second = client.post("/billing/checkout", json={"request_id": str(uuid4())}).json()
            code2 = int(second["order_code"])
            remote[code2].update(status="PAID", amountPaid=30_000)
            renewed = client.post(f"/billing/orders/{second['id']}/refresh").json()
            assert renewed["premium_from"] == paid["premium_until"]
            assert datetime.fromisoformat(renewed["premium_until"].replace("Z", "+00:00")) - until == timedelta(days=30)
            # A confirmed but incorrect amount is held for review, never auto-granted.
            actor["user"] = other
            mismatch = client.post("/billing/checkout", json={"request_id": str(uuid4())}).json()
            remote[int(mismatch["order_code"])].update(amount=29_000)
            held = client.post(f"/billing/orders/{mismatch['id']}/refresh").json()
            assert held["status"] == "REVIEW" and held["checkout"] is None
            remote[int(mismatch["order_code"])].update(amount=30_000, status="PAID", amountPaid=29_000)
            assert client.post(f"/billing/orders/{mismatch['id']}/refresh").json()["status"] == "REVIEW"
            assert client.get("/billing/subscription").json()["plan"] == "FREE"
            sample = {"code": "00", "orderCode": 123, "amount": 3000, "paymentLinkId": "sample"}
            assert client.post("/billing/payos/webhook", json={"code": "00", "success": True, "data": sample, "signature": payos.signature(sample)}).status_code == 200
            # The customer can close checkout and a webhook can be lost: the worker still grants once.
            actor["user"] = quota_user
            missed = client.post("/billing/checkout", json={"request_id": str(uuid4())}).json()
            remote[int(missed["order_code"])].update(status="PAID", amountPaid=30_000)
            for _ in range(8):
                if not run_once(sessions, kinds={"BILLING"}):
                    break
            assert client.get("/billing/subscription").json()["plan"] == "PREMIUM"
            with sessions() as db:
                db.delete(db.get(Subscription, quota_user.id))
                db.commit()
            actor["user"] = None
            assert client.get("/billing/subscription").status_code == 401
            assert client.post("/billing/checkout", json={"request_id": str(uuid4())}).status_code == 401
            with patch.object(settings, "payos_api_key", ""):
                actor["user"] = user
                assert client.get("/billing/subscription").json()["payment_available"] is False
                assert client.post("/billing/checkout", json={"request_id": str(uuid4())}).status_code == 503
            expect_error(503, lambda: payos.checkout_url({"id": "validid", "checkoutUrl": "https://evil.example.test/pay"}))

        with sessions() as db:
            # Persist consumed usage across receipt/job deletion; failed attempts release capacity.
            uid = quota_user.id
            for index in range(5):
                jid = uuid4()
                reserve_ai(db, uid, jid)
                db.add(OcrJob(id=jid, user_id=uid, status="PROCESSING"))
                db.commit()
                if index == 0:
                    _complete_attempt(db, jid, perf_counter(), "MOCK_FAILURE")
                else:
                    _complete_attempt(db, jid, perf_counter())
            assert counts(db, uid)["ai"] == 4 and counts(db, uid)["ai_pending"] == 0
            jid = uuid4()
            reserve_ai(db, uid, jid)
            db.add(OcrJob(id=jid, user_id=uid, status="QUEUED"))
            db.commit()
            assert counts(db, uid)["ai_pending"] == 1
            expect_error(403, lambda: reserve_ai(db, uid, uuid4()))
            db.rollback()
            consume_ai(db, jid)
            db.delete(db.get(OcrJob, jid))
            db.commit()
            assert counts(db, uid)["ai"] == 5
            expect_error(403, lambda: require_capacity(db, uid, "ai"))
            db.rollback()
            db.add(Subscription(user_id=uid, premium_until=utcnow()+timedelta(days=30)))
            db.commit()
            require_capacity(db, uid, "ai")
            assert counts(db, uid)["ai"] == 5  # upgrade never resets used quota
            db.get(Subscription, uid).premium_until = utcnow()-timedelta(seconds=1)
            db.commit()
            assert plan_for(db, uid)[0] == "FREE"
            expect_error(403, lambda: require_capacity(db, uid, "ai"))
            db.rollback()
            with patch("app.chuc_nang.nguoi_dung.goi_dich_vu.han_muc.month_vn", return_value=(month_vn().replace(day=28)+timedelta(days=4)).replace(day=1)):
                assert counts(db, uid)["ai"] == 0
            for index in range(2):
                db.add(Wallet(user_id=uid, name=f"Test {index}", short_code=f"CF-TEST000{index}", is_active=True, is_default=index==0, balance=0))
            db.commit()
            expect_error(403, lambda: require_capacity(db, uid, "wallets"))
            db.rollback()
            today = month_vn()
            for index in range(3):
                db.add(Budget(user_id=uid, name=f"Budget {index}", amount_limit=1000, start_date=today+timedelta(days=index), end_date=today+timedelta(days=90+index), period_type="CUSTOM"))
            db.commit()
            assert counts(db, uid)["budgets"] == 3
            expect_error(403, lambda: require_capacity(db, uid, "budgets"))
            db.rollback()
        with TestClient(app) as client:
            actor["user"] = quota_user
            wallet_body = {"name": "Additional wallet"}
            wallet_headers = {"Idempotency-Key": str(uuid4())}
            denied = client.post("/wallets", json=wallet_body, headers=wallet_headers)
            assert denied.status_code == 403, denied.text
            future = month_vn()+timedelta(days=365)
            budget_body = {"name": "New future budget", "amount_limit": 1000, "period_type": "CUSTOM",
                           "start_date": future.isoformat(), "end_date": (future+timedelta(days=30)).isoformat()}
            denied = client.post("/budgets", json=budget_body)
            assert denied.status_code == 403, denied.text
            with sessions() as db:
                db.get(Subscription, quota_user.id).premium_until = utcnow()+timedelta(days=30)
                db.commit()
            added = client.post("/wallets", json=wallet_body, headers=wallet_headers)
            assert added.status_code == 201, added.text
            assert client.post("/wallets", json=wallet_body, headers=wallet_headers).json()["id"] == added.json()["id"]
            added = client.post("/budgets", json=budget_body)
            assert added.status_code == 201, added.text
    finally:
        limiter.enabled = enabled
        engine.dispose()
    print("PASS: payment ownership, fixed server price, signed webhook, provider reconciliation, duplicate delivery, renewal, mismatched amount, quota reserve/release, month reset and downgrade data retention")


if __name__ == "__main__":
    main()
