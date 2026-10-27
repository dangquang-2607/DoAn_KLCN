"""Regression for photographed Hai Beo receipts; no live database required."""
import unittest
from datetime import date, datetime, timedelta
from decimal import Decimal
from types import SimpleNamespace as NS
from uuid import uuid4
from app.chuc_nang.nguoi_dung.hoa_don_ai.nghiep_vu.doi_chieu_ban_le import basket_signature
from app.chuc_nang.nguoi_dung.hoa_don_ai.nghiep_vu.phat_hien_trung_lap import inspect_duplicates


def receipt(**changes):
    values = dict(id=uuid4(), user_id=uuid4(), merchant_name='HẢI BÉO1 BIA HƠI HÀ NỘI',
        merchant_address='2A Song Hành, Quốc Lộ, Trung Mỹ Tây, Quận 12, Hồ Chí Minh, Việt Nam',
        merchant_tax_code=None, invoice_number='120022', invoice_symbol=None,
        invoice_date=date(2026, 10, 12), invoice_time='20:57:00',
        total_amount=Decimal('1120000.00'), currency='VND', file_sha256=uuid4().hex,
        created_at=datetime(2026, 10, 22, 10), status='REVIEW_REQUIRED', revision=1,
        deleted_at=None, duplicate_of_invoice_id=None)
    values.update(changes)
    return NS(**values)


def lines():
    return [dict(name=name, quantity=1, unit_price=price, line_total=price)
            for name, price in [('Gỏi bò Hải Béo', 159000), ('Rau luộc thập cẩm kho quẹt', 99000), ('Đùi dê chiên', 139000)]]


class RetailMatchingTests(unittest.TestCase):
    def setUp(self):
        self.original = receipt(status='CONFIRMED')
        self.copy = receipt(user_id=self.original.user_id, merchant_name='HẢI BÉO 1 - BIA HƠI HÀ NỘI HẢI BÉO',
                            created_at=self.original.created_at + timedelta(minutes=1))

    def check(self, posted=True, baskets=None):
        return inspect_duplicates(None, self.copy.user_id, self.copy,
            rows=[(self.original, uuid4() if posted else None)], baskets=baskets or {})

    def test_screenshot_seller_variants_are_hard_blocked(self):
        for name in ['HẢI BÉO 1 - BIA HƠI HÀ NỘI HẢI BÉO', 'Bia Hơi Hà Nội Hải Béo 1', 'HẢI BÉO 1']:
            with self.subTest(name=name):
                self.copy.merchant_name = name
                result = self.check()
                self.assertEqual(result['level'], 'EXACT')
                self.assertFalse(result['can_override'])
                self.assertEqual(result['candidates'][0]['reason'], 'SAME_RETAIL_RECEIPT_TIME')

    def test_ocr_punctuation_accents_and_minute_precision(self):
        self.copy.merchant_address = '2a Song Hanh Quoc Lo Trung My Tay Quan 12 Ho Chi Minh Viet Nam'
        self.copy.invoice_time = '20:57'
        self.assertEqual(self.check()['level'], 'EXACT')

    def test_missing_time_needs_detailed_basket(self):
        self.copy.invoice_time = None
        self.assertEqual(self.check()['level'], 'SUSPECTED')
        sig = basket_signature(lines())
        result = self.check(baskets={self.copy.id: sig, self.original.id: sig})
        self.assertEqual(result['level'], 'EXACT')
        self.assertEqual(result['candidates'][0]['reason'], 'SAME_RETAIL_RECEIPT_ITEMS')

    def test_different_times_remain_reviewable_even_with_same_basket(self):
        self.copy.invoice_time = '21:57:00'
        sig = basket_signature(lines())
        self.assertEqual(self.check(baskets={self.copy.id: sig, self.original.id: sig})['level'], 'SUSPECTED')

    def test_missing_number_requires_time_and_complete_basket(self):
        sig = basket_signature(lines())
        baskets = {self.copy.id: sig, self.original.id: sig}
        for original_number, copy_number in [('120022', ''), (None, '120022'), (None, '')]:
            self.original.invoice_number, self.copy.invoice_number = original_number, copy_number
            result = self.check(baskets=baskets)
            self.assertEqual(result['level'], 'EXACT')
            self.assertFalse(result['can_override'])
            self.assertEqual(result['candidates'][0]['reason'], 'SAME_RETAIL_TIME_ITEMS')
            self.assertEqual(self.check()['level'], 'SUSPECTED')

    def test_ten_item_receipt_with_both_posted_ocr_variants(self):
        items = [dict(name=name, quantity=qty, unit_price=price, line_total=qty * price)
                 for name, qty, price in [
                     ('Gỏi bò Hải Béo', 1, 159000), ('Rau luộc thập cẩm kho quẹt', 1, 99000),
                     ('Bồ câu quay', 2, 159000), ('Dồi dê chiên', 1, 139000),
                     ('Tôm sú cháy tỏi -khuyến mãi', 1, 79000), ('Khăn lạnh', 5, 3000),
                     ('Nước suối', 2, 10000), ('Bia hơi Hà Nội ly', 2, 15000),
                     ('Tiger nâu lon', 6, 22000), ('Cơm chiên hải sản', 1, 129000)]]
        self.assertEqual(sum(i['line_total'] for i in items), 1120000)
        signature = basket_signature(items)
        items[4]['name'] = 'Tôm sú cháy tỏi - khuyến mãi'
        baskets = {self.original.id: signature, self.copy.id: basket_signature(items)}
        for original_name, original_number in [('HẢI BÉO 1 BIA HƠI HÀ NỘI', None),
                ('HẢI BÉO 1 - BIA HƠI HÀ NỘI HẢI BÉO', '120022')]:
            self.original.merchant_name, self.original.invoice_number = original_name, original_number
            for copy_name, copy_number in [('Bia Hơi Hà Nội Hải Béo 1', '120022'), ('HẢI BÉO 1', '')]:
                with self.subTest(original=original_name, copy=copy_name):
                    self.copy.merchant_name, self.copy.invoice_number = copy_name, copy_number
                    self.assertEqual(self.check(baskets=baskets)['level'], 'EXACT')

    def test_missing_number_does_not_mask_conflicting_or_missing_evidence(self):
        self.copy.invoice_number = None
        sig = basket_signature(lines())
        baskets = {self.copy.id: sig, self.original.id: sig}
        for field, value in [('invoice_time', None), ('invoice_time', '21:57:00'),
                             ('merchant_address', None), ('merchant_address', '3A Song Hành Quốc Lộ'),
                             ('invoice_number', '120023')]:
            with self.subTest(field=field, value=value):
                old = getattr(self.copy, field)
                setattr(self.copy, field, value)
                self.assertEqual(self.check(baskets=baskets)['level'], 'SUSPECTED')
                setattr(self.copy, field, old)
        changed = lines()
        changed[0]['quantity'] = 2
        baskets[self.copy.id] = basket_signature(changed)
        self.assertEqual(self.check(baskets=baskets)['level'], 'SUSPECTED')

    def test_basket_normalizes_accents_punctuation_and_row_order(self):
        items = lines()
        changed = list(reversed(lines()))
        changed[-1]['name'] = 'GOI BO HAI BEO!'
        self.assertEqual(basket_signature(items), basket_signature(changed))

    def test_distinct_receipt_numbers_do_not_hard_block(self):
        self.copy.invoice_number = '120023'
        self.assertEqual(self.check()['level'], 'SUSPECTED')

    def test_same_address_different_seller_not_hard_blocked(self):
        self.copy.merchant_name = 'BIA HƠI HÀ NỘI NAM AN'
        self.assertEqual(self.check()['level'], 'SUSPECTED')

    def test_conflicting_tax_codes_not_hard_blocked_as_retail(self):
        self.copy.merchant_tax_code, self.original.merchant_tax_code = '1234567890', '9876543210'
        self.assertEqual(self.check()['level'], 'SUSPECTED')

    def test_missing_number_or_address_is_only_warning(self):
        for field in ['invoice_number', 'merchant_address']:
            old = getattr(self.copy, field)
            setattr(self.copy, field, None)
            self.assertEqual(self.check()['level'], 'SUSPECTED')
            setattr(self.copy, field, old)

    def test_date_amount_differences_are_reviewable_but_currency_mismatch_is_not(self):
        for field, value in [('invoice_date', date(2026, 10, 13)), ('total_amount', Decimal('1120001')), ('currency', 'USD')]:
            old = getattr(self.copy, field)
            setattr(self.copy, field, value)
            self.assertEqual(self.check()['level'], 'NONE' if field == 'currency' else 'SUSPECTED')
            setattr(self.copy, field, old)

    def test_similarity_boundaries_and_missing_evidence(self):
        result = self.check()
        self.assertEqual(result['similarity_percent'], 100)
        self.copy.invoice_time = None
        result = self.check()
        self.assertEqual(result['similarity_percent'], 80)
        self.assertEqual(result['level'], 'SUSPECTED')
        self.copy.invoice_number = None
        self.copy.merchant_address = None
        self.assertEqual(self.check()['similarity_percent'], 50)
        self.copy.merchant_name = None
        self.assertEqual(self.check()['level'], 'NONE')

    def test_score_never_promotes_explicit_number_conflicts(self):
        self.copy.invoice_number = '120023'
        sig = basket_signature(lines())
        result = self.check(baskets={self.copy.id: sig, self.original.id: sig})
        self.assertLessEqual(result['similarity_percent'], 80)
        self.assertEqual(result['level'], 'SUSPECTED')

    def test_new_partial_candidates_have_score_and_reason(self):
        self.copy.total_amount = Decimal('1140000')
        result = self.check()
        self.assertEqual(result['similarity_percent'], 80)
        self.assertEqual(result['candidates'][0]['reason'], 'SIMILAR_DATA')
        self.assertTrue(result['can_override'])

    def test_unread_receipts_are_not_similar(self):
        for row in (self.copy, self.original):
            for field in ('merchant_name', 'merchant_address', 'invoice_date', 'invoice_time', 'invoice_number', 'total_amount'):
                setattr(row, field, None)
        self.assertEqual(self.check()['similarity_percent'], 0)
        self.assertEqual(self.check()['level'], 'NONE')

    def test_earliest_draft_remains_confirmable(self):
        self.copy.created_at = self.original.created_at - timedelta(minutes=1)
        self.assertEqual(self.check(posted=False)['level'], 'NONE')
        self.assertEqual(self.check(posted=True)['level'], 'EXACT')

    def test_hidden_posted_receipt_still_blocks(self):
        self.original.deleted_at = datetime.now()
        self.assertEqual(self.check()['level'], 'EXACT')

    def test_same_bytes_still_block_even_if_fields_are_changed(self):
        self.copy.file_sha256 = self.original.file_sha256
        self.copy.invoice_date, self.copy.total_amount = None, None
        self.assertEqual(self.check()['candidates'][0]['reason'], 'SAME_FILE')

    def test_preview_basket_override_and_review_token(self):
        self.copy.invoice_time = None
        sig = basket_signature(lines())
        baskets = {self.copy.id: sig, self.original.id: sig}
        old = self.check(baskets=baskets)
        self.copy._duplicate_items = []
        new = self.check(baskets=baskets)
        self.assertEqual(new['level'], 'SUSPECTED')
        # Stable transaction ID so only the basket changes the token.
        fixed = [(self.original, self.original.id)]
        token = inspect_duplicates(None, self.copy.user_id, self.copy, rows=fixed, baskets=baskets)['review_token']
        self.copy._duplicate_items = lines()
        self.assertNotEqual(token, inspect_duplicates(None, self.copy.user_id, self.copy, rows=fixed, baskets=baskets)['review_token'])
        self.assertEqual(old['level'], 'EXACT')

    def test_small_incomplete_or_zero_basket_not_strong_evidence(self):
        self.assertFalse(basket_signature(lines()[:1]))
        bad = lines()
        bad[1]['quantity'] = None
        self.assertFalse(basket_signature(bad))
        bad[1]['quantity'] = 0
        self.assertFalse(basket_signature(bad))


if __name__ == '__main__':
    unittest.main()
