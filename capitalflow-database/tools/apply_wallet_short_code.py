"""Back up, rehearse and add short codes, preserving all existing wallet data."""
import argparse
from sqlalchemy import create_engine, text
from alembic import command
from apply_independent_wallets import config, backup
from apply_wallet_spending import snapshot, old_columns
from app.dung_chung.config import settings


def upgrade(conn):
    assert conn.scalar(text('SELECT DB_NAME()')) == 'personal_finance'
    assert conn.scalar(text('SELECT version_num FROM alembic_version')) == 'cfdb_default_wallet'
    conn.execute(text('SET LOCK_TIMEOUT 15000'))
    conn.execute(text('SELECT COUNT(*) FROM wallets WITH (TABLOCKX, HOLDLOCK)'))
    columns = old_columns(conn); before = snapshot(conn, columns)
    command.upgrade(config(conn), 'cfdb_wallet_short_code')
    assert snapshot(conn, columns) == before, 'Existing data changed'
    assert conn.scalar(text('SELECT COUNT(*) FROM wallets')) == conn.scalar(text('SELECT COUNT(DISTINCT short_code) FROM wallets'))
    command.check(config(conn))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--apply', action='store_true')
    args = parser.parse_args()
    engine = create_engine(settings.database_url, hide_parameters=True)
    with engine.connect() as conn:
        transaction = conn.begin()
        try:
            upgrade(conn)
        finally:
            transaction.rollback()
        assert conn.scalar(text('SELECT version_num FROM alembic_version')) == 'cfdb_default_wallet'
    print('REHEARSAL_PASS: unique short codes; original wallet identities, balances and history preserved', flush=True)
    if args.apply:
        backup(settings.database_url, 'wallet_short_code')
        with engine.begin() as conn:
            upgrade(conn)
        print('MIGRATION_PASS: codes assigned to existing wallets', flush=True)


if __name__ == '__main__':
    main()
