"""Read-only by default; --apply backs up and adds one nullable checkout column."""
import argparse
import json
from alembic import command
from sqlalchemy import create_engine, inspect, text
from sqlalchemy.engine import make_url

from apply_independent_wallets import backup, config
from retire_user_deletion import digest, snapshot
from app.dung_chung.config import settings

PREVIOUS = "cfdb_premium_billing"
TARGET = "cfdb_premium_checkout"


def preflight(conn):
    assert conn.scalar(text("SELECT DB_NAME()")) == "personal_finance"
    version = conn.scalar(text("SELECT version_num FROM alembic_version"))
    columns = {column["name"] for column in inspect(conn).get_columns("premium_payment_orders")}
    assert version in {PREVIOUS, TARGET}, "Unexpected revision; no changes made"
    assert ("checkout_data" in columns) == (version == TARGET), "Schema and revision disagree"
    return version


def upgrade(conn):
    conn.execute(text("SET LOCK_TIMEOUT 15000"))
    assert preflight(conn) == PREVIOUS
    before = snapshot(conn)
    indexes = {table: inspect(conn).get_indexes(table) for table in before if table != "alembic_version"}
    command.upgrade(config(conn), TARGET)
    after = snapshot(conn)
    for row in after["premium_payment_orders"]:
        assert row.pop("checkout_data") is None, "Unexpected checkout values on existing rows"
    assert {table: digest(rows) for table, rows in before.items() if table != "alembic_version"} == {
        table: digest(rows) for table, rows in after.items() if table != "alembic_version"
    }, "Existing rows changed; transaction must roll back"
    assert indexes == {table: inspect(conn).get_indexes(table) for table in indexes}, "Indexes changed"
    command.check(config(conn))
    return len(before) - 1


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--apply", action="store_true")
    args = parser.parse_args()
    url = make_url(settings.database_url)
    assert url.get_backend_name() == "mssql" and url.database == "personal_finance"
    assert (url.host or "").lower().split("\\")[0].split(",")[0] in {"localhost", "127.0.0.1", ".", "(local)"}
    assert not {"odbc_connect", "dsn"} & url.query.keys()
    engine = create_engine(url, hide_parameters=True)
    try:
        with engine.connect() as conn:
            version = preflight(conn)
            counts = {status: count for status, count in conn.execute(text("SELECT status,COUNT(*) FROM premium_payment_orders GROUP BY status"))}
        print(json.dumps({"revision": version, "payment_counts": counts, "additive_column": "checkout_data"}), flush=True)
        if not args.apply or version == TARGET:
            return
        backup(url, "premium_checkout")
        with engine.connect().execution_options(isolation_level="SERIALIZABLE") as conn:
            transaction = conn.begin()
            try:
                count = upgrade(conn)
            finally:
                transaction.rollback()
        print(f"REHEARSAL_PASS: {count} tables preserved; additive migration rolled back", flush=True)
        with engine.connect().execution_options(isolation_level="SERIALIZABLE") as conn:
            with conn.begin():
                upgrade(conn)
        print(f"MIGRATION_PASS: {TARGET}; existing rows and indexes preserved", flush=True)
    finally:
        engine.dispose()


if __name__ == "__main__":
    main()
