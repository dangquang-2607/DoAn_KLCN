"""Backup, preflight and atomically apply invoice schema/backfill without changing money.

Only targets the configured personal_finance database.
Never deletes/merges invoices or transactions. Retains the verified backup.
"""
import argparse
from collections import defaultdict
from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path, PureWindowsPath
import sys
from types import SimpleNamespace
from uuid import uuid4

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "capitalflow-api"))
from alembic import command
from alembic.config import Config
from sqlalchemy import create_engine, text
from sqlalchemy.engine import make_url
from sqlalchemy.orm import Session
from app.dung_chung.config import settings
from app.chuc_nang.nguoi_dung.hoa_don_ai.nghiep_vu.chuan_hoa_hoa_don import digest, identity_key
from backfill_invoice_dedup import backfill

TARGET_REVISION = "cfdb_invoice_dedup"


def preflight(connection, upload_dir):
    version = connection.scalar(text("SELECT version_num FROM alembic_version"))
    if version not in {"cfdb_recurring_budgets", TARGET_REVISION}:
        raise RuntimeError("Unexpected schema revision; refusing deployment")
    rows = connection.execute(text("SELECT id,user_id,status,storage_key,merchant_tax_code,invoice_number,"
        "invoice_symbol,invoice_date FROM invoices")).mappings().all()
    linked = {str(row.invoice_id) for row in connection.execute(text(
        "SELECT invoice_id FROM transactions WHERE invoice_id IS NOT NULL"))}
    groups = defaultdict(list)
    missing_files, inconsistent = [], []
    root = Path(upload_dir).resolve()
    for data in rows:
        row = SimpleNamespace(**data)
        key, file_hash = identity_key(row), None
        if row.storage_key:
            path = (root / row.storage_key).resolve()
            if path.parent == root and path.is_file():
                with path.open("rb") as source:
                    file_hash = hashlib.file_digest(source, "sha256").hexdigest()
            else:
                missing_files.append(str(row.id))
        if (row.status == "CONFIRMED") != (str(row.id) in linked):
            inconsistent.append(str(row.id))
        if row.status == "CONFIRMED":
            for kind, value in (("file", file_hash), ("identity", key)):
                if value:
                    groups[(str(row.user_id), kind, value)].append(str(row.id))
    report = {"revision": version, "invoice_count": len(rows), "missing_files": len(missing_files),
              "confirmed_collision_groups": sum(len(ids) > 1 for ids in groups.values()),
              "inconsistent_links": len(inconsistent),
              "unlinked_ocr_transactions": connection.scalar(text(
                  "SELECT COUNT(*) FROM transactions WHERE source='OCR' AND invoice_id IS NULL"))}
    if report["confirmed_collision_groups"] or report["inconsistent_links"]:
        raise RuntimeError("Preflight refused: reconcile confirmed collisions or inconsistent links first")
    return report


def financial_snapshot(connection):
    # Compare every financial record and balance, not just sums that could hide
    # offsetting changes. Data is hashed in memory and never printed to logs.
    values = {}
    for table in ("accounts", "transactions"):
        values[table] = [dict(row) for row in connection.execute(text(f"SELECT * FROM {table} ORDER BY id")).mappings()]
    counts = {table: connection.scalar(text(f"SELECT COUNT(*) FROM {table}"))
              for table in ("users", "accounts", "transactions", "invoices", "invoice_items", "budgets", "notifications")}
    return {"digest": digest(values), "counts": counts}


def verified_backup(url):
    engine = create_engine(url, isolation_level="AUTOCOMMIT", hide_parameters=True)
    try:
        with engine.connect() as connection:
            directory = connection.scalar(text("SELECT CAST(SERVERPROPERTY('InstanceDefaultBackupPath') AS nvarchar(4000))"))
        if not directory:
            raise RuntimeError("SQL Server backup directory unavailable")
        filename = f"CapitalFlow_pre_invoice_dedup_{datetime.now(timezone.utc):%Y%m%d_%H%M%S}_{uuid4().hex[:8]}.bak"
        path = str(PureWindowsPath(directory) / filename)
        raw = engine.raw_connection()
        try:
            cursor = raw.cursor()
            try:
                cursor.execute(f"BACKUP DATABASE [{url.database}] TO DISK = ? WITH COPY_ONLY, CHECKSUM", path)
                while cursor.nextset():
                    pass
                cursor.execute("RESTORE VERIFYONLY FROM DISK = ? WITH CHECKSUM", path)
                while cursor.nextset():
                    pass
            finally:
                cursor.close()
        finally:
            raw.close()
        return path
    finally:
        engine.dispose()


def apply(url):
    if url.get_backend_name() != "mssql" or url.database != "personal_finance" or "odbc_connect" in url.query:
        raise RuntimeError("Deployment only supports configured personal_finance")
    engine = create_engine(url, hide_parameters=True)
    try:
        with engine.connect() as connection:
            report = preflight(connection, settings.upload_dir)
        print("PREFLIGHT=" + json.dumps(report), flush=True)
        backup_path = verified_backup(url)
        print("BACKUP_VERIFIED=" + backup_path, flush=True)
        cfg = Config(str(ROOT / "capitalflow-database/alembic.ini"))
        with engine.begin() as connection:
            connection.execute(text("SET LOCK_TIMEOUT 15000"))
            # Block existing writers, including older invoice endpoints that
            # did not acquire a user lock. Locks release at the final commit.
            for table in ("users", "invoices", "accounts", "transactions"):
                connection.execute(text(f"SELECT COUNT_BIG(*) FROM {table} WITH (TABLOCKX, HOLDLOCK)"))
            preflight(connection, settings.upload_dir)
            before = financial_snapshot(connection)
            cfg.attributes["connection"] = connection
            command.upgrade(cfg, TARGET_REVISION)
            with Session(bind=connection, autoflush=False, join_transaction_mode="rollback_only") as db:
                result = backfill(db, settings.upload_dir, apply=True)
            if financial_snapshot(connection) != before:
                raise RuntimeError("Financial records changed; rolling back schema and backfill")
            command.check(cfg)
        with engine.connect() as connection:
            revision = connection.scalar(text("SELECT version_num FROM alembic_version"))
            if revision != TARGET_REVISION:
                raise RuntimeError("Unexpected revision after commit")
        print("MIGRATION_PASS=" + json.dumps({"database": url.database, "revision": revision,
            "invoices_backfilled": result["invoice_count"], "financial_records_unchanged": True,
            "missing_files": len(result["missing_files"]),
            "unlinked_ocr_transactions": result["unlinked_ocr_transactions"]}), flush=True)
        return backup_path
    finally:
        engine.dispose()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.parse_args()
    url = make_url(settings.database_url)
    apply(url)


if __name__ == "__main__":
    main()
