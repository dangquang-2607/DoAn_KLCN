"""Audit by default; --apply backs up, retires legacy schema and checks all retained rows.

Local personal_finance only. Stop API/worker before applying. The SQL Server
backup is verified before any schema change. No account or financial row is deleted.
"""
import argparse
import hashlib
import json
import sys
from datetime import datetime, timezone
from pathlib import Path, PureWindowsPath
from uuid import uuid4
from types import SimpleNamespace
from sqlalchemy import create_engine, text
from sqlalchemy.engine import make_url
from alembic.config import Config
from alembic import command

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / 'capitalflow-api'))
from app.dung_chung.config import settings
from app.dung_chung.tac_vu_nen.hang_doi import decode

PREVIOUS = 'cfdb_support_two_cases'
TARGET = 'cfdb_retire_user_deletion'
REMOVED_COLUMNS = {'is_deleted','deletion_status','deleted_at','deleted_by','email_before_delete_sealed','pre_delete_is_active'}
REMOVED_TABLES = {'user_deletion_files','user_deletion_requests'}
ACTIONS = {'DELETE_USER','SOFT_DELETE_USER','HARD_DELETE_USER_REQUESTED','HARD_DELETE_USER_COMPLETE','RESTORE_USER','RETRY_USER_PURGE','RETRY_USER_FILE_PURGE','USER_RESTORE','USER_SOFT_DELETE','USER_HARD_DELETE'}

def require(test, message):
    if not test:
        raise RuntimeError(message)


def snapshot(conn):
    conn.exec_driver_sql('SET LOCK_TIMEOUT 15000')
    names = conn.scalars(text("SELECT name FROM sys.tables WHERE schema_id=SCHEMA_ID('dbo') AND name<>'sysdiagrams'")).all()
    # Fixed server-owned identifiers, quoted before constructing the read-only query.
    return {name:[dict(row) for row in conn.exec_driver_sql('SELECT * FROM dbo.[' + name.replace(']', ']]') + ']').mappings()]
            for name in names}


def digest(rows):
    normalized = sorted(json.dumps(row, sort_keys=True, default=str) for row in rows)
    return hashlib.sha256('\n'.join(normalized).encode()).hexdigest()


def plan(rows):
    revision = rows['alembic_version'][0]['version_num']
    require(revision == PREVIOUS, 'Unexpected database revision')
    require(all(not u['is_deleted'] and u['deletion_status']=='ACTIVE'
                and all(u[c] is None for c in REMOVED_COLUMNS - {'is_deleted','deletion_status'})
                for u in rows['users']), 'Resolve existing account deletion states first')
    require(all(r['status'] in {'COMPLETE','RESTORED'} for r in rows['user_deletion_requests']), 'Unfinished legacy request')
    retire_jobs = set()
    for job in rows['background_jobs']:
        retire = job['kind'] in {'USER_PURGE','USER_FILE_PURGE'}
        if job['kind']=='EMAIL' and job['payload']:
            try:
                payload = decode(SimpleNamespace(payload=job['payload']))
            except Exception:
                raise RuntimeError('Cannot classify an encrypted email job; investigate before migration') from None
            retire |= payload.get('function') in {'send_account_deleted_email','send_account_restored_email'}
        if retire:
            require(job['status'] not in {'PENDING','RUNNING'}, 'Unfinished legacy background job')
            retire_jobs.add(job['id'])
    expected = {}
    for table, data in rows.items():
        if table in REMOVED_TABLES:
            continue
        expected[table] = []
        for row in data:
            if table=='background_jobs' and row['id'] in retire_jobs:
                continue
            if table=='email_logs' and row['email_type'] in {'ACCOUNT_DELETED','ACCOUNT_RESTORED'}:
                continue
            if table=='audit_logs' and (row['entity_type']=='user_deletion' or row['action'] in ACTIONS):
                continue
            if table=='schema_migrations' and row['version']=='20260914_user_deletion':
                continue
            row = {k:v for k,v in row.items() if not (table=='users' and k in REMOVED_COLUMNS)}
            if table=='alembic_version':
                row['version_num']=TARGET
            expected[table].append(row)
    return expected, retire_jobs


def backup(engine):
    with engine.connect().execution_options(isolation_level='AUTOCOMMIT') as conn:
        directory = conn.scalar(text("SELECT CAST(SERVERPROPERTY('InstanceDefaultBackupPath') AS nvarchar(4000))"))
        require(directory, 'SQL Server backup directory unavailable')
        name = 'CapitalFlow_pre_retire_user_deletion_' + datetime.now(timezone.utc).strftime('%Y%m%d_%H%M%S') + '_' + uuid4().hex[:8]
        destination = str(PureWindowsPath(directory) / (name+'.bak'))
        cursor=conn.connection.cursor()
        try:
            cursor.execute('BACKUP DATABASE [personal_finance] TO DISK = ? WITH COPY_ONLY, CHECKSUM',destination)
            while cursor.nextset():
                pass
            cursor.execute('RESTORE VERIFYONLY FROM DISK = ? WITH CHECKSUM',destination)
            while cursor.nextset():
                pass
        finally:
            cursor.close()
    folder=ROOT/'.maintenance-backups'/name
    folder.mkdir(parents=True)
    return destination, folder


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--apply',action='store_true')
    args=parser.parse_args()
    url=make_url(settings.database_url)
    require(url.get_backend_name()=='mssql' and url.database=='personal_finance', 'Local personal_finance only')
    require((url.host or '').lower().split('\\')[0].split(',')[0] in {'localhost','127.0.0.1','.', '(local)'}, 'Local SQL Server only')
    engine=create_engine(url,hide_parameters=True,connect_args={'timeout':5})
    try:
        with engine.connect() as conn:
            rows=snapshot(conn)
        if rows['alembic_version'][0]['version_num']==TARGET:
            require(not (REMOVED_TABLES & rows.keys()), 'Retired tables still present')
            require(not (REMOVED_COLUMNS & rows['users'][0].keys()), 'Retired columns still present')
            print(json.dumps({'revision':TARGET,'already_applied':True}))
            return
        expected,retire_jobs=plan(rows)
        summary={'previous':PREVIOUS,'target':TARGET,'users_preserved':len(rows['users']),
                 'removed_rows':{t:len(r)-len(expected.get(t,[])) for t,r in rows.items() if len(r)!=len(expected.get(t,[]))},
                 'removed_tables':sorted(REMOVED_TABLES),'removed_user_columns':sorted(REMOVED_COLUMNS)}
        if not args.apply:
            print(json.dumps(summary,indent=2));return
        destination,folder=backup(engine)
        print('Backup verified; starting rollback rehearsal.',file=sys.stderr,flush=True)
        manifest={**summary,'backup':destination,'backup_verified':True}
        (folder/'manifest.json').write_text(json.dumps(manifest,indent=2),encoding='utf-8')
        for commit in (False, True):
            print('Stage: '+('commit' if commit else 'rehearsal'),file=sys.stderr,flush=True)
            with engine.connect().execution_options(isolation_level='SERIALIZABLE') as conn:
                transaction=conn.begin()
                try:
                    locked=snapshot(conn)
                    require({t:digest(r) for t,r in locked.items()}=={t:digest(r) for t,r in rows.items()}, 'Database changed after audit; retry from a new snapshot')
                    for identifier in retire_jobs:
                        conn.execute(text('DELETE FROM dbo.background_jobs WHERE id=:id'), {'id':str(identifier)})
                    config=Config(str(ROOT/'capitalflow-database/alembic.ini'))
                    config.attributes['connection']=conn
                    command.upgrade(config,TARGET)
                    print('Schema upgraded; comparing retained rows.',file=sys.stderr,flush=True)
                    after=snapshot(conn)
                    require(set(after)==set(expected), 'Unexpected schema table change')
                    require({t:digest(r) for t,r in after.items()}=={t:digest(r) for t,r in expected.items()}, 'Retained data mismatch; transaction rolled back')
                    transaction.commit() if commit else transaction.rollback()
                    if not commit:
                        restored=snapshot(conn)
                        require({t:digest(r) for t,r in restored.items()}=={t:digest(r) for t,r in rows.items()}, 'Rehearsal rollback mismatch')
                finally:
                    if transaction.is_active:
                        transaction.rollback()
        manifest.update(applied=True,rollback_rehearsed=True,retained_tables_verified=len(expected),retained_fingerprints={t:digest(r) for t,r in expected.items()})
        (folder/'manifest.json').write_text(json.dumps(manifest,indent=2),encoding='utf-8')
        public={k:v for k,v in manifest.items() if k not in {'backup','retained_fingerprints'}}
        (ROOT/'output/admin-web-qa/user-deletion-retirement.json').write_text(json.dumps(public,indent=2),encoding='utf-8')
        print(json.dumps(public,indent=2))
    finally:
        engine.dispose()


if __name__=='__main__':
    main()
