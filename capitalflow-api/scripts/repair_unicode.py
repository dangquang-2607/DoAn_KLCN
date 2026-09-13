"""Repair only known legacy system labels; preserve before/after in audit_logs."""
import argparse
from sqlalchemy import select
from app.core.database import SessionLocal
from app.models.category import Category
from app.models.transaction import Transaction
from app.models.audit_log import AuditLog
import json

LABELS = {
    "Nhà ?": "Nhà ở", "Giáo d?c": "Giáo dục", "Mua s?m": "Mua sắm",
    "Chi phí doanh nghi?p": "Chi phí doanh nghiệp", "An u?ng": "Ăn uống",
    "Hóa don di?n nu?c": "Hóa đơn điện nước", "B?o hi?m": "Bảo hiểm",
    "Gi?i trí": "Giải trí", "Y t?": "Y tế", "Di chuy?n": "Di chuyển",
    "Thu nh?p khác": "Thu nhập khác", "Ð?u tu": "Đầu tư", "Thu?ng": "Thưởng",
}


def repair(apply=False):
    counts = {"categories": 0, "transactions": 0}
    with SessionLocal() as db:
        try:
            for old, new in LABELS.items():
                cats = db.scalars(select(Category).where(Category.owner_user_id.is_(None), Category.name == old).with_hint(Category, "WITH (UPDLOCK, ROWLOCK)", dialect_name="mssql")).all()
                for cat in cats:
                    duplicate = db.scalar(select(Category.id).where(Category.owner_user_id.is_(None), Category.name == new, Category.type == cat.type))
                    if duplicate:raise RuntimeError("Canonical category already exists; explicit merge required")
                    cat.name = new
                    db.add(AuditLog(action="UNICODE_REPAIR", entity_type="category", entity_id=cat.id, old_values_json=json.dumps({"name": old},ensure_ascii=False), new_values_json=json.dumps({"name":new},ensure_ascii=False)))
                    counts["categories"] += 1
                    for txn in db.scalars(select(Transaction).where(Transaction.category_id == cat.id, Transaction.description == "Chi tiêu: " + old)).all():
                        before = txn.description
                        txn.description = "Chi tiêu: " + new
                        db.add(AuditLog(action="UNICODE_REPAIR", entity_type="transaction", entity_id=txn.id, old_values_json=json.dumps({"description":before},ensure_ascii=False), new_values_json=json.dumps({"description":txn.description},ensure_ascii=False)))
                        counts["transactions"] += 1
            db.flush()
            if apply:db.commit()
            else:db.rollback()
        except Exception:
            db.rollback();raise
    return {"applied": apply, **counts}


if __name__ == "__main__":
    parser = argparse.ArgumentParser();parser.add_argument("--apply", action="store_true")
    print(json.dumps(repair(parser.parse_args().apply)))
