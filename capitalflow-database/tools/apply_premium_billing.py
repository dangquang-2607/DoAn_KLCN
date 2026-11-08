"""Rehearse additive Premium schema; --apply verifies backup and preserves existing data."""
import argparse
from alembic import command
from sqlalchemy import create_engine, inspect, text
from sqlalchemy.engine import make_url
from apply_independent_wallets import backup, config
from retire_user_deletion import digest, snapshot
from app.dung_chung.config import settings

PREVIOUS = "cfdb_support_requests"
TARGET = "cfdb_premium_billing"
TABLES = {"user_subscriptions", "premium_payment_orders", "ai_monthly_usage"}


def upgrade(conn):
    conn.execute(text("SET LOCK_TIMEOUT 15000"))
    assert conn.scalar(text("SELECT DB_NAME()")) == "personal_finance"
    assert conn.scalar(text("SELECT version_num FROM alembic_version")) == PREVIOUS
    assert not TABLES.intersection(inspect(conn).get_table_names())
    before = {name: digest(rows) for name, rows in snapshot(conn).items() if name != "alembic_version"}
    command.upgrade(config(conn), TARGET)
    after = {name: digest(rows) for name, rows in snapshot(conn).items() if name not in TABLES | {"alembic_version"}}
    assert before == after, "Existing rows changed; rolling back"
    for table in TABLES:
        assert conn.scalar(text(f"SELECT COUNT(*) FROM {table}")) == 0
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
                command.downgrade(config(conn), PREVIOUS)
                assert not TABLES.intersection(inspect(conn).get_table_names())
            finally:
                transaction.rollback()
        print(f"REHEARSAL_PASS: {count} existing tables preserved, upgrade/downgrade rolled back", flush=True)
        if args.apply:
            backup(url, "premium_billing")
            with engine.connect().execution_options(isolation_level="SERIALIZABLE") as conn:
                with conn.begin():
                    upgrade(conn)
            print(f"MIGRATION_PASS: {TARGET}", flush=True)
    finally:
        engine.dispose()


if __name__ == "__main__":
    main()
