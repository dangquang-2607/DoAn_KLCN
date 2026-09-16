"""Bounded parser for common Vietnamese electronic-invoice XML structures."""
from __future__ import annotations

from datetime import datetime
from decimal import Decimal, InvalidOperation
from xml.etree import ElementTree as ET


MAX_XML_NODES = 10_000


def _local(tag: str) -> str:
    return tag.rsplit("}", 1)[-1].lower()


def _text_by_names(root: ET.Element, *names: str) -> str | None:
    wanted = {name.lower() for name in names}
    for element in root.iter():
        if _local(element.tag) in wanted and element.text and element.text.strip():
            return element.text.strip()
    return None


def _amount(value: str | None) -> Decimal | None:
    if not value:
        return None
    try:
        return Decimal(value.strip().replace(" ", "").replace(",", ""))
    except InvalidOperation:
        return None


def _date(value: str | None):
    if not value:
        return None
    for fmt in ("%Y-%m-%d", "%d/%m/%Y", "%d-%m-%Y", "%Y/%m/%d"):
        try:
            return datetime.strptime(value[:10], fmt).date()
        except ValueError:
            continue
    return None


def parse_invoice_xml(contents: bytes) -> dict:
    upper_contents = contents.upper()
    if b"<!DOCTYPE" in upper_contents or b"<!ENTITY" in upper_contents:
        raise ValueError("XML chứa khai báo không được phép")
    try:
        root = ET.fromstring(contents)
    except ET.ParseError as exc:
        raise ValueError("Tệp XML không hợp lệ") from exc
    if sum(1 for _ in root.iter()) > MAX_XML_NODES:
        raise ValueError("Tệp XML có cấu trúc quá lớn")

    item_nodes = [node for node in root.iter() if _local(node.tag) in {"hhdvu", "item", "lineitem"}]
    items = []
    for node in item_nodes[:200]:
        name = _text_by_names(node, "THHDVu", "TenHHDV", "ItemName", "Description")
        if not name:
            continue
        items.append({
            "name": name[:500],
            "sku": _text_by_names(node, "MHHDVu", "MaHHDV", "ItemCode"),
            "unit": _text_by_names(node, "DVTinh", "UnitName"),
            "quantity": _amount(_text_by_names(node, "SLuong", "Quantity")),
            "unit_price": _amount(_text_by_names(node, "DGia", "UnitPrice")),
            "discount_amount": _amount(_text_by_names(node, "STCKhau", "DiscountAmount")),
            "tax_amount": _amount(_text_by_names(node, "TThue", "TaxAmount")),
            "line_total": _amount(_text_by_names(node, "ThTien", "Amount", "LineTotal")),
        })

    return {
        "merchant_name": _text_by_names(root, "Ten", "TenNBan", "SellerName"),
        "merchant_address": _text_by_names(root, "DChi", "DChiNBan", "SellerAddress"),
        "merchant_tax_code": _text_by_names(root, "MST", "MSTNBan", "SellerTaxCode"),
        "invoice_number": _text_by_names(root, "SHDon", "InvoiceNumber"),
        "invoice_symbol": _text_by_names(root, "KHHDon", "KHMSHDon", "InvoiceSymbol"),
        "invoice_date": _date(_text_by_names(root, "NLap", "InvoiceDate")),
        "vat_rate": _text_by_names(root, "TSuat", "VATRate"),
        "payment_method": _text_by_names(root, "HTTToan", "PaymentMethod"),
        "subtotal_amount": _amount(_text_by_names(root, "TgTCThue", "TotalAmountWithoutVAT", "SubTotal")),
        "tax_amount": _amount(_text_by_names(root, "TgTThue", "TotalVATAmount", "TaxTotal")),
        "total_amount": _amount(_text_by_names(root, "TgTTTBSo", "TgTTTToan", "TotalAmountWithVAT", "PayableAmount")),
        "items": items,
    }
