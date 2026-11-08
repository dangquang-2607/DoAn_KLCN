"""Versioned demo invoice QR contract shared by web and mobile clients."""
import base64
import hmac
import json
import re
from datetime import timezone
from decimal import Decimal
from secrets import token_bytes
from typing import Literal
from urllib.parse import parse_qs, urlsplit

import qrcode
from qrcode.image.svg import SvgPathFillImage
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, ConfigDict, Field, ValidationInfo, field_validator, model_validator
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.dung_chung.config import settings
from app.dung_chung.http.phu_thuoc import get_current_user, get_db
from app.dung_chung.text.unicode import normalize_unicode_text, validate_utf16_length
from app.chuc_nang.nguoi_dung.dang_nhap.luu_tru.nguoi_dung import User
from .luu_tru.wallet import Wallet, WalletEntry

router = APIRouter(prefix="/wallets/bills", tags=["Independent wallets"])
MAX_AMOUNT = Decimal("99999999999999999.99")
QR_VERSION = "2"


class BillItem(BaseModel):
    model_config = ConfigDict(extra="forbid")
    name: str = Field(min_length=1, max_length=100)
    quantity: int = Field(ge=1, le=1000)
    unit_price: Decimal = Field(gt=Decimal("0"), max_digits=19, decimal_places=2)

    @field_validator("name")
    @classmethod
    def valid_name(cls, value: str) -> str:
        value = normalize_unicode_text(value, strip=True)
        if not value:
            raise ValueError("Tên mặt hàng không được rỗng")
        validate_utf16_length(value, 100, "Tên mặt hàng")
        return value


class DemoBill(BaseModel):
    model_config = ConfigDict(extra="forbid")
    merchant_name: str = Field(min_length=1, max_length=150)
    currency: Literal["VND"] = "VND"
    note: str = Field(default="", max_length=200)
    items: list[BillItem] = Field(min_length=1, max_length=12)

    @field_validator("merchant_name", "note")
    @classmethod
    def valid_text(cls, value: str, info: ValidationInfo) -> str:
        value = normalize_unicode_text(value, strip=True)
        if info.field_name != "note":
            value = " ".join(value.split())
            if not value:
                raise ValueError("Thông tin hóa đơn không được rỗng")
        limit = 150 if info.field_name == "merchant_name" else 200
        validate_utf16_length(value, limit, "Thông tin hóa đơn")
        return value

    def total(self) -> Decimal:
        return sum((row.unit_price * row.quantity for row in self.items), Decimal(0)).quantize(Decimal("0.01"))

    @model_validator(mode="after")
    def total_in_range(self):
        if self.total() > MAX_AMOUNT:
            raise ValueError("Tổng tiền hóa đơn vượt giới hạn")
        return self


class BillPayload(DemoBill):
    # Accept signed QR codes issued before references were shortened.
    bill_reference: str = Field(pattern=r"^HD-(?:[A-Z2-7]{18}|[0-9A-F]{32})$")
    amount: Decimal = Field(gt=Decimal("0"), max_digits=19, decimal_places=2)

    @model_validator(mode="after")
    def matching_total(self):
        if self.amount != self.total():
            raise ValueError("Tổng hóa đơn không khớp các mặt hàng")
        return self


class BillQRInput(BaseModel):
    model_config = ConfigDict(extra="forbid")
    qr_payload: str = Field(min_length=1, max_length=4096)


def bill_signature(encoded: str) -> str:
    message = f"capitalflow:demo-bill:{QR_VERSION}:{encoded}".encode("ascii")
    return hmac.digest(settings.jwt_secret_key.encode(), message, "sha256").hex()


def parse_bill_qr(value: str) -> BillPayload:
    try:
        url = urlsplit(value.strip())
        query = parse_qs(url.query, keep_blank_values=True)
        if (url.scheme != "capitalflow" or url.netloc != "bill" or url.path or url.fragment
                or set(query) != {"v", "data", "sig"} or query["v"] != [QR_VERSION]
                or len(query["data"]) != 1 or len(query["sig"]) != 1):
            raise ValueError("Unsupported bill QR")
        encoded = query["data"][0]
        signature = query["sig"][0]
        if (not re.fullmatch(r"[A-Za-z0-9_-]+", encoded) or not re.fullmatch(r"[a-f0-9]{64}", signature)
                or not hmac.compare_digest(signature, bill_signature(encoded))):
            raise ValueError("Invalid QR data")
        raw = base64.urlsafe_b64decode(encoded + "=" * (-len(encoded) % 4))
        if len(raw) > 1400:
            raise ValueError("Oversized QR")
        return BillPayload.model_validate(json.loads(raw))
    except (ValueError, TypeError, KeyError, RecursionError) as exc:
        raise HTTPException(422, "QR hóa đơn CapitalFlow không hợp lệ. Hãy quét lại mã do màn hình mô phỏng tạo.") from exc


@router.post("/qr", summary="Tạo QR hóa đơn mô phỏng dùng chung cho web/mobile")
def create_bill_qr(payload: DemoBill, user: User = Depends(get_current_user)):
    reference = base64.b32encode(token_bytes(11)).decode("ascii").rstrip("=")
    data = {**payload.model_dump(mode="json"), "amount": str(payload.total()),
            "bill_reference": "HD-" + reference}
    raw = json.dumps(data, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
    if len(raw) > 1400:
        raise HTTPException(422, "Thông tin quá dài để tạo QR. Hãy rút gọn tên hoặc bớt mặt hàng.")
    encoded = base64.urlsafe_b64encode(raw).decode("ascii").rstrip("=")
    value = f"capitalflow://bill?v={QR_VERSION}&data={encoded}&sig={bill_signature(encoded)}"
    qr = qrcode.QRCode(error_correction=qrcode.constants.ERROR_CORRECT_M, border=4, box_size=8)
    qr.add_data(value)
    qr.make(fit=True)
    svg = qr.make_image(image_factory=SvgPathFillImage).to_string()
    return {**data, "demo": True, "qr_version": int(QR_VERSION), "qr_payload": value,
            "qr_image_data_url": "data:image/svg+xml;base64," + base64.b64encode(svg).decode("ascii")}


@router.post("/resolve", summary="Đọc và kiểm tra thông tin QR hóa đơn mô phỏng")
def resolve_bill_qr(payload: BillQRInput, user: User = Depends(get_current_user)):
    bill = parse_bill_qr(payload.qr_payload)
    return {**bill.model_dump(mode="json"), "demo": True, "qr_version": int(QR_VERSION),
            "qr_payload": payload.qr_payload.strip()}


@router.post("/payment-status", summary="Kiểm tra kết quả thanh toán hóa đơn")
def bill_payment_status(payload: BillQRInput, db: Session = Depends(get_db),
                        user: User = Depends(get_current_user)):
    bill = parse_bill_qr(payload.qr_payload)
    entry = db.scalar(
        select(WalletEntry).join(Wallet, Wallet.id == WalletEntry.wallet_id).where(
            Wallet.user_id == user.id, WalletEntry.kind == "PAYMENT",
            WalletEntry.bill_reference == bill.bill_reference, WalletEntry.merchant_name == bill.merchant_name,
            WalletEntry.amount == -bill.amount,
        )
    )
    if entry is None:
        return {"status": "UNCONFIRMED"}
    return {"status": "SUCCEEDED", "operation_id": entry.operation_id, "paid_amount": str(bill.amount),
            "paid_at": entry.created_at.replace(tzinfo=timezone.utc).isoformat()}
