"""Verify support intake and SMTP responses in isolated SQLite with mocked SMTP."""

from datetime import datetime
from email import message_from_string
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch
from uuid import uuid4
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from fastapi import FastAPI, HTTPException
from fastapi.testclient import TestClient
from pydantic import ValidationError
from sqlalchemy import create_engine, event, func, select
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from starlette.requests import Request

import app.dung_chung.database.dang_ky_mo_hinh
from app.chuc_nang.nguoi_dung.dang_nhap.luu_tru.nguoi_dung import User, UserRole
from app.chuc_nang.quan_tri.ho_tro.api import require_support
from app.chuc_nang.quan_tri.ho_tro.luu_tru import AccountSupportCase, SupportRequest
from app.chuc_nang.quan_tri.ho_tro.yeu_cau import (
    NewSupportRequest, SupportReply, admin_router, user_router,
    list_requests, read_request, reply_to_request, submit_request,
)
from app.dung_chung.database.nen_tang import Base
from app.dung_chung.email.luu_tru.nhat_ky_email import EmailLog
from app.dung_chung.http.gioi_han_tan_suat import limiter
from app.dung_chung.http.phu_thuoc import get_current_user, get_db
from app.dung_chung.tac_vu_nen.hang_doi import now
from app.dung_chung.tac_vu_nen.luu_tru.tac_vu_nen import BackgroundJob
from app.dung_chung.tac_vu_nen.trinh_chay import run_once


def expect_error(status, action):
    try:
        action()
    except HTTPException as exc:
        assert exc.status_code == status, exc.detail
    else:
        raise AssertionError(f"Expected HTTP {status}")


def main():
    engine = create_engine("sqlite://", poolclass=StaticPool, connect_args={"check_same_thread": False})

    @event.listens_for(engine, "connect")
    def sqlite_functions(connection, _):
        connection.create_function("sysutcdatetime", 0, lambda: datetime.now().isoformat(" "))

    Base.metadata.create_all(engine)
    sessions = sessionmaker(bind=engine, expire_on_commit=False)
    smtp = {"smtp_host": "smtp.example.test", "smtp_port": 587, "smtp_user": "support@example.test",
            "smtp_password": "fake", "smtp_tls": True, "smtp_ssl": False,
            "emails_from_email": "support@example.test", "emails_from_name": "CapitalFlow"}
    with sessions() as db:
        user = User(email="owner@example.test", full_name="Người dùng", password_hash="fake")
        other = User(email="other@example.test", full_name="Other", password_hash="fake")
        admin = User(email="admin@example.test", full_name="Admin", password_hash="fake", role="ADMIN", support_only=True)
        db.add_all([user, other, admin])
        db.commit()
        request = Request({"type": "http", "method": "POST", "path": "/support/requests", "headers": []})
        with patch("app.chuc_nang.quan_tri.ho_tro.api.lock_admin_write", side_effect=lambda _request, _db, actor: actor):
            assert require_support(request, admin, db).id == admin.id
            expect_error(403, lambda: require_support(request, user, db))
            normal_admin = SimpleNamespace(role=UserRole.ADMIN, is_system_account=False, support_only=False)
            expect_error(403, lambda: require_support(request, normal_admin, db))
        for invalid in [
            {"title": "    ", "message": "message long enough"},
            {"title": "Title\nheader", "message": "message long enough"},
            {"title": "😀" * 51, "message": "message long enough"},
            {"title": "A title", "message": "message long enough", "email": "spoof@example.test"},
        ]:
            try:
                NewSupportRequest.model_validate({"request_id": uuid4(), **invalid})
            except ValidationError:
                pass
            else:
                raise AssertionError("Invalid support input accepted")
        payload = NewSupportRequest(request_id=uuid4(), title="  Kiểm tra <script>  ", message="Nội dung của người dùng <b>mẫu</b>")
        enabled = limiter.enabled
        limiter.enabled = False
        try:
            submit_request(request, payload, db, user)
            submit_request(request, payload, db, user)
            assert db.scalar(select(func.count()).select_from(SupportRequest)) == 1
            assert db.get(SupportRequest, payload.request_id).account_email == user.email
            expect_error(409, lambda: submit_request(request, payload, db, other))
            assert db.scalar(select(func.count()).select_from(AccountSupportCase)) == 0
        finally:
            limiter.enabled = enabled
        assert list_requests(1, db, admin)["items"][0]["reply_status"] == "NEW"
        reply = SupportReply(reply="Xin chào <img src=x onerror=alert(1)>\nĐã kiểm tra.")
        queued = reply_to_request(payload.request_id, reply, db, admin)
        assert queued["reply_status"] == "QUEUED"
        reply_to_request(payload.request_id, reply, db, admin)
        assert db.scalar(select(func.count()).select_from(BackgroundJob)) == 1
        expect_error(409, lambda: reply_to_request(payload.request_id, SupportReply(reply="Khác"), db, admin))
        job_id = db.get(SupportRequest, payload.request_id).reply_job_id
        db.commit()

    email_session = "app.dung_chung.email.dich_vu.SessionLocal"
    email_config = "app.dung_chung.email.dich_vu._get_effective_smtp"
    with patch(email_session, sessions), patch(email_config, return_value=smtp), patch("smtplib.SMTP") as transport:
        assert run_once(sessions, kinds={"EMAIL"})
        server = transport.return_value.__enter__.return_value
        assert server.sendmail.call_count == 1
        assert server.sendmail.call_args.args[1] == "owner@example.test"
        message = message_from_string(server.sendmail.call_args.args[2])
        html = next(part for part in message.walk() if part.get_content_type() == "text/html").get_payload(decode=True).decode()
        assert "&lt;img" in html and "&lt;script&gt;" in html and "<img src=x" not in html
        with sessions() as db:
            assert read_request(payload.request_id, db, admin)["reply_status"] == "SENT"
            assert db.get(EmailLog, job_id).status == "SENT"
            reply_to_request(payload.request_id, reply, db, admin)
            assert db.scalar(select(func.count()).select_from(BackgroundJob)) == 1

    with sessions() as db:
        second = SupportRequest(id=uuid4(), user_id=user.id, account_email=user.email, full_name=user.full_name,
                                title="Second request", message="Another support request")
        db.add(second)
        db.commit()
        second_id = second.id
        reply_to_request(second_id, SupportReply(reply="Phản hồi tiếp theo"), db, admin)
        second_job = second.reply_job_id

    with patch(email_session, sessions), patch(email_config, return_value={**smtp, "smtp_user": "", "smtp_password": ""}):
        for _ in range(3):
            assert run_once(sessions, kinds={"EMAIL"})
            with sessions() as db:
                db.get(BackgroundJob, second_job).available_at = now()
                db.commit()
    with sessions() as db:
        assert read_request(second_id, db, admin)["reply_status"] == "FAILED"
        reply_to_request(second_id, SupportReply(reply="Phản hồi tiếp theo"), db, admin)
        assert db.get(BackgroundJob, second_job).status == "PENDING"
        assert db.scalar(select(func.count()).select_from(BackgroundJob)) == 2

    with patch(email_session, sessions), patch(email_config, return_value=smtp), patch("smtplib.SMTP") as transport:
        assert run_once(sessions, kinds={"EMAIL"})
        assert transport.return_value.__enter__.return_value.sendmail.call_count == 1
    with sessions() as db:
        assert read_request(second_id, db, admin)["reply_status"] == "SENT"
        log = db.get(EmailLog, second_job)
        log.status = "UNKNOWN"
        job = db.get(BackgroundJob, second_job)
        job.status = "DEAD"
        job.error_code = "EmailDeliveryUncertain"
        db.commit()
        assert reply_to_request(second_id, SupportReply(reply="Phản hồi tiếp theo"), db, admin)["reply_status"] == "UNKNOWN"
        assert db.get(BackgroundJob, second_job).status == "DEAD"

    app = FastAPI()
    app.include_router(user_router)
    app.include_router(admin_router)
    actor = {"user": user}

    def get_test_db():
        with sessions() as db:
            yield db

    def get_test_user():
        if actor["user"] is None:
            raise HTTPException(401, "Authentication required")
        return actor["user"]

    app.dependency_overrides[get_db] = get_test_db
    app.dependency_overrides[get_current_user] = get_test_user
    enabled = limiter.enabled
    limiter.enabled = False
    try:
        with patch("app.chuc_nang.quan_tri.ho_tro.api.lock_admin_write", side_effect=lambda _request, _db, user: user), TestClient(app) as client:
            data = {"request_id": str(uuid4()), "title": "Yêu cầu qua HTTP", "message": "Nội dung hỗ trợ gửi qua API."}
            result = client.post("/support/requests", json=data)
            assert result.status_code == 201, result.text
            assert client.post("/support/requests", json=data).status_code == 201
            assert client.get("/support-requests").status_code == 403
            assert client.post("/support/requests", json={**data, "email": "spoof@example.test"}).status_code == 422
            actor["user"] = admin
            listing = client.get("/support-requests")
            assert listing.status_code == 200 and listing.json()["total"] == 3
            result = client.post(f"/support-requests/{data['request_id']}/reply", json={"reply": "Đã tiếp nhận vấn đề."})
            assert result.status_code == 202 and result.json()["reply_status"] == "QUEUED"
            assert client.post(f"/support-requests/{data['request_id']}/reply", json={"reply": "Đã tiếp nhận vấn đề."}).status_code == 202
            actor["user"] = None
            assert client.get("/support-requests").status_code == 401
    finally:
        limiter.enabled = enabled
    print("Support HTTP intake, permissions, SMTP delivery, duplicate prevention, failure retry and uncertain delivery passed.")


if __name__ == "__main__":
    main()
