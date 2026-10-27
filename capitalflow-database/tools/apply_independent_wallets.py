"""Rehearse additive wallet migration; --apply backs up and applies after verification.

Keeps all existing rows/balances. Does not enable API/web flags or migrate users' money.
"""
import argparse
import sys
from pathlib import Path
from datetime import datetime, timezone
from uuid import uuid4
from pathlib import PureWindowsPath

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0,str(ROOT/'capitalflow-api'))
from alembic import command
from alembic.script import ScriptDirectory
from alembic.config import Config
from sqlalchemy import create_engine, inspect, text
from sqlalchemy.engine import make_url
from app.dung_chung.config import settings
from apply_bank_otp import snapshot

PREVIOUS='cfdb_bank_link_v2'
TARGET='cfdb_independent_wallets'
NEW_TABLES={'wallets','wallet_entries','wallet_bank_links','wallet_demo_banks'}


def config(conn):
    cfg=Config(str(ROOT/'capitalflow-database/alembic.ini'))
    cfg.set_main_option('script_location',str(ROOT/'capitalflow-database/alembic'))
    cfg.attributes['connection']=conn
    return cfg


def preflight(conn):
    assert conn.scalar(text('SELECT DB_NAME()'))=='personal_finance'
    assert conn.scalar(text('SELECT version_num FROM alembic_version'))==PREVIOUS, 'Unexpected revision; stop without changes'
    assert not NEW_TABLES.intersection(inspect(conn).get_table_names()), 'New tables already exist; inspect before retry'


def indexes(conn):
    return {t:inspect(conn).get_indexes(t) for t in inspect(conn).get_table_names() if t not in NEW_TABLES}


def upgrade(conn):
    conn.execute(text('SET LOCK_TIMEOUT 15000'))
    conn.execute(text('SELECT COUNT(*) FROM alembic_version WITH (TABLOCKX, HOLDLOCK)'))
    conn.execute(text('SELECT COUNT(*) FROM transactions WITH (TABLOCKX, HOLDLOCK)'))
    preflight(conn)
    before=snapshot(conn); before_indexes=indexes(conn)
    command.upgrade(config(conn),TARGET)
    after=snapshot(conn)
    assert {t:v for t,v in after.items() if t not in NEW_TABLES}==before, 'Existing data changed; rollback'
    assert all(after[t][0]==0 for t in NEW_TABLES)
    assert indexes(conn)==before_indexes, 'Existing indexes changed; rollback'
    assert next(c for c in inspect(conn).get_columns('transactions') if c['name']=='account_id')['nullable']
    # Later releases may have additional model fields; validate ORM at the final revision.
    if ScriptDirectory.from_config(config(conn)).get_current_head()==TARGET:
        command.check(config(conn))
    return before,before_indexes


def backup(url, label='independent_wallets'):
    engine=create_engine(url,isolation_level='AUTOCOMMIT',hide_parameters=True)
    try:
        with engine.connect() as conn:
            directory=conn.scalar(text("SELECT CAST(SERVERPROPERTY('InstanceDefaultBackupPath') AS nvarchar(4000))"))
        if not directory: raise RuntimeError('Backup path unavailable')
        if label not in {'independent_wallets','wallet_spending','user_phone','user_banks','email_only','default_wallet','wallet_short_code'}: raise ValueError('Unknown backup label')
        name=f'CapitalFlow_pre_{label}_{datetime.now(timezone.utc):%Y%m%d_%H%M%S}_{uuid4().hex[:8]}.bak'
        destination=str(PureWindowsPath(directory)/name)
        raw=engine.raw_connection()
        try:
            cursor=raw.cursor()
            try:
                cursor.execute('BACKUP DATABASE [personal_finance] TO DISK = ? WITH COPY_ONLY, CHECKSUM',destination)
                while cursor.nextset(): pass
                cursor.execute('RESTORE VERIFYONLY FROM DISK = ? WITH CHECKSUM',destination)
                while cursor.nextset(): pass
            finally: cursor.close()
        finally: raw.close()
        print('BACKUP_VERIFIED='+destination,flush=True)
    finally: engine.dispose()


def main():
    parser=argparse.ArgumentParser(description=__doc__); parser.add_argument('--apply',action='store_true'); args=parser.parse_args()
    url=make_url(settings.database_url)
    assert url.get_backend_name()=='mssql' and url.database=='personal_finance' and 'odbc_connect' not in url.query
    engine=create_engine(url,hide_parameters=True)
    try:
        with engine.connect() as conn: preflight(conn)
        if args.apply: backup(url)
        with engine.connect() as conn:
            outer=conn.begin()
            try:
                before,old_indexes=upgrade(conn)
                command.downgrade(config(conn),PREVIOUS)
                assert snapshot(conn)==before and indexes(conn)==old_indexes
                preflight(conn)
            finally: outer.rollback()
        print('REHEARSAL_PASS: upgrade/downgrade/rollback preserve existing data and indexes',flush=True)
        if args.apply:
            with engine.begin() as conn: before,_=upgrade(conn)
            with engine.connect() as conn:
                assert conn.scalar(text('SELECT version_num FROM alembic_version'))==TARGET
            print(f'MIGRATION_PASS: {TARGET}; {len(before)} existing tables unchanged; all 4 new tables empty',flush=True)
    finally: engine.dispose()


if __name__=='__main__': main()
