"""Verify forgot-password responses without sending email or writing to a database."""
import unittest
from types import SimpleNamespace
from unittest.mock import MagicMock, patch
from uuid import uuid4

from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.chuc_nang.nguoi_dung.dang_nhap.api import routes as auth
from app.dung_chung.http.phu_thuoc import get_db


class ForgotPasswordTest(unittest.TestCase):
    def setUp(self):
        self.db = MagicMock()
        app = FastAPI()
        app.include_router(auth.router)
        app.dependency_overrides[get_db] = lambda: self.db
        self.enterContext(patch.object(auth.limiter, "enabled", False))
        self.mail = self.enterContext(patch.object(auth.EmailService, "send_password_reset_otp"))
        self.client = self.enterContext(TestClient(app))

    def test_unregistered_email_returns_error_without_creating_or_sending_otp(self):
        self.db.scalar.return_value = None

        response = self.client.post("/auth/forgot-password", json={"email": "missing@example.com"})

        self.assertEqual(response.status_code, 404)
        self.assertEqual(response.json(), {"detail": "Email không tồn tại"})
        self.db.add.assert_not_called()
        self.db.query.assert_not_called()
        self.db.commit.assert_not_called()
        self.mail.assert_not_called()

    def test_registered_email_still_receives_otp(self):
        user = SimpleNamespace(
            id=uuid4(), email="registered@example.com", full_name="Test User",
            is_deleted=False, is_active=True,
        )
        self.db.scalar.side_effect = [user, None]

        response = self.client.post("/auth/forgot-password", json={"email": user.email})

        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.json()["success"])
        self.mail.assert_called_once()
        email, _, code = self.mail.call_args.args
        self.assertEqual(email, user.email)
        self.assertRegex(code, r"^\d{6}$")
        self.db.add.assert_called_once()
        self.db.commit.assert_called_once()


if __name__ == "__main__":
    unittest.main()
