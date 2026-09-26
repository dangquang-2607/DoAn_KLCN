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
    value = str(raw).strip().replace("đ", "").replace("VND", "").replace("vnd", "").replace(" ", "")
    if not value:
        return Decimal("0")
    if len(value) > 64 or not re.fullmatch(r"-?[0-9]+(?:[.,][0-9]+)*", value):
        raise ValueError("Invalid OCR numeric value")

    # Phân biệt dấu phân cách hàng nghìn với phần thập phân trước khi đổi Decimal.
    if re.match(r"^-?\d{1,3}([.,]\d{3})+$", value):
        value = re.sub(r"[.,]", "", value)
    elif re.match(r"^-?\d+[.,]\d{1,2}$", value):
        value = value.replace(",", ".")
    elif "," in value and "." in value:
        value = value.replace(",", "")
    elif value.count(".") > 1:
        value = value.replace(".", "")
    elif value.count(",") > 1:
        value = value.replace(",", "")

    try:
        return Decimal(value)
    except Exception as exc:
        raise ValueError("Invalid OCR numeric value") from exc


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
