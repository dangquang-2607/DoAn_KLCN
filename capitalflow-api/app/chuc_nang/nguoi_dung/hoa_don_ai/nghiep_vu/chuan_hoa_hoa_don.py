"""Versioned deterministic invoice identity; never use filename or OCR confidence."""
import hashlib
import json
import re
import unicodedata
from datetime import time
from decimal import Decimal


def normalized(value):
    return " ".join(unicodedata.normalize("NFC", str(value or "")).split()).casefold()


def digest(value):
    return hashlib.sha256(json.dumps(value, ensure_ascii=False, sort_keys=True,
                                     default=str, separators=(",", ":")).encode()).hexdigest()


def parse_invoice_time(value):
    if not value:
        return None
    try:
        parsed = time.fromisoformat(str(value).strip())
        return parsed.replace(tzinfo=None, microsecond=0).isoformat()
    except ValueError:
        return None


def identity_key(invoice):
    tax = normalized(invoice.merchant_tax_code)
    number = normalized(invoice.invoice_number)
    symbol = normalized(invoice.invoice_symbol)
    day = invoice.invoice_date
    # A retail receipt has no universally reliable numbering namespace. Until
    # that namespace is known, use it as evidence for review, never a hard key.
    if re.fullmatch(r"[0-9]{10}(?:-?[0-9]{3})?", tax) and number and symbol and day:
        return digest([1, "TAX", tax.replace("-", ""), symbol, number, day.year])
    return None


def refresh_identity(invoice):
    invoice.merchant_normalized = normalized(invoice.merchant_name) or None
    invoice.strong_identity_key = identity_key(invoice)
    invoice.identity_rule_version = 1


def content_snapshot(invoice):
    result = {name: str(getattr(invoice, name, None) or "") for name in (
        "merchant_name", "merchant_address", "merchant_tax_code", "invoice_number",
        "invoice_symbol", "invoice_date", "invoice_time", "total_amount", "currency", "file_sha256",
    )}
    if invoice.total_amount is not None:
        result["total_amount"] = str(Decimal(invoice.total_amount).quantize(Decimal("0.01")))
    return result
