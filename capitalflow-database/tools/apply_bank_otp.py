"""Preflight bank OTP schema; --apply backs up, rehearses, and upgrades safely.

No real email is sent. OTP probes and rehearsal DDL are rolled back.
"""
import argparse
import asyncio
from datetime import datetime, timedelta, timezone
import hashlib
import json
from pathlib import Path, PureWindowsPath
import sys
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch
from uuid import uuid4

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "capitalflow-api"))

from alembic import command
from alembic.config import Config
from sqlalchemy import create_engine, inspect, select, text
from sqlalchemy.engine import make_url
from sqlalchemy.orm import Session
from app.dung_chung.config import settings
import app.dung_chung.database.dang_ky_mo_hinh  # Register ORM relationships.
from app.chuc_nang.nguoi_dung.dang_nhap.luu_tru.dat_lai_mat_khau import PasswordResetOTP
from app.chuc_nang.nguoi_dung.tai_chinh.vi_tai_khoan import api
from app.chuc_nang.nguoi_dung.tai_chinh.vi_tai_khoan.schemas import SendOtpRequest

PREVIOUS = "cfdb_invoice_dedup"
TARGET = "cfdb_bank_otp"


def preflight(conn):
    if conn.scalar(text("SELECT version_num FROM alembic_version")) != PREVIOUS:
        raise RuntimeError("Expected cfdb_invoice_dedup; no changes applied.")
    columns = {c["name"]: c for c in inspect(conn).get_columns("password_reset_otps")}
    if "purpose" in columns or columns["created_at"]["default"] is not None:
        raise RuntimeError("OTP schema differs from expected baseline; inspect before applying.")


def snapshot(conn):
    # Hash existing data in memory; never print user records, codes or secrets.
    result = {}
    inspector = inspect(conn)
    for table in inspector.get_table_names():
        if table in {"alembic_version", "sysdiagrams", "schema_migrations"}:
            continue
        names = [c["name"] for c in inspector.get_columns(table)
                 if not (table == "password_reset_otps" and c["name"] == "purpose")]
        quote = conn.dialect.identifier_preparer.quote
        sql = "SELECT " + ",".join(map(quote, names)) + " FROM " + quote(table)
        rows = sorted(json.dumps(list(row), default=str, ensure_ascii=True)
                      for row in conn.execute(text(sql)))
        result[table] = (len(rows), hashlib.sha256("\n".join(rows).encode()).hexdigest())
    return result


def backup(url):
    engine = create_engine(url, isolation_level="AUTOCOMMIT", hide_parameters=True)
    try:
        with engine.connect() as conn:
            directory = conn.scalar(text(
                "SELECT CAST(SERVERPROPERTY('InstanceDefaultBackupPath') AS nvarchar(4000))"))
        if not directory:
            raise RuntimeError("Backup directory unavailable.")
        filename = f"CapitalFlow_pre_bank_otp_{datetime.now(timezone.utc):%Y%m%d_%H%M%S}_{uuid4().hex[:8]}.bak"
        destination = str(PureWindowsPath(directory) / filename)
        raw = engine.raw_connection()
        try:
            cursor = raw.cursor()
            try:
                cursor.execute("BACKUP DATABASE [personal_finance] TO DISK = ? WITH COPY_ONLY, CHECKSUM", destination)
                while cursor.nextset():
                    pass
                cursor.execute("RESTORE VERIFYONLY FROM DISK = ? WITH CHECKSUM", destination)
                while cursor.nextset():
                    pass
            finally:
                cursor.close()
        finally:
            raw.close()
        return destination
    finally:
        engine.dispose()


def probe(conn):
    savepoint = conn.begin_nested()
    try:
        with Session(bind=conn, join_transaction_mode="rollback_only") as db:
            user_id = conn.scalar(text("SELECT TOP (1) id FROM users ORDER BY id"))
            if user_id is None:
                raise RuntimeError("No existing user available for the rolled-back OTP probe.")
            email = f"schema-check-{uuid4().hex}@example.invalid"
            user = SimpleNamespace(id=user_id, email=email)
            mail = AsyncMock()
            with patch.object(api, "send_otp_email", mail):
                response = asyncio.run(api.send_otp(
                    SendOtpRequest(institution_name="MOMO", account_number="0900000000"),
                    db=db, user=user,
                ))
            assert response["expires_in_seconds"] == 300
            mail.assert_awaited_once()
            record = db.scalar(select(PasswordResetOTP).where(PasswordResetOTP.email == email))
            assert record.purpose == "LINK_BANK" and record.created_at is not None
            assert record.otp_code == mail.await_args.kwargs["otp_code"]
            reset = PasswordResetOTP(email=email, otp_code="unused-probe",
                                     expires_at=datetime.now(timezone.utc) + timedelta(minutes=1))
            db.add(reset)
            db.flush()
            db.refresh(reset)
            assert reset.purpose == "RESET_PASSWORD" and reset.created_at is not None
    finally:
        savepoint.rollback()


def migrate(conn):
    conn.execute(text("SET LOCK_TIMEOUT 15000"))
    conn.execute(text("SELECT COUNT_BIG(*) FROM password_reset_otps WITH (TABLOCKX, HOLDLOCK)"))
    preflight(conn)
    before = snapshot(conn)
    cfg = Config(str(ROOT / "capitalflow-database/alembic.ini"))
    cfg.attributes["connection"] = conn
    command.upgrade(cfg, TARGET)
    probe(conn)
    assert snapshot(conn) == before, "Existing data changed; rolling back."
    assert conn.scalar(text(
        "SELECT COUNT(*) FROM password_reset_otps WHERE purpose <> 'RESET_PASSWORD'"
    )) == 0, "Unexpected legacy OTP purpose."
    command.check(cfg)
    return len(before)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--apply", action="store_true")
    args = parser.parse_args()
    url = make_url(settings.database_url)
    if url.get_backend_name() != "mssql" or url.database != "personal_finance" or "odbc_connect" in url.query:
        raise RuntimeError("This tool only targets configured personal_finance on SQL Server.")
    engine = create_engine(url, hide_parameters=True)
    try:
        with engine.connect() as conn:
            preflight(conn)
        print("PREFLIGHT_PASS", flush=True)
        if not args.apply:
            return
        print("BACKUP_VERIFIED=" + backup(url), flush=True)
        with engine.connect() as conn:
            transaction = conn.begin()
            try:
                migrate(conn)
            finally:
                transaction.rollback()
        with engine.connect() as conn:
            preflight(conn)
        print("REHEARSAL_PASS: DDL and OTP probes rolled back; no email sent.", flush=True)
        with engine.begin() as conn:
            tables = migrate(conn)
        with engine.connect() as conn:
            assert conn.scalar(text("SELECT version_num FROM alembic_version")) == TARGET
        print(f"MIGRATION_PASS: {TARGET}; existing data unchanged across {tables} tables; OTP probes passed.")
    finally:
        engine.dispose()


if __name__ == "__main__":
    main()
