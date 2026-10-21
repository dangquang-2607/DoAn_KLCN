"""Dry-run by default. Run after cfdb_invoice_dedup with invoice writers stopped.

Never merges receipts or changes financial data. --apply is all-or-nothing and
refuses confirmed collisions/orphans. Safe to rerun after a successful batch.
"""
import argparse
from collections import defaultdict
import hashlib
import json
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "capitalflow-api"))
from sqlalchemy import create_engine, select, func
from sqlalchemy.orm import Session
from app.dung_chung.config import settings
import app.dung_chung.database.dang_ky_mo_hinh  # noqa: F401
from app.chuc_nang.nguoi_dung.hoa_don_ai.luu_tru.invoice import Invoice
from app.chuc_nang.nguoi_dung.hoa_don_ai.nghiep_vu.chuan_hoa_hoa_don import identity_key, normalized
from app.chuc_nang.nguoi_dung.dang_nhap.luu_tru.nguoi_dung import User
from app.chuc_nang.nguoi_dung.tai_chinh.giao_dich.luu_tru.giao_dich import Transaction
from app.chuc_nang.nguoi_dung.tai_chinh.vi_tai_khoan.luu_tru.account import Account


def backfill(db, upload_dir, *, apply=False):
    root = Path(upload_dir).resolve()
    if apply:
        # Same lock namespace/order as all invoice and money writers.
        db.scalars(select(User).order_by(User.id).with_hint(User, "WITH (UPDLOCK, ROWLOCK)", dialect_name="mssql")).all()
    invoices = db.scalars(select(Invoice).order_by(Invoice.id)).all()
    transactions = {r.invoice_id: r for r in db.scalars(select(Transaction).where(Transaction.invoice_id.is_not(None))).all()}
    before = (db.scalar(select(func.count()).select_from(Transaction)), db.scalar(select(func.sum(Account.balance))))
    groups = defaultdict(list)
    changes = []
    missing_files = []
    orphaned = []
    for invoice in invoices:
        file_hash = invoice.file_sha256
        if not file_hash and invoice.storage_key:
            path = (root / invoice.storage_key).resolve()
            if path.parent == root and path.is_file():
                with path.open("rb") as source:
                    file_hash = hashlib.file_digest(source, "sha256").hexdigest()
            else:
                missing_files.append(str(invoice.id))
        key = identity_key(invoice)
        changes.append((invoice, file_hash, key))
        if invoice.status == "CONFIRMED":
            if invoice.id not in transactions:
                orphaned.append(str(invoice.id))
            for kind, value in (("file", file_hash), ("identity", key)):
                if value:
                    groups[(str(invoice.user_id), kind, value)].append(str(invoice.id))
        elif invoice.id in transactions:
            orphaned.append(str(invoice.id))
    collisions = [ids for ids in groups.values() if len(ids) > 1]
    report = {"invoice_count": len(invoices), "missing_files": missing_files,
              "confirmed_collisions": collisions, "inconsistent_invoice_links": orphaned,
              "unlinked_ocr_transactions": db.scalar(select(func.count()).select_from(Transaction).where(
                  Transaction.source == "OCR", Transaction.invoice_id.is_(None))),
              "applied": False}
    if apply:
        if collisions or orphaned:
            db.rollback()
            raise ValueError("Backfill refused: confirmed collisions or inconsistent links require reconciliation.")
        for invoice, file_hash, key in changes:
            invoice.file_sha256 = file_hash
            invoice.strong_identity_key = key
            invoice.merchant_normalized = normalized(invoice.merchant_name) or None
            invoice.identity_rule_version = 1
        db.flush()
        after = (db.scalar(select(func.count()).select_from(Transaction)), db.scalar(select(func.sum(Account.balance))))
        if before != after:
            db.rollback()
            raise RuntimeError("Financial invariants changed during backfill")
        db.commit()
        report["applied"] = True
    else:
        db.rollback()
    return report


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--apply", action="store_true")
    args = parser.parse_args()
    engine = create_engine(settings.database_url, hide_parameters=True)
    try:
        with Session(engine, autoflush=False) as db:
            print(json.dumps(backfill(db, settings.upload_dir, apply=args.apply), ensure_ascii=False, indent=2))
    finally:
        engine.dispose()


if __name__ == "__main__":
    main()
