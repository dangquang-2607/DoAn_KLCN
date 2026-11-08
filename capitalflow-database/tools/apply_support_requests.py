"""Rehearse support table creation; --apply verifies a backup and preserves existing rows."""

import argparse

from alembic import command
from sqlalchemy import create_engine, inspect, text
from sqlalchemy.engine import make_url

from apply_independent_wallets import backup, config
from retire_user_deletion import digest, snapshot
from app.dung_chung.config import settings

PREVIOUS = "cfdb_reporting_cover"
TARGET = "cfdb_support_requests"


def upgrade(conn):
    assert conn.scalar(text("SELECT DB_NAME()")) == "personal_finance"
    assert conn.scalar(text("SELECT version_num FROM alembic_version")) == PREVIOUS
    assert not inspect(conn).has_table("support_requests")
    before = {name: digest(rows) for name, rows in snapshot(conn).items() if name != "alembic_version"}
    command.upgrade(config(conn), TARGET)
    after = {name: digest(rows) for name, rows in snapshot(conn).items()
             if name not in {"alembic_version", "support_requests"}}
    assert before == after, "Existing rows changed; rolling back"
    assert conn.scalar(text("SELECT COUNT(*) FROM support_requests")) == 0
    command.check(config(conn))
    return len(before)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--apply", action="store_true")
    args = parser.parse_args()
    url = make_url(settings.database_url)
    assert url.get_backend_name() == "mssql" and url.database == "personal_finance"
    assert (url.host or "").lower().split("\\")[0] in {"localhost", "127.0.0.1", "."}
    assert not {"odbc_connect", "dsn"} & url.query.keys()
    engine = create_engine(url, hide_parameters=True)
    try:
        with engine.connect().execution_options(isolation_level="SERIALIZABLE") as conn:
            transaction = conn.begin()
            try:
                count = upgrade(conn)
            finally:
                transaction.rollback()
        print(f"REHEARSAL_PASS: {count} existing tables preserved; new table creation rolled back", flush=True)
        if args.apply:
            backup(url, "support_requests")
            with engine.connect().execution_options(isolation_level="SERIALIZABLE") as conn:
                with conn.begin():
                    upgrade(conn)
            print(f"MIGRATION_PASS: {TARGET}", flush=True)
    finally:
        engine.dispose()


if __name__ == "__main__":
    main()
