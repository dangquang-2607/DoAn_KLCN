"""Retain payOS checkout fields and render its exact VietQR payload for the owner."""
import base64
import binascii
from decimal import Decimal, InvalidOperation
from functools import lru_cache
from io import BytesIO
import json
from typing import TypedDict

import qrcode
from qrcode.exceptions import DataOverflowError


class CheckoutData(TypedDict):
    qr_code: str
    bank_bin: str
    account_number: str
    account_name: str
    description: str
    amount: int


class CheckoutOut(CheckoutData):
    bank_name: str
    qr_image: str


def valid_qr(payload: str, amount: int) -> bool:
    """Reject truncated/non-VND QR codes or a transfer amount inconsistent with the order."""
    if not payload.startswith("000201") or len(payload) > 2048:
        return False
    try:
        raw = payload.encode("utf-8")
        if raw[-8:-4] != b"6304":
            return False
        if binascii.crc_hqx(raw[:-4], 0xFFFF) != int(raw[-4:], 16):
            return False
        fields: dict[bytes, bytes] = {}
        offset = 0
        while offset < len(raw):
            tag, size_text = raw[offset:offset + 2], raw[offset + 2:offset + 4]
            if len(tag) != 2 or not tag.isdigit() or len(size_text) != 2 or not size_text.isdigit() or tag in fields:
                return False
            size = int(size_text)
            end = offset + 4 + size
            if end > len(raw):
                return False
            fields[tag] = raw[offset + 4:end]
            offset = end
        value = Decimal(fields[b"54"].decode("ascii"))
        return fields.get(b"53") == b"704" and value.is_finite() and value == amount
    except (ValueError, KeyError, InvalidOperation, UnicodeError):
        return False


def validated(data: dict, amount: int) -> CheckoutData | None:
    qr = data.get("qr_code")
    bank = data.get("bank_bin")
    account = data.get("account_number")
    name = data.get("account_name")
    description = data.get("description")
    if data.get("amount") != amount:
        return None
    if not isinstance(qr, str) or not valid_qr(qr, amount):
        return None
    if not isinstance(bank, str) or len(bank) != 6 or not bank.isascii() or not bank.isdigit():
        return None
    if not isinstance(account, str) or not 1 <= len(account) <= 100 or not account.isascii() or not account.isalnum():
        return None
    if not isinstance(name, str) or not 1 <= len(name.strip()) <= 255 or "\x00" in name:
        return None
    if not isinstance(description, str) or not 1 <= len(description.strip()) <= 255 or "\x00" in description:
        return None
    return {"qr_code": qr, "bank_bin": bank, "account_number": account,
            "account_name": name.strip(), "description": description.strip(), "amount": amount}


def capture(data: dict, amount: int) -> str | None:
    clean = validated({"qr_code": data.get("qrCode"), "bank_bin": data.get("bin"),
                       "account_number": data.get("accountNumber"), "account_name": data.get("accountName"),
                       "description": data.get("description"), "amount": data.get("amount")}, amount)
    return json.dumps(clean, ensure_ascii=False, separators=(",", ":")) if clean else None


@lru_cache(maxsize=128)
def qr_image(payload: str) -> str:
    qr = qrcode.QRCode(error_correction=qrcode.constants.ERROR_CORRECT_M, box_size=8, border=4)
    qr.add_data(payload)
    qr.make(fit=True)
    buffer = BytesIO()
    qr.make_image(fill_color="black", back_color="white").save(buffer)
    return "data:image/png;base64," + base64.b64encode(buffer.getvalue()).decode("ascii")


def checkout_out(stored: str | None, amount: int) -> CheckoutOut | None:
    if not stored or len(stored) > 8192:
        return None
    try:
        parsed = json.loads(stored)
        clean = validated(parsed, amount) if isinstance(parsed, dict) else None
        if clean is None:
            return None
        result: CheckoutOut = {**clean, "bank_name": "MB Bank" if clean["bank_bin"] == "970422" else f"Ngân hàng BIN {clean['bank_bin']}",
                               "qr_image": qr_image(clean["qr_code"])}
        return result
    except (ValueError, TypeError, DataOverflowError):
        return None
