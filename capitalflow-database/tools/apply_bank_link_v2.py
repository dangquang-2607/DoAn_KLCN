"""Widen masked account storage with backup, rollback rehearsal and data hashes."""
import argparse
from pathlib import Path
from alembic import command
from alembic.config import Config
from sqlalchemy import create_engine, inspect, text
from sqlalchemy.engine import make_url
from apply_bank_otp import backup, snapshot, settings

ROOT = Path(__file__).resolve().parents[2]
TARGET = "cfdb_bank_link_v2"


def preflight(conn):
    if conn.scalar(text("SELECT version_num FROM alembic_version")) != "cfdb_bank_otp":
        raise RuntimeError("Expected cfdb_bank_otp; no changes applied.")
    column = next(c for c in inspect(conn).get_columns("accounts") if c["name"] == "account_number_masked")
    if column["type"].length != 8:
        raise RuntimeError("Unexpected account-number storage width.")


def migrate(conn):
    conn.execute(text("SET LOCK_TIMEOUT 15000"))
    conn.execute(text("SELECT COUNT_BIG(*) FROM accounts WITH (TABLOCKX, HOLDLOCK)"))
    preflight(conn)
    before = snapshot(conn)
    cfg = Config(str(ROOT / "capitalflow-database/alembic.ini"))
    cfg.attributes["connection"] = conn
    command.upgrade(cfg, TARGET)
    command.check(cfg)
    assert snapshot(conn) == before, "Data changed; rollback required."
    return len(before)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--apply", action="store_true")
    args = parser.parse_args()
    url = make_url(settings.database_url)
    if url.get_backend_name() != "mssql" or url.database != "personal_finance" or "odbc_connect" in url.query:
        raise RuntimeError("Only configured SQL Server personal_finance is supported.")
    engine = create_engine(url, hide_parameters=True)
    try:
        with engine.connect() as conn:
            preflight(conn)
        print("PREFLIGHT_PASS", flush=True)
        if not args.apply:
            return
        print("BACKUP_VERIFIED=" + backup(url), flush=True)
        with engine.connect() as conn:
            tx = conn.begin()
            try:
                migrate(conn)
            finally:
                tx.rollback()
        with engine.connect() as conn:
            preflight(conn)
        print("REHEARSAL_ROLLBACK_PASS", flush=True)
        with engine.begin() as conn:
            count = migrate(conn)
        print(f"MIGRATION_PASS {TARGET}: {count} tables unchanged; no records deleted; no email sent.")
    finally:
        engine.dispose()


if __name__ == "__main__":
    main()
