"""Corroborate a photographed retail receipt; never use a seller name alone."""
import re
import unicodedata
from decimal import Decimal, InvalidOperation
from .chuan_hoa_hoa_don import parse_invoice_time


def words(value):
    value = unicodedata.normalize('NFKD', str(value or '').casefold().replace('đ', 'd'))
    value = ''.join(c for c in value if not unicodedata.combining(c))
    return re.findall(r'[a-z]+|[0-9]+', value)


def seller_matches(left, right):
    a, b = set(words(left)), set(words(right))
    generic = {'bia', 'hoi', 'ha', 'noi', 'cua', 'hang', 'quan', 'nha', 'coffee', 'cafe', 'restaurant'}
    distinctive = {w for w in a & b if len(w) > 1 and not w.isdigit()} - generic
    if not a or not b or not distinctive:
        return False
    # OCR may repeat a logo or omit a branch's descriptive suffix.
    return a == b or (len(distinctive) >= 2 and (a <= b or b <= a or len(a & b) / len(a | b) >= .8))


def receipt_matches(left, right):
    a, b = ''.join(words(left)), ''.join(words(right))
    return len(a) >= 3 and any(c.isdigit() for c in a) and a == b


def address_matches(left, right):
    a, b = words(left), words(right)
    return bool(a and a == b and any(w.isdigit() for w in a) and len(a) >= 4)


def basket_signature(items):
    result = []
    for item in items:
        read = item.get if isinstance(item, dict) else lambda key: getattr(item, key, None)
        name = ' '.join(words(read('name')))
        if not name:
            return ()
        try:
            numbers = [Decimal(str(read(key))) for key in ('quantity', 'unit_price', 'line_total')]
        except (InvalidOperation, ValueError, TypeError):
            return ()
        if any(not number.is_finite() or number <= 0 for number in numbers):
            return ()
        result.append((name, *(str(number.normalize()) for number in numbers)))
    # One common coffee item is not enough independent evidence without time.
    return tuple(sorted(result)) if len(set(result)) >= 3 else ()


def retail_reason(invoice, other, basket=(), other_basket=()):
    if not (address_matches(invoice.merchant_address, other.merchant_address)
            and seller_matches(invoice.merchant_name, other.merchant_name)):
        return None
    tax, other_tax = ''.join(words(invoice.merchant_tax_code)), ''.join(words(other.merchant_tax_code))
    if tax and other_tax and tax != other_tax:
        return None
    clock = parse_invoice_time(invoice.invoice_time)
    other_clock = parse_invoice_time(other.invoice_time)
    number, other_number = words(invoice.invoice_number), words(other.invoice_number)
    if number and other_number and not receipt_matches(invoice.invoice_number, other.invoice_number):
        return None
    if not number or not other_number:
        # OCR can omit the printed number entirely. Require BOTH the minute
        # and a detailed matching basket before blocking a distinct photo.
        if clock and other_clock and clock[:5] == other_clock[:5] and basket and basket == other_basket:
            return 'SAME_RETAIL_TIME_ITEMS'
        return None
    if clock and other_clock:
        # Preserve explicit time disagreements instead of overriding them with
        # a common basket. Ignore seconds because OCR often only has HH:mm.
        return 'SAME_RETAIL_RECEIPT_TIME' if clock[:5] == other_clock[:5] else None
    if basket and basket == other_basket:
        return 'SAME_RETAIL_RECEIPT_ITEMS'
    return None
