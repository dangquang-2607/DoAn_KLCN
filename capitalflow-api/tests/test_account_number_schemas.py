"""Unit checks: format, demo catalogue and three-digit masking."""
import unittest
from types import SimpleNamespace
from pydantic import ValidationError
from app.chuc_nang.nguoi_dung.tai_chinh.vi_tai_khoan.schemas import AccountCreate, AccountUpdate, SendOtpRequest
from app.chuc_nang.nguoi_dung.tai_chinh.vi_tai_khoan.number_rules import validate_account_number, mask_account_number, normalize_updated_number
from app.chuc_nang.nguoi_dung.tai_chinh.vi_tai_khoan.legacy_bank_sync.demo_catalog import DEMO_ACCOUNTS, find_demo

from app.chuc_nang.nguoi_dung.tai_chinh.vi_tai_khoan.legacy_bank_sync.demo_source import read_source

class AccountNumberSchemasTest(unittest.TestCase):
    def test_momo_gift_is_an_expense_with_stable_source_id(self):
        gift = next(event for event in read_source('MOMO').events if event.id == 'sample-3')
        self.assertEqual(gift.description, 'Mua quà tặng')
        self.assertEqual(gift.amount, -1000000)
        self.assertEqual(gift.status, 'BOOKED')

    def test_five_distinct_fixtures_and_balances(self):
        expected = {"VCB": 23450000, "ACB": 6320000, "MB": 18950000, "TCB": 20150000, "MOMO": 315000}
        for key, demo in DEMO_ACCOUNTS.items():
            self.assertEqual(find_demo(key, demo.number), demo)
            self.assertEqual(read_source(key).balance, expected[key])
            self.assertEqual(len(read_source(key).events), 4 if key in ("TCB", "MOMO") else 3)
            self.assertEqual(validate_account_number(key, demo.number), demo.number)

    def test_rejects_unknown_fixture_even_with_valid_format(self):
        for key, demo in DEMO_ACCOUNTS.items():
            with self.assertRaises(ValueError):
                find_demo(key, demo.number[:-1] + "0")
        for old in ("5678", "9012"):
            with self.assertRaises(ValueError):
                find_demo("MOMO", old)

    def test_raw_number_survives_request_validation_until_otp_binding(self):
        for key, demo in DEMO_ACCOUNTS.items():
            request = AccountCreate(name="Demo", account_type="LINKED", institution_name=key, account_number_masked=demo.number)
            self.assertEqual(request.account_number_masked, demo.number)

    def test_mask_has_original_length_and_only_three_digits(self):
        for demo in DEMO_ACCOUNTS.values():
            masked = mask_account_number(demo.number)
            self.assertEqual(len(masked), len(demo.number))
            self.assertEqual(masked[-3:], demo.number[-3:])
            self.assertEqual(set(masked[:-3]), {"*"})
        self.assertEqual(mask_account_number("0987654321"), "*******321")
        self.assertIsNone(mask_account_number(None))

    def test_invalid_format(self):
        for key, number in (("ACB", "0987654321"), ("MOMO", "0200000000"), ("VCB", "12345678"), ("TCB", "1" * 16)):
            with self.assertRaises(ValidationError):
                SendOtpRequest(institution_name=key, account_number=number)
        for number in ("12345", "1" * 21, "abcd123456", "****1234", "123456\n"):
            with self.assertRaises(ValidationError):
                SendOtpRequest(institution_name="MOMO", account_number=number)

    def test_new_and_legacy_masks_can_be_kept_on_metadata_update(self):
        for mask in ("****1234", "*******321", "**********901"):
            values = AccountUpdate(account_number_masked=mask).model_dump(exclude_unset=True)
            account = SimpleNamespace(account_type="LINKED", institution_name="MOMO", account_number_masked=mask)
            normalize_updated_number(account, values)
            self.assertEqual(values["account_number_masked"], mask)

    def test_basic_wallet_unchanged(self):
        self.assertIsNone(AccountCreate(name="Cash", account_type="BASIC").account_number_masked)
        self.assertEqual(AccountUpdate(name="Renamed").model_dump(exclude_unset=True), {"name": "Renamed"})

if __name__ == "__main__":
    unittest.main()
