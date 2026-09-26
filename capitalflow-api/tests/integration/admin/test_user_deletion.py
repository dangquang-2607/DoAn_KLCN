"""Kiểm thử soft delete, restore, purge và các guard chống xóa sai dữ liệu."""

from datetime import date, datetime, timedelta, timezone
from decimal import Decimal
from pathlib import Path
from uuid import UUID, uuid4

from sqlalchemy import func, select

from app.modules.dangnhap.api.routes import _create_refresh_token
from app.shared.security.passwords import hash_password
from app.modules.taichinh.persistence.account import Account
from app.modules.admin.persistence.audit_log import AuditLog
from app.modules.jobs.persistence.background_job import BackgroundJob
from app.modules.taichinh.persistence.budget import Budget
from app.modules.danhmuc.persistence.category import Category
from app.modules.email.persistence.email_log import EmailLog
from app.modules.taichinh.persistence.idempotency_record import IdempotencyRecord
from app.modules.hoadon.persistence.invoice import Invoice
from app.modules.hoadon.persistence.invoice_item import InvoiceItem
from app.modules.hoadon.persistence.ocr_job import OcrJob
from app.modules.dangnhap.persistence.password_reset import PasswordResetOTP
from app.modules.dangnhap.persistence.refresh_token import RefreshToken
from app.modules.email.persistence.system_setting import SystemSetting
from app.modules.taichinh.persistence.transaction import Transaction
from app.modules.dangnhap.persistence.user import User
from app.modules.admin.persistence.user_deletion import UserDeletionFile, UserDeletionRequest
from tests.integration.taichinh.test_transactions import headers
from tests.operational.test_security_contract import drain_jobs


def test_admin_soft_delete_revokes_sessions_hides_and_restores(
    client, db, test_user, test_admin, user_token, admin_token
):
    raw_refresh, _ = _create_refresh_token(db, test_user.id, uuid4())
    db.commit()

    response = client.request(
        "DELETE",
        f"/api/v1/admin/users/{test_user.id}",
        headers=headers(admin_token),
        json={"mode": "soft", "reason": "Theo yêu cầu kiểm thử", "release_email": True},
    )
    assert response.status_code == 200, response.text
    db.expire_all()
    deleted = db.get(User, test_user.id)
    assert deleted.is_deleted is True
    assert deleted.deletion_status == "SOFT_DELETED"
    assert deleted.email.endswith("@deleted.invalid")
    assert deleted.token_version == 1
    assert client.get("/api/v1/auth/me", headers=headers(user_token)).status_code == 403
    assert client.post("/api/v1/auth/refresh", json={"refresh_token": raw_refresh}).status_code in {401, 403}

    normal = client.get("/api/v1/admin/users", headers=headers(admin_token)).json()
    assert str(test_user.id) not in {row["id"] for row in normal["items"]}
    trash = client.get(
        "/api/v1/admin/users?status=deleted", headers=headers(admin_token)
    ).json()
    row = next(row for row in trash["items"] if row["id"] == str(test_user.id))
    assert row["email"] == "testuser@example.com"
    searched = client.get(
        "/api/v1/admin/users?status=deleted&search=testuser%40example.com",
        headers=headers(admin_token),
    ).json()
    assert [item["id"] for item in searched["items"]] == [str(test_user.id)]

    restored = client.post(
        f"/api/v1/admin/users/{test_user.id}/restore",
        headers=headers(admin_token),
        json={"reason": "Xóa nhầm"},
    )
    assert restored.status_code == 200, restored.text
    db.expire_all()
    user = db.get(User, test_user.id)
    assert user.email == "testuser@example.com"
    assert user.is_deleted is False
    assert user.deletion_status == "ACTIVE"
    assert user.token_version == 2
    login = client.post(
        "/api/v1/auth/login",
        json={"email": "testuser@example.com", "password": "password123"},
    )
    assert login.status_code == 200, login.text


def test_restore_stays_deleted_when_released_email_was_reused(
    client, db, test_user, admin_token
):
    response = client.request(
        "DELETE",
        f"/api/v1/admin/users/{test_user.id}",
        headers=headers(admin_token),
        json={"mode": "soft", "reason": "Kiểm tra email", "release_email": True},
    )
    assert response.status_code == 200
    db.add(
        User(
            email="testuser@example.com",
            full_name="New owner",
            password_hash=hash_password("new-password"),
            role="USER",
            is_active=True,
        )
    )
    db.commit()
    response = client.post(
        f"/api/v1/admin/users/{test_user.id}/restore",
        headers=headers(admin_token),
        json={"reason": "Khôi phục"},
    )
    assert response.status_code == 409
    db.expire_all()
    assert db.get(User, test_user.id).is_deleted is True


def test_admin_hard_delete_worker_purges_fk_graph_and_file(
    client, db, test_user, test_admin, admin_token, tmp_path, monkeypatch
):
    from app.shared.config import settings

    monkeypatch.setattr(settings, "upload_dir", str(tmp_path))
    user_id = test_user.id
    storage_key = "invoice-to-purge.png"
    (tmp_path / storage_key).write_bytes(b"test")
    category = Category(id=uuid4(), owner_user_id=test_user.id, name="Ăn uống", type="EXPENSE")
    account = Account(
        id=uuid4(), user_id=test_user.id, name="Ví", account_type="CASH", balance=Decimal("90")
    )
    invoice = Invoice(
        id=uuid4(),
        user_id=test_user.id,
        account_id=account.id,
        category_id=category.id,
        status="CONFIRMED",
        storage_key=storage_key,
        currency="VND",
    )
    # Tầng nghiệp vụ: hóa đơn tham chiếu tài khoản và danh mục vừa tạo.
    # Tầng kỹ thuật: flush các bản ghi cha trước để thứ tự INSERT không phụ thuộc tên module mapper.
    db.add_all([category, account])
    db.flush()
    db.add(invoice)
    db.flush()
    db.add_all(
        [
            InvoiceItem(invoice_id=invoice.id, line_no=1, name="Cà phê"),
            OcrJob(user_id=test_user.id, invoice_id=invoice.id, status="COMPLETED"),
            Transaction(
                user_id=test_user.id,
                account_id=account.id,
                category_id=category.id,
                invoice_id=invoice.id,
                amount=Decimal("-10"),
                type="EXPENSE",
                source="OCR",
                transaction_date=date.today(),
            ),
            Budget(
                user_id=test_user.id,
                category_id=category.id,
                name="Ăn uống",
                amount_limit=Decimal("100"),
                currency="VND",
                period_type="MONTHLY",
                start_date=date.today(),
                end_date=date.today(),
            ),
            IdempotencyRecord(
                user_id=test_user.id,
                request_key="delete-test",
                payload_hash="a" * 64,
                response_json="{}",
            ),
            PasswordResetOTP(
                user_id=test_user.id,
                email=test_user.email,
                otp_code="hash",
                expires_at=datetime.now(timezone.utc) + timedelta(minutes=5),
            ),
            SystemSetting(key="delete-test", value="x", updated_by=test_user.id),
            AuditLog(user_id=test_user.id, action="TEST", ip_address="127.0.0.1"),
            EmailLog(
                user_id=test_user.id,
                recipient=test_user.email,
                subject="Test",
                email_type="TEST",
                status="SENT",
            ),
        ]
    )
    _create_refresh_token(db, test_user.id, uuid4())
    db.commit()

    response = client.request(
        "DELETE",
        f"/api/v1/admin/users/{test_user.id}",
        headers=headers(admin_token),
        json={
            "mode": "hard",
            "reason": "Yêu cầu xóa dữ liệu",
            "confirmation": test_user.email,
        },
    )
    assert response.status_code == 202, response.text
    request_id = UUID(response.json()["deletion"]["id"])
    db.expire_all()
    assert db.get(User, test_user.id).deletion_status == "PURGE_PENDING"

    drain_jobs(db)
    db.expire_all()
    assert db.get(User, user_id) is None
    assert not (tmp_path / storage_key).exists()
    request = db.get(UserDeletionRequest, request_id)
    assert request.status == "COMPLETE"
    assert request.purge_checkpoint == "COMPLETE"
    assert request.file_total == request.files_deleted == 1
    assert request.target_email_sealed is None
    file_row = db.scalar(select(UserDeletionFile).where(UserDeletionFile.request_id == request_id))
    assert file_row.status == "DONE"
    for model, clause in (
        (Account, Account.user_id == user_id),
        (Transaction, Transaction.user_id == user_id),
        (Invoice, Invoice.user_id == user_id),
        (OcrJob, OcrJob.user_id == user_id),
        (Budget, Budget.user_id == user_id),
        (Category, Category.owner_user_id == user_id),
        (RefreshToken, RefreshToken.user_id == user_id),
        (PasswordResetOTP, PasswordResetOTP.user_id == user_id),
        (IdempotencyRecord, IdempotencyRecord.user_id == user_id),
    ):
        assert (db.scalar(select(func.count()).select_from(model).where(clause)) or 0) == 0
    setting = db.scalar(select(SystemSetting).where(SystemSetting.key == "delete-test"))
    assert setting.updated_by is None
    audit = db.scalar(select(AuditLog).where(AuditLog.action == "TEST"))
    assert audit.user_id is None and audit.ip_address is None
    email_log = db.scalar(select(EmailLog).where(EmailLog.subject == "Test"))
    assert email_log.user_id is None and email_log.recipient == "erased-user@redacted.invalid"


def test_delete_guardrails_and_hard_confirmation(client, test_user, test_admin, admin_token):
    self_delete = client.request(
        "DELETE",
        f"/api/v1/admin/users/{test_admin.id}",
        headers=headers(admin_token),
        json={"mode": "soft", "reason": "Không hợp lệ"},
    )
    assert self_delete.status_code == 400
    hard = client.request(
        "DELETE",
        f"/api/v1/admin/users/{test_user.id}",
        headers=headers(admin_token),
        json={"mode": "hard", "reason": "Kiểm tra", "confirmation": "sai"},
    )
    assert hard.status_code == 422
    blank_reason = client.request(
        "DELETE",
        f"/api/v1/admin/users/{test_user.id}",
        headers=headers(admin_token),
        json={"mode": "soft", "reason": "   "},
    )
    assert blank_reason.status_code == 422


def test_bulk_delete_is_soft_only_and_unban_cannot_restore(
    client, db, test_user, admin_token
):
    response = client.post(
        "/api/v1/admin/users/bulk-delete",
        headers=headers(admin_token),
        json={"user_ids": [str(test_user.id)], "reason": "Dọn tài khoản thử"},
    )
    assert response.status_code == 200, response.text
    assert response.json()["deleted_count"] == 1
    unban = client.patch(
        f"/api/v1/admin/users/{test_user.id}/unban", headers=headers(admin_token)
    )
    assert unban.status_code == 409
    db.expire_all()
    assert db.get(User, test_user.id).deletion_status == "SOFT_DELETED"


def test_hard_delete_rolls_back_on_cross_tenant_account_reference(
    client, db, test_user, test_admin, admin_token
):
    target_account = Account(
        id=uuid4(), user_id=test_user.id, name="Target", account_type="CASH", balance=Decimal("0")
    )
    other = User(
        id=uuid4(),
        email="other-delete-test@example.com",
        full_name="Other",
        password_hash=hash_password("other-password"),
        role="USER",
        is_active=True,
    )
    db.add_all([target_account, other])
    db.flush()
    foreign_transaction = Transaction(
        user_id=other.id,
        account_id=target_account.id,
        amount=Decimal("-1"),
        type="EXPENSE",
        transaction_date=date.today(),
    )
    db.add(foreign_transaction)
    db.commit()
    response = client.request(
        "DELETE",
        f"/api/v1/admin/users/{test_user.id}",
        headers=headers(admin_token),
        json={
            "mode": "hard",
            "reason": "Cross tenant probe",
            "confirmation": test_user.email,
        },
    )
    assert response.status_code == 202
    request_id = UUID(response.json()["deletion"]["id"])
    drain_jobs(db)
    # Worker chủ động thử lại lỗi tạm thời; đưa job cô lập tới lần thử cuối
    # mà không phải chờ toàn bộ khoảng lùi của môi trường vận hành thật.
    purge_job = db.scalar(
        select(BackgroundJob).where(
            BackgroundJob.kind == "USER_PURGE",
            BackgroundJob.dedupe_key == f"user-purge:{request_id}",
        )
    )
    assert purge_job.status == "PENDING" and purge_job.attempts == 1
    purge_job.attempts = 2
    purge_job.available_at = datetime.now(timezone.utc).replace(tzinfo=None)
    db.commit()
    drain_jobs(db)
    db.expire_all()
    request = db.get(UserDeletionRequest, request_id)
    assert request.status == "FAILED"
    assert request.purge_checkpoint == "REQUESTED"
    assert db.get(User, test_user.id) is not None
    assert db.get(Transaction, foreign_transaction.id) is not None


def test_failed_file_cleanup_can_be_retried(
    client, db, test_user, admin_token, tmp_path, monkeypatch
):
    from app.shared.config import settings

    monkeypatch.setattr(settings, "upload_dir", str(tmp_path))
    key = "locked-invoice.png"
    file_path = tmp_path / key
    file_path.write_bytes(b"locked")
    db.add(Invoice(user_id=test_user.id, status="UPLOADED", storage_key=key, currency="VND"))
    db.commit()
    response = client.request(
        "DELETE",
        f"/api/v1/admin/users/{test_user.id}",
        headers=headers(admin_token),
        json={
            "mode": "hard",
            "reason": "File retry probe",
            "confirmation": test_user.email,
        },
    )
    assert response.status_code == 202
    request_id = UUID(response.json()["deletion"]["id"])

    original_unlink = Path.unlink

    def blocked_unlink(path, *args, **kwargs):
        if path.name == key:
            raise PermissionError("locked")
        return original_unlink(path, *args, **kwargs)

    monkeypatch.setattr(Path, "unlink", blocked_unlink)
    drain_jobs(db)
    db.expire_all()
    request = db.get(UserDeletionRequest, request_id)
    assert request.status == "FAILED"
    assert request.purge_checkpoint == "DB_PURGED"
    assert file_path.exists()

    monkeypatch.setattr(Path, "unlink", original_unlink)
    retry = client.post(
        f"/api/v1/admin/user-deletions/{request_id}/retry-files",
        headers=headers(admin_token),
    )
    assert retry.status_code == 202, retry.text
    drain_jobs(db)
    db.expire_all()
    assert db.get(UserDeletionRequest, request_id).status == "COMPLETE"
    assert not file_path.exists()
