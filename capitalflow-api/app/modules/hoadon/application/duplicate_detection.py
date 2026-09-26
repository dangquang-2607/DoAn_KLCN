"""Phát hiện hóa đơn trùng với dữ liệu đã xác nhận.

Vai trò: ngăn người dùng xác nhận cùng một hóa đơn nhiều lần.
Đầu vào: Session, user ID và Invoice đang được kiểm tra.
Đầu ra: cờ trùng cùng thông báo giải thích.
Ràng buộc: chỉ so sánh trong phạm vi một người dùng và hóa đơn CONFIRMED.
"""

import uuid

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.modules.hoadon.persistence.invoice import Invoice


def check_duplicate(db: Session, user_id: uuid.UUID, invoice: Invoice) -> tuple[bool, str | None]:
    """Kiểm tra theo số hóa đơn/MST rồi mới dùng bộ thuộc tính thay thế."""

    if invoice.merchant_tax_code and invoice.invoice_number:
        duplicate = db.scalar(
            select(Invoice).where(
                Invoice.user_id == user_id,
                Invoice.id != invoice.id,
                Invoice.status == "CONFIRMED",
                Invoice.merchant_tax_code == invoice.merchant_tax_code,
                Invoice.invoice_number == invoice.invoice_number,
            )
        )
        if duplicate:
            return True, (
                f"Trùng số hóa đơn {invoice.invoice_number} từ MST "
                f"{invoice.merchant_tax_code} (đã xác nhận ngày {duplicate.confirmed_at})"
            )

    if invoice.merchant_name and invoice.invoice_date and invoice.total_amount:
        duplicate = db.scalar(
            select(Invoice).where(
                Invoice.user_id == user_id,
                Invoice.id != invoice.id,
                Invoice.status == "CONFIRMED",
                Invoice.merchant_name == invoice.merchant_name,
                Invoice.invoice_date == invoice.invoice_date,
                Invoice.total_amount == invoice.total_amount,
            )
        )
        if duplicate:
            return True, (
                f"Trùng hóa đơn từ '{invoice.merchant_name}' ngày {invoice.invoice_date} "
                f"số tiền {invoice.total_amount:,.0f} VND"
            )
    return False, None
