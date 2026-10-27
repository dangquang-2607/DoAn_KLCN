import unittest
from pydantic import ValidationError
from app.chuc_nang.nguoi_dung.dang_nhap.schemas.auth import RegisterRequest, LoginRequest


class EmailAuthTest(unittest.TestCase):
    def test_registration_without_phone(self):
        payload = RegisterRequest(email='User@EXAMPLE.com', password='secret')
        self.assertEqual(payload.email, 'user@example.com')
        self.assertNotIn('phone_number', payload.model_dump())

    def test_login_email_and_compatibility_alias(self):
        for key in ('email', 'identifier'):
            self.assertEqual(LoginRequest(**{key: ' User@EXAMPLE.com ', 'password': 'secret'}).email, 'user@example.com')
            with self.assertRaises(ValidationError):
                LoginRequest(**{key: '0912345678', 'password': 'secret'})

    def test_removed_and_ambiguous_fields_rejected(self):
        with self.assertRaises(ValidationError):
            RegisterRequest(email='user@example.com', password='secret', phone_number='0912345678')
        with self.assertRaises(ValidationError):
            LoginRequest(email='a@example.com', identifier='b@example.com', password='secret')


if __name__ == '__main__':
    unittest.main()
