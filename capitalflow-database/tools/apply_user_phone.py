"""Back up and rehearse additive user-phone migration without changing existing identities."""
import argparse
from sqlalchemy import create_engine, inspect, text
from sqlalchemy.engine import make_url
from alembic import command
from apply_independent_wallets import config, backup
from apply_wallet_spending import snapshot
from app.dung_chung.config import settings

PREVIOUS = 'cfdb_wallet_spending'
TARGET = 'cfdb_user_phone'


def preflight(conn):
    assert conn.scalar(text('SELECT DB_NAME()')) == 'personal_finance'
    assert conn.scalar(text('SELECT version_num FROM alembic_version')) == PREVIOUS
    assert 'phone_number' not in {c['name'] for c in inspect(conn).get_columns('users')}


def upgrade(conn):
    conn.execute(text('SET LOCK_TIMEOUT 15000'))
    conn.execute(text('SELECT COUNT(*) FROM users WITH (TABLOCKX, HOLDLOCK)'))
    preflight(conn)
    columns = {'users': [c['name'] for c in inspect(conn).get_columns('users')]}
    before = snapshot(conn, columns)
    indexes = inspect(conn).get_indexes('users')
    command.upgrade(config(conn), TARGET)
    assert snapshot(conn, columns) == before
    assert conn.scalar(text('SELECT COUNT(*) FROM users WHERE phone_number IS NOT NULL')) == 0
    assert [i for i in inspect(conn).get_indexes('users') if i['name'] != 'UX_users_phone_number'] == indexes
    return columns, before


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--apply', action='store_true')
    args = parser.parse_args()
    url = make_url(settings.database_url)
    assert url.get_backend_name() == 'mssql' and url.database == 'personal_finance'
    engine = create_engine(url, hide_parameters=True)
    try:
        with engine.connect() as conn:
            preflight(conn)
        if args.apply:
            backup(url, label='user_phone')
        with engine.connect() as conn:
            outer = conn.begin()
            try:
                columns, before = upgrade(conn)
                command.downgrade(config(conn), PREVIOUS)
                assert snapshot(conn, columns) == before
                assert [c['name'] for c in inspect(conn).get_columns('users')] == columns['users']
            finally:
                outer.rollback()
        print('REHEARSAL_PASS: upgrade/downgrade preserved existing user fields and indexes', flush=True)
        if args.apply:
            with engine.begin() as conn:
                upgrade(conn)
            print('MIGRATION_PASS: cfdb_user_phone; existing users retain email login; no phone inferred', flush=True)
    finally:
        engine.dispose()


if __name__ == '__main__':
    main()
