"""Chuẩn hóa dữ liệu số tiền và ngày do OCR trả về.

Vai trò: chuyển dữ liệu OCR nhiều định dạng thành kiểu dữ liệu nghiệp vụ an toàn.
Đầu vào: giá trị thô từ Gemini hoặc nguồn hóa đơn khác.
Đầu ra: Decimal và date đã kiểm tra.
Ràng buộc: từ chối chuỗi quá dài hoặc chứa ký tự không hợp lệ.
"""

import re
from datetime import date, datetime
from decimal import Decimal
from typing import Any


def parse_amount(raw: Any) -> Decimal:
    """Chuẩn hóa chuỗi số tiền Việt Nam hoặc quốc tế sang Decimal."""

    if raw is None:
        return Decimal("0")
    # XML already supplies Decimal; never interpret its scale as grouping.
    if isinstance(raw, (Decimal, int, float)) and not isinstance(raw, bool):
        result = Decimal(str(raw))
        if not result.is_finite():
            raise ValueError("Invalid OCR numeric value")
        return result
    value = str(raw).strip().replace("đ", "").replace("VND", "").replace("vnd", "").replace(" ", "")
    if not value:
        return Decimal("0")
    if len(value) > 64 or not re.fullmatch(r"-?[0-9]+(?:[.,][0-9]+)*", value):
        raise ValueError("Invalid OCR numeric value")

    # Phân biệt dấu phân cách hàng nghìn với phần thập phân trước khi đổi Decimal.
    if "," in value and "." in value:
        decimal_mark = "," if value.rfind(",") > value.rfind(".") else "."
        grouping = "." if decimal_mark == "," else ","
        pattern = rf"-?\d{{1,3}}(?:{re.escape(grouping)}\d{{3}})+{re.escape(decimal_mark)}\d+"
        if not re.fullmatch(pattern, value):
            raise ValueError("Invalid OCR numeric value")
        value = value.replace(grouping, "").replace(decimal_mark, ".")
    elif re.fullmatch(r"-?\d{1,3}(?:\.\d{3})+|-?\d{1,3}(?:,\d{3})+", value):
        value = re.sub(r"[.,]", "", value)
    elif re.fullmatch(r"-?\d+[.,]\d+", value):
        value = value.replace(",", ".")
    elif "." in value or "," in value:
        raise ValueError("Invalid OCR numeric value")

    try:
        return Decimal(value)
    except Exception as exc:
        raise ValueError("Invalid OCR numeric value") from exc


class UnsupportedInvoiceCurrency(ValueError):
    pass


class UnknownInvoiceCurrency(ValueError):
    pass


def draft_currency(raw: Any) -> str:
    try:
        return require_vnd_currency(raw)
    except UnknownInvoiceCurrency:
        return "VND"


def require_vnd_currency(raw: Any) -> str:
    value = re.sub(r"\s+", "", str(raw or "")).upper()
    if not value:
        raise UnknownInvoiceCurrency("Chưa xác định được tiền tệ của hóa đơn. Hãy dùng chứng từ ghi rõ VND.")
    if value not in {"VND", "VNĐ", "Đ", "₫", "ĐỒNG", "ĐỒNGVIỆTNAM"}:
        raise UnsupportedInvoiceCurrency("Chỉ hỗ trợ hóa đơn bằng VND; chưa hỗ trợ quy đổi ngoại tệ.")
    return "VND"


def parse_date(raw: Any) -> date | None:
    """Phân tích các định dạng ngày phổ biến trên hóa đơn Việt Nam."""

    if not raw:
        return None
    value = str(raw).strip()
    for date_format in ("%d/%m/%Y", "%Y-%m-%d", "%d-%m-%Y", "%d/%m/%y", "%Y/%m/%d"):
        try:
            return datetime.strptime(value, date_format).date()
        except ValueError:
            continue
    return None
