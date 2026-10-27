"""Copy/paste input must bind the same bank identity in OTP and confirmation."""
import unittest
from uuid import uuid4
from pydantic import ValidationError
from fastapi import HTTPException
from app.chuc_nang.nguoi_dung.tai_chinh.vi_tai_khoan.wallet_api import BankRequest, BankConfirm, demo_for
from app.chuc_nang.nguoi_dung.tai_chinh.vi_tai_khoan.demo_catalog import DEMO_ACCOUNTS


class WalletBankInputTest(unittest.TestCase):
    def test_pasted_numbers_bind_same_identity_for_send_and_confirm(self):
        for provider, demo in DEMO_ACCOUNTS.items():
            for value in (demo.number, ' ' + demo.number + '\u00a0', demo.number[:3] + '\u200b\t' + demo.number[3:] + '\ufeff'):
                with self.subTest(provider=provider, value=value):
                    request = BankRequest(provider=provider, account_number=value)
                    confirm = BankConfirm(provider=provider, account_number=value, otp='123456', otp_request_id=uuid4())
                    self.assertEqual(request.account_number, demo.number)
                    self.assertEqual(demo_for(request), demo_for(confirm))

    def test_invalid_input_is_not_silently_repaired(self):
        for value in ('', '   ', '1023456789a', '1023-456789', '12345', '1'*21, 1023456789):
            with self.subTest(value=value), self.assertRaises(ValidationError) as error:
                BankRequest(provider='VCB', account_number=value)
            self.assertIn('Số tài khoản', str(error.exception))

    def test_format_valid_but_wrong_demo_or_bank_is_rejected(self):
        for provider, number in (('VCB', '1023456780'), ('ACB', '1023456789'), ('MOMO', '0987654321')):
            with self.assertRaises(HTTPException) as error:
                demo_for(BankRequest(provider=provider, account_number=number))
            self.assertEqual(error.exception.status_code, 422)


if __name__ == '__main__':
    unittest.main()
