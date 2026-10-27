"""Rehearse payment/reporting migration; --apply backs up and preserves all old fields."""
import argparse
import hashlib
import json
from sqlalchemy import create_engine, inspect, text
from sqlalchemy.engine import make_url
from alembic import command
from alembic.script import ScriptDirectory
from apply_independent_wallets import config, backup
from app.dung_chung.config import settings

PREVIOUS='cfdb_independent_wallets'
TARGET='cfdb_wallet_spending'


def old_columns(conn):
    return {t:[c['name'] for c in inspect(conn).get_columns(t)] for t in inspect(conn).get_table_names()
            if t not in {'alembic_version','sysdiagrams','schema_migrations'}}


def snapshot(conn,columns):
    quote=conn.dialect.identifier_preparer.quote
    result={}
    for table,names in columns.items():
        rows=sorted(json.dumps(list(row),default=str,ensure_ascii=True) for row in conn.execute(text(
            'SELECT '+','.join(map(quote,names))+' FROM '+quote(table))))
        result[table]=(len(rows),hashlib.sha256('\n'.join(rows).encode()).hexdigest())
    return result


def preflight(conn):
    assert conn.scalar(text('SELECT DB_NAME()'))=='personal_finance'
    assert conn.scalar(text('SELECT version_num FROM alembic_version'))==PREVIOUS
    assert 'include_in_reports' not in {c['name'] for c in inspect(conn).get_columns('transactions')}


def upgrade(conn):
    conn.execute(text('SET LOCK_TIMEOUT 15000'))
    for table in ('alembic_version','transactions','wallet_entries'):
        conn.execute(text('SELECT COUNT(*) FROM '+table+' WITH (TABLOCKX, HOLDLOCK)'))
    preflight(conn)
    columns=old_columns(conn); before=snapshot(conn,columns)
    old_indexes={t:inspect(conn).get_indexes(t) for t in columns}
    command.upgrade(config(conn),TARGET)
    assert snapshot(conn,columns)==before
    assert conn.scalar(text('SELECT COUNT(*) FROM transactions WHERE include_in_reports=0 OR wallet_entry_id IS NOT NULL'))==0
    for table,indexes in old_indexes.items():
        current=[i for i in inspect(conn).get_indexes(table) if i['name']!='UX_transactions_wallet_entry']
        assert current==indexes
    if ScriptDirectory.from_config(config(conn)).get_current_head() == TARGET:
        command.check(config(conn))
    return columns,before


def main():
    parser=argparse.ArgumentParser(description=__doc__); parser.add_argument('--apply',action='store_true'); args=parser.parse_args()
    url=make_url(settings.database_url)
    assert url.get_backend_name()=='mssql' and url.database=='personal_finance' and 'odbc_connect' not in url.query
    engine=create_engine(url,hide_parameters=True)
    try:
        with engine.connect() as conn: preflight(conn)
        if args.apply: backup(url, label='wallet_spending')
        with engine.connect() as conn:
            outer=conn.begin()
            try:
                columns,before=upgrade(conn)
                command.downgrade(config(conn),PREVIOUS)
                assert old_columns(conn)==columns and snapshot(conn,columns)==before
            finally: outer.rollback()
        print('REHEARSAL_PASS: upgrade/downgrade preserves all existing rows, columns and indexes',flush=True)
        if args.apply:
            with engine.begin() as conn: columns,_=upgrade(conn)
            print(f'MIGRATION_PASS: {TARGET}; existing fields of {len(columns)} tables unchanged; old reporting decisions preserved',flush=True)
    finally: engine.dispose()


if __name__=='__main__': main()
