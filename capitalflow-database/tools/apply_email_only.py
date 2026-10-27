"""Back up, rehearse and apply phone removal while preserving all other user data."""
import argparse
from sqlalchemy import create_engine, text, inspect
from alembic import command
from apply_independent_wallets import config, backup
from apply_wallet_spending import snapshot, old_columns
from app.dung_chung.config import settings


def upgrade(conn):
    assert conn.scalar(text('SELECT DB_NAME()')) == 'personal_finance'
    assert conn.scalar(text('SELECT version_num FROM alembic_version')) == 'cfdb_phone_verify'
    columns = old_columns(conn)
    columns['users'] = [c for c in columns['users'] if not c.startswith('phone_')]
    columns.pop('password_reset_otps')
    before = snapshot(conn, columns)
    query = text("SELECT * FROM password_reset_otps WHERE purpose NOT LIKE 'PHONE[_]DEMO:%' AND purpose NOT LIKE 'PHONE[_]SMS:%' ORDER BY id")
    retained_otps = conn.execute(query).all()
    command.upgrade(config(conn), 'cfdb_email_only')
    assert snapshot(conn, columns) == before, 'User/account/financial data changed'
    assert conn.execute(query).all() == retained_otps, 'Email OTP data changed'
    assert not any(c['name'].startswith('phone_') for c in inspect(conn).get_columns('users'))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--apply', action='store_true')
    args = parser.parse_args()
    engine = create_engine(settings.database_url, hide_parameters=True)
    with engine.connect() as conn:
        columns = old_columns(conn); baseline = snapshot(conn, columns); conn.rollback()
        outer = conn.begin()
        try:
            upgrade(conn)
        finally:
            outer.rollback()
        assert snapshot(conn, columns) == baseline
    print('REHEARSAL_PASS: rollback restores all data; only phone columns/OTP removed', flush=True)
    if args.apply:
        backup(settings.database_url, 'email_only')
        with engine.begin() as conn:
            upgrade(conn)
        print('MIGRATION_PASS: email-only; user identities, bank links, balances, email OTP preserved', flush=True)


if __name__ == '__main__':
    main()
