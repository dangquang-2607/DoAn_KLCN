"""Rehearse and back up user-wide bank links and explicit phone verification."""
import argparse
from sqlalchemy import create_engine, text
from alembic import command
from apply_independent_wallets import config, backup
from apply_wallet_spending import snapshot, old_columns
from app.dung_chung.config import settings


def upgrade(conn):
    assert conn.scalar(text('SELECT DB_NAME()')) == 'personal_finance'
    assert conn.scalar(text('SELECT version_num FROM alembic_version')) == 'cfdb_user_phone'
    columns = old_columns(conn)
    columns['wallet_demo_banks'].remove('account_number_masked')
    columns['password_reset_otps'].remove('is_used')
    before = snapshot(conn, columns)
    command.upgrade(config(conn), 'cfdb_phone_verify')
    assert snapshot(conn, columns) == before, 'Existing financial/identity data changed'
    assert conn.scalar(text('SELECT COUNT(*) FROM users WHERE phone_verified_at IS NOT NULL')) == 0
    return columns, before


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--apply', action='store_true')
    args = parser.parse_args()
    engine = create_engine(settings.database_url, hide_parameters=True)
    with engine.connect() as conn:
        columns = old_columns(conn)
        baseline = snapshot(conn, columns)
        conn.rollback()
        outer = conn.begin()
        try:
            upgrade(conn)
        finally:
            outer.rollback()
        assert snapshot(conn, columns) == baseline
    print('REHEARSAL_PASS: migrations/rollback preserve existing rows', flush=True)
    if args.apply:
        backup(settings.database_url, 'user_banks')
        with engine.begin() as conn:
            upgrade(conn)
        print('MIGRATION_PASS: cfdb_phone_verify', flush=True)


if __name__ == '__main__':
    main()
