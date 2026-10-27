"""Rehearse/back up the additive default-wallet migration, preserving all money."""
import argparse
from sqlalchemy import create_engine, text
from alembic import command
from apply_independent_wallets import config, backup
from apply_wallet_spending import snapshot, old_columns
from app.dung_chung.config import settings


def upgrade(conn):
    assert conn.scalar(text('SELECT DB_NAME()')) == 'personal_finance'
    assert conn.scalar(text('SELECT version_num FROM alembic_version')) == 'cfdb_email_only'
    conn.execute(text('SET LOCK_TIMEOUT 15000'))
    for table in ('users', 'wallets'):
        conn.execute(text(f'SELECT COUNT(*) FROM {table} WITH (TABLOCKX, HOLDLOCK)'))
    columns = old_columns(conn)
    wallet_columns = columns.pop('wallets')
    before = snapshot(conn, columns)
    select_old = 'SELECT ' + ','.join('[' + c + ']' for c in wallet_columns) + ' FROM wallets'
    wallets = conn.execute(text(select_old + ' ORDER BY id')).all()
    command.upgrade(config(conn), 'cfdb_default_wallet')
    assert snapshot(conn, columns) == before, 'Existing data changed'
    assert conn.execute(text(select_old + ' WHERE is_default = 0 ORDER BY id')).all() == wallets
    assert conn.scalar(text('SELECT COUNT(*) FROM wallets WHERE is_default=1')) == conn.scalar(text('SELECT COUNT(*) FROM users WHERE is_deleted=0'))
    assert conn.scalar(text('SELECT COUNT(*) FROM wallets WHERE is_default=1 AND (balance<>0 OR is_active<>1)')) == 0
    command.check(config(conn))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--apply', action='store_true')
    args = parser.parse_args()
    engine = create_engine(settings.database_url, hide_parameters=True)
    with engine.connect() as conn:
        columns = old_columns(conn); baseline = snapshot(conn, columns); conn.rollback()
        transaction = conn.begin()
        try:
            upgrade(conn)
        finally:
            transaction.rollback()
        after = snapshot(conn, columns)
        assert after == baseline, 'Tables changed during rehearsal: ' + ', '.join(t for t in baseline if after[t] != baseline[t])
    print('REHEARSAL_PASS: new default wallets start at zero; all original rows/balances preserved', flush=True)
    if args.apply:
        backup(settings.database_url, 'default_wallet')
        with engine.begin() as conn:
            upgrade(conn)
        print('MIGRATION_PASS: exactly one default wallet per existing nondeleted user', flush=True)


if __name__ == '__main__':
    main()
