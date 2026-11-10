"""Versioned evidence score for duplicate notifications, not an AI probability.

Seller 15, address 10, date 15, amount/currency 20; the two strongest
of receipt number, minute and detailed basket contribute 20 each.
Missing fields contribute zero. Existing identity rules still govern posting.
"""
from .doi_chieu_ban_le import address_matches, receipt_matches, seller_matches, words
from .chuan_hoa_hoa_don import parse_invoice_time


def similarity_percent(invoice, other, basket=(), other_basket=()):
    seller = seller_matches(invoice.merchant_name, other.merchant_name)
    seller = seller or bool(words(invoice.merchant_name) and words(invoice.merchant_name) == words(other.merchant_name))
    address = address_matches(invoice.merchant_address, other.merchant_address)
    day = bool(invoice.invoice_date and invoice.invoice_date == other.invoice_date)
    number = receipt_matches(invoice.invoice_number, other.invoice_number)
    # Currency is a prerequisite; common dates/amounts alone are not evidence.
    if invoice.currency != other.currency or not (seller or (address and number)) or not (day or number):
        return 0
    amount = invoice.total_amount is not None and invoice.total_amount == other.total_amount
    clock, other_clock = parse_invoice_time(invoice.invoice_time), parse_invoice_time(other.invoice_time)
    minute = bool(clock and other_clock and clock[:5] == other_clock[:5])
    items = bool(basket and basket == other_basket)
    score = 15 * seller + 10 * address + 15 * day + 20 * amount + 20 * min(2, sum((number, minute, items)))
    # Explicit identity contradictions require comparison, never a high alert.
    for field in ('invoice_number', 'merchant_tax_code'):
        left, right = ''.join(words(getattr(invoice, field))), ''.join(words(getattr(other, field)))
        if left and right and left != right:
            score = min(score, 80)
    if clock and other_clock and clock[:5] != other_clock[:5]:
        score = min(score, 80)
    return int(score)
