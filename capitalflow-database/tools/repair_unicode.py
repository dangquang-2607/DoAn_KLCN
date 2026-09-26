"""Sửa các trường hợp mojibake legacy đã biết và giữ dấu vết kiểm toán.

Vai trò: sửa giá trị Unicode sai đã được đối chiếu với dữ liệu/ảnh nguồn.
Đầu vào: CSDL cấu hình hiện tại, bảng ánh xạ chính xác và tùy chọn ``--apply``.
Đầu ra/side effect: báo cáo trước/sau; chỉ commit giá trị sửa khi được yêu cầu.
Ràng buộc an toàn: dry-run mặc định và không thay thế diện rộng theo ký tự mơ hồ.
"""

import argparse
import json
import sys
from collections.abc import Iterable
from pathlib import Path

# Công cụ database nằm ngoài API nhưng tái sử dụng model và session của ứng dụng.
sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "capitalflow-api"))

from sqlalchemy import select

from app.core.database import SessionLocal
from app.models.account import Account
from app.models.audit_log import AuditLog
from app.models.budget import Budget
from app.models.category import Category
from app.models.email_log import EmailLog
from app.models.invoice import Invoice
from app.models.invoice_item import InvoiceItem
from app.models.ocr_job import OcrJob
from app.models.transaction import Transaction


CATEGORY_REPAIRS = {
    "An u?ng": ("Ăn uống", "🍜"),
    "Di chuy?n": ("Di chuyển", "🚗"),
    "Nhà ?": ("Nhà ở", "🏠"),
    "Y t?": ("Y tế", "🏥"),
    "Giáo d?c": ("Giáo dục", "📚"),
    "Mua s?m": ("Mua sắm", "🛍️"),
    "Gi?i trí": ("Giải trí", "🎬"),
    "Hóa don di?n nu?c": ("Hóa đơn điện nước", "💡"),
    "B?o hi?m": ("Bảo hiểm", "🛡️"),
    "Chi phí doanh nghi?p": ("Chi phí doanh nghiệp", "💼"),
    "Khác": ("Khác", "📦"),
    "Luong": ("Lương", "💰"),
    "Thu?ng": ("Thưởng", "🎁"),
    "Ð?u tu": ("Đầu tư", "📈"),
    "Kinh doanh": ("Kinh doanh", "🏪"),
    "Thu nh?p khác": ("Thu nhập khác", "💵"),
}

DESCRIPTION_REPAIRS = {
    "Chi tiêu: An u?ng": "Chi tiêu: Ăn uống",
    "Chi tiêu: Di chuy?n": "Chi tiêu: Di chuyển",
    "Chi tiêu: Nhà ?": "Chi tiêu: Nhà ở",
    "Chi tiêu: Y t?": "Chi tiêu: Y tế",
    "Chi tiêu: Giáo d?c": "Chi tiêu: Giáo dục",
    "Chi tiêu: Mua s?m": "Chi tiêu: Mua sắm",
    "Chi tiêu: Gi?i trí": "Chi tiêu: Giải trí",
    "Chi tiêu: Hóa don di?n nu?c": "Chi tiêu: Hóa đơn điện nước",
    "Chi tiêu: B?o hi?m": "Chi tiêu: Bảo hiểm",
    "Chi tiêu: Chi phí doanh nghi?p": "Chi tiêu: Chi phí doanh nghiệp",
    "Thu nh?p t? Luong": "Thu nhập từ Lương",
    "Thu nh?p t? Thu?ng": "Thu nhập từ Thưởng",
    "Thu nh?p t? Ð?u tu": "Thu nhập từ Đầu tư",
    "Thu nh?p t? Kinh doanh": "Thu nhập từ Kinh doanh",
    "Thu nh?p t? Thu nh?p khác": "Thu nhập từ Thu nhập khác",
}

ACCOUNT_REPAIRS = {"Ti?t ki?m Binance": "Tiết kiệm Binance"}

EMAIL_LOG_REPAIRS = {
    "subject": {
        "?? Mã xác th?c OTP d?t l?i m?t kh?u - CapitalFlow":
            "🔑 Mã xác thực OTP đặt lại mật khẩu - CapitalFlow",
    },
    "error_message": {
        "G?i qua Console Logger (chua c?u hình SMTP)":
            "Gửi qua Console Logger (chưa cấu hình SMTP)",
    },
}

# Các tên này được đọc lại từ ảnh gốc người dùng đã tải lên.
INVOICE_ITEM_REPAIRS = {
    "dc8be6cf-2129-4cad-80fa-922664047742.jpg": {
        1: {"D?ch v? xe qua b?n": "Dịch vụ xe qua bến"},
        2: {"D?ch v? d?u theo gi?": "Dịch vụ đậu theo giờ"},
    },
    "6804c131-df48-49bd-b4e9-bea807479c7a.jpg": {
        1: {"Cà Phê Ðen Ðá (L)": "Cà Phê Đen Đá (L)"},
        2: {"Bánh Mì Th?p C?m Phúc Long": "Bánh Mì Thập Cẩm Phúc Long"},
    },
}

# Sửa nội dung OCR chính xác theo phạm vi ảnh nguồn đã được xác minh.
# Cách này ngăn thay thế diện rộng làm đổi các dấu hỏi hợp lệ.
OCR_TEXT_REPAIRS = {
    "dc8be6cf-2129-4cad-80fa-922664047742.jpg": {
        "M?T THÀNH VIÊN": "MỘT THÀNH VIÊN",
        "B?N XE MI?N ÐÔNG": "BẾN XE MIỀN ĐÔNG",
        "292 Ðinh B? Linh": "292 Đinh Bộ Lĩnh",
        "Phu?ng Bình Th?nh": "Phường Bình Thạnh",
        "Thành ph? H? Chí Minh": "Thành phố Hồ Chí Minh",
        "Vi?t Nam": "Việt Nam",
        "V?N T?I THUONG M?I": "VẬN TẢI THƯƠNG MẠI",
        "G?c": "Gốc",
        "Di chuy?n": "Di chuyển",
        "D?ch v? xe qua b?n": "Dịch vụ xe qua bến",
        "D?ch v? d?u theo gi?": "Dịch vụ đậu theo giờ",
        "Giu?ng": "Giường",
        "Block gi?": "Block giờ",
    },
    "6804c131-df48-49bd-b4e9-bea807479c7a.jpg": {
        "S? 15 Võ Tr?n Chí TP. H? Chí Minh": "Số 15 Võ Trần Chí TP. Hồ Chí Minh",
        "ti?n m?t": "tiền mặt",
        "G?c": "Gốc",
        "An u?ng & Ti?p khách": "Ăn uống & Tiếp khách",
        "Cà Phê Ðen Ðá (L)": "Cà Phê Đen Đá (L)",
        "Bánh Mì Th?p C?m Phúc Long": "Bánh Mì Thập Cẩm Phúc Long",
    },
    "2eba06d0-3244-4113-afd0-f4c1ce16362d.jpg": {
        "G?c": "Gốc",
        "Thi?t b?": "Thiết bị",
    },
}


def _audit(db, entity_type: str, entity_id, old_values: dict, new_values: dict) -> None:
    db.add(
        AuditLog(
            action="UNICODE_REPAIR",
            entity_type=entity_type,
            entity_id=entity_id,
            old_values_json=json.dumps(old_values, ensure_ascii=False),
            new_values_json=json.dumps(new_values, ensure_ascii=False),
        )
    )


def _move_category_links(db, source_id, target_id) -> Iterable[object]:
    for model in (Transaction, Budget, Invoice):
        for row in db.scalars(select(model).where(model.category_id == source_id)).all():
            _audit(
                db,
                model.__tablename__,
                row.id,
                {"category_id": str(source_id)},
                {"category_id": str(target_id)},
            )
            row.category_id = target_id
            yield row


def repair(apply: bool = False, sessions=SessionLocal) -> dict[str, int | bool]:
    counts = {
        "accounts": 0,
        "categories": 0,
        "category_links": 0,
        "transactions": 0,
        "invoice_items": 0,
        "ocr_documents": 0,
        "email_logs": 0,
    }
    with sessions() as db:
        try:
            for old_name, (new_name, new_icon) in CATEGORY_REPAIRS.items():
                categories = db.scalars(
                    select(Category)
                    .where(Category.owner_user_id.is_(None), Category.name == old_name)
                    .with_hint(Category, "WITH (UPDLOCK, ROWLOCK)", dialect_name="mssql")
                ).all()
                for category in categories:
                    duplicate_id = db.scalar(
                        select(Category.id).where(
                            Category.id != category.id,
                            Category.owner_user_id.is_(None),
                            Category.name == new_name,
                            Category.type == category.type,
                        )
                    )
                    old_values = {
                        "name": category.name,
                        "icon": category.icon,
                        "is_active": category.is_active,
                    }
                    if duplicate_id:
                        moved = list(_move_category_links(db, category.id, duplicate_id))
                        counts["category_links"] += len(moved)
                        _audit(
                            db,
                            "category",
                            category.id,
                            old_values,
                            {"deleted": True, "merged_into": str(duplicate_id)},
                        )
                        db.delete(category)
                        counts["categories"] += 1
                        continue
                    else:
                        category.name = new_name
                    category.icon = new_icon
                    new_values = {
                        "name": category.name,
                        "icon": category.icon,
                        "is_active": category.is_active,
                    }
                    if old_values != new_values:
                        _audit(db, "category", category.id, old_values, new_values)
                        counts["categories"] += 1

            for old_description, new_description in DESCRIPTION_REPAIRS.items():
                transactions = db.scalars(
                    select(Transaction)
                    .where(Transaction.description == old_description)
                    .with_hint(Transaction, "WITH (UPDLOCK, ROWLOCK)", dialect_name="mssql")
                ).all()
                for transaction in transactions:
                    _audit(
                        db,
                        "transaction",
                        transaction.id,
                        {"description": transaction.description},
                        {"description": new_description},
                    )
                    transaction.description = new_description
                    counts["transactions"] += 1

            for old_name, new_name in ACCOUNT_REPAIRS.items():
                accounts = db.scalars(
                    select(Account)
                    .where(Account.name == old_name)
                    .with_hint(Account, "WITH (UPDLOCK, ROWLOCK)", dialect_name="mssql")
                ).all()
                for account in accounts:
                    _audit(db, "account", account.id, {"name": old_name}, {"name": new_name})
                    account.name = new_name
                    counts["accounts"] += 1

            for field_name, replacements in EMAIL_LOG_REPAIRS.items():
                column = getattr(EmailLog, field_name)
                for old_text, new_text in replacements.items():
                    rows = db.scalars(select(EmailLog).where(column == old_text)).all()
                    for row in rows:
                        _audit(
                            db,
                            "email_log",
                            row.id,
                            {field_name: old_text},
                            {field_name: new_text},
                        )
                        setattr(row, field_name, new_text)
                        counts["email_logs"] += 1

            for storage_key, line_repairs in INVOICE_ITEM_REPAIRS.items():
                invoice = db.scalar(select(Invoice).where(Invoice.storage_key == storage_key))
                if not invoice:
                    continue
                items = db.scalars(select(InvoiceItem).where(InvoiceItem.invoice_id == invoice.id)).all()
                for item in items:
                    replacements = line_repairs.get(item.line_no, {})
                    new_name = replacements.get(item.name)
                    if not new_name:
                        continue
                    _audit(
                        db,
                        "invoice_item",
                        item.id,
                        {"name": item.name},
                        {"name": new_name, "evidence": storage_key},
                    )
                    item.name = new_name
                    counts["invoice_items"] += 1

            for storage_key, replacements in OCR_TEXT_REPAIRS.items():
                invoice = db.scalar(select(Invoice).where(Invoice.storage_key == storage_key))
                if not invoice:
                    continue
                documents = [(invoice, "extracted_json")]
                documents.extend(
                    (job, "response_json")
                    for job in db.scalars(select(OcrJob).where(OcrJob.invoice_id == invoice.id)).all()
                )
                for document, field_name in documents:
                    old_text = getattr(document, field_name)
                    if not old_text:
                        continue
                    new_text = old_text
                    for old_text_part, new_text_part in replacements.items():
                        new_text = new_text.replace(old_text_part, new_text_part)
                    if new_text == old_text:
                        continue
                    _audit(
                        db,
                        document.__tablename__,
                        document.id,
                        {"field": field_name, "corrupt_markers": old_text.count("?")},
                        {
                            "field": field_name,
                            "corrupt_markers": new_text.count("?"),
                            "evidence": storage_key,
                        },
                    )
                    setattr(document, field_name, new_text)
                    counts["ocr_documents"] += 1

            # Vẫn flush ở chế độ dry-run để phát hiện vi phạm constraint.
            db.flush()
            if apply:
                db.commit()
            else:
                db.rollback()
        except Exception:
            db.rollback()
            raise
    return {"applied": apply, **counts}


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--apply", action="store_true", help="commit repairs")
    print(json.dumps(repair(parser.parse_args().apply), ensure_ascii=False))
