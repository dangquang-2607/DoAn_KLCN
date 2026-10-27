"""Conservative cleanup from the 2026-10-27 review; read-only by default.

--apply verifies a native backup, rehearses with rollback, then commits the same
reviewed plan. --resume-failed-purge also finishes the single ImportError request
only if its user has no financial records, wallets or files. No email/file I/O.
Keep accounts, notifications, budgets, logs, dedupe keys, views and SSMS objects.
"""
import argparse
from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path, PureWindowsPath
import sys
from uuid import UUID, uuid4

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / 'capitalflow-api'))
from alembic import command
from sqlalchemy import create_engine, inspect, text
from sqlalchemy.engine import make_url
from sqlalchemy.orm import Session
from apply_independent_wallets import config
from app.dung_chung.config import settings
import app.dung_chung.database.dang_ky_mo_hinh  # register all FK targets
from app.chuc_nang.quan_tri.nguoi_dung.vong_doi.dich_vu import (
    original_email, purge_user_database, _job_targets_user,
)
from app.chuc_nang.nguoi_dung.dang_nhap.luu_tru.nguoi_dung import User
from app.dung_chung.tac_vu_nen.luu_tru.tac_vu_nen import BackgroundJob
from app.dung_chung.tac_vu_nen.hang_doi import decode

PREVIOUS = 'cfdb_wallet_short_code'
TARGET = 'cfdb_legacy_cleanup'
EXPIRED_FAMILIES = '''SELECT family_id FROM dbo.refresh_tokens
    GROUP BY family_id HAVING MAX(expires_at) <= :cutoff'''


def require(condition, message):
    if not condition:
        raise RuntimeError(message)


def fingerprint(rows):
    encoded = sorted(json.dumps(dict(row), sort_keys=True, default=str) for row in rows)
    return hashlib.sha256('\n'.join(encoded).encode()).hexdigest()


def quote(name):
    return '[' + name.replace(']', ']]') + ']'


def read_state(conn):
    def normalized(row):
        result = dict(row)
        for key, value in result.items():
            if value is not None and (key == 'id' or key.endswith('_id')):
                try:
                    result[key] = UUID(str(value))
                except (ValueError, TypeError, AttributeError):
                    pass
        return result
    return {name: [normalized(r) for r in conn.execute(text('SELECT * FROM dbo.' + quote(name))).mappings()]
            for name in inspect(conn).get_table_names(schema='dbo')}


def hashes(state):
    return {name: fingerprint(rows) for name, rows in state.items()}


def schema_signature(conn):
    # Use SQL Server catalogs in batches. MSSQL reflection lacks unique/check
    # inspection in this installed driver; batching also shortens maintenance locks.
    scope = "t.schema_id=SCHEMA_ID('dbo') AND t.name<>'wallet_bank_links'"
    queries = {
        'columns': '''SELECT t.name table_name,c.name column_name,c.column_id,
            c.system_type_id,c.user_type_id,c.max_length,c.precision,c.scale,
            c.is_nullable,c.is_identity,d.definition default_definition
            FROM sys.tables t JOIN sys.columns c ON c.object_id=t.object_id
            LEFT JOIN sys.default_constraints d ON d.object_id=c.default_object_id
            WHERE ''' + scope + ' ORDER BY t.name,c.column_id',
        'indexes': '''SELECT t.name table_name,i.name,i.type,i.is_unique,i.is_primary_key,
            i.is_unique_constraint,i.filter_definition,i.is_disabled,c.name column_name,
            ic.key_ordinal,ic.is_descending_key,ic.is_included_column
            FROM sys.tables t JOIN sys.indexes i ON i.object_id=t.object_id
            LEFT JOIN sys.index_columns ic ON ic.object_id=i.object_id AND ic.index_id=i.index_id
            LEFT JOIN sys.columns c ON c.object_id=ic.object_id AND c.column_id=ic.column_id
            WHERE ''' + scope + ' ORDER BY t.name,i.index_id,ic.index_column_id',
        'foreign_keys': '''SELECT t.name table_name,f.name,f.delete_referential_action,
            f.update_referential_action,f.is_disabled,f.is_not_trusted,
            c.parent_column_id,OBJECT_NAME(c.referenced_object_id) referenced_table,c.referenced_column_id
            FROM sys.tables t JOIN sys.foreign_keys f ON f.parent_object_id=t.object_id
            JOIN sys.foreign_key_columns c ON c.constraint_object_id=f.object_id
            WHERE ''' + scope + ' ORDER BY t.name,f.name,c.constraint_column_id',
        'checks': '''SELECT t.name table_name,c.name,c.definition,c.is_disabled,c.is_not_trusted
            FROM sys.tables t JOIN sys.check_constraints c ON c.parent_object_id=t.object_id
            WHERE ''' + scope + ' ORDER BY t.name,c.name',
        'modules': '''SELECT SCHEMA_NAME(o.schema_id) schema_name,o.name,o.type,m.definition
            FROM sys.objects o JOIN sys.sql_modules m ON m.object_id=o.object_id
            WHERE o.is_ms_shipped=0 ORDER BY o.schema_id,o.name''',
    }
    return {name: fingerprint(conn.execute(text(sql)).mappings()) for name, sql in queries.items()}


def lock_tables(conn):
    conn.execute(text('SET LOCK_TIMEOUT 5000'))
    for name in sorted(inspect(conn).get_table_names(schema='dbo')):
        conn.execute(text('SELECT COUNT_BIG(*) FROM dbo.' + quote(name) + ' WITH (TABLOCKX, HOLDLOCK)'))


def plan(conn, cutoff, resume):
    require(conn.scalar(text('SELECT DB_NAME()')) == 'personal_finance', 'Wrong database')
    require(settings.independent_wallets_enabled, 'Independent wallets must be enabled')
    revision = conn.scalar(text('SELECT version_num FROM dbo.alembic_version'))
    require(revision in {PREVIOUS, TARGET}, 'Unexpected schema version')
    if revision == PREVIOUS:
        require(conn.scalar(text('SELECT COUNT(*) FROM dbo.wallet_bank_links')) == 0,
                'Legacy links are not empty')
    require(not conn.scalar(text("SELECT COUNT(*) FROM dbo.background_jobs WHERE status IN ('PENDING','RUNNING')")),
            'Active jobs exist; wait for them before maintenance')
    params = {'cutoff': cutoff}
    token_ids = {UUID(str(value)) for value in conn.execute(text(
        'SELECT id FROM dbo.refresh_tokens WHERE family_id IN (' + EXPIRED_FAMILIES + ')'
    ), params).scalars()}
    require(not conn.scalar(text('''SELECT COUNT(*) FROM dbo.refresh_tokens child
        JOIN dbo.refresh_tokens parent ON child.parent_token_id=parent.id
        WHERE parent.family_id IN (''' + EXPIRED_FAMILIES + ''')
        AND child.family_id NOT IN (''' + EXPIRED_FAMILIES + ')'), params),
        'A retained token references an expired family')
    # Preserve the reset endpoint's 60-second request throttle even for anomalous OTPs.
    otp_ids = {UUID(str(value)) for value in conn.execute(text('''SELECT id FROM dbo.password_reset_otps
        WHERE expires_at <= :cutoff AND created_at <= DATEADD(second,-60,:cutoff)'''), params).scalars()}
    result = {'revision': revision, 'cutoff': cutoff, 'token_ids': token_ids, 'otp_ids': otp_ids,
              'purge': None, 'allowed': {}}
    if not resume:
        return result
    requests = conn.execute(text("""SELECT id,target_user_id FROM dbo.user_deletion_requests
        WHERE mode='hard' AND status='FAILED' AND purge_checkpoint='REQUESTED' AND error_code='ImportError'""")).mappings().all()
    require(len(requests) == 1, 'Expected exactly one reviewed ImportError purge request')
    request = {key: UUID(str(value)) for key, value in requests[0].items()}
    uid = request['target_user_id']
    with Session(bind=conn, autoflush=False, join_transaction_mode='rollback_only') as db:
        user = db.get(User, uid)
        require(user and user.is_deleted and not user.is_active and not user.is_system_account
                and user.deletion_status == 'PURGE_PENDING', 'Purge user no longer eligible')
        email = original_email(user, strict=True)
        # Do not broaden this one-time recovery to finances or physical file deletion.
        for table, column in [('accounts','user_id'), ('wallets','user_id'),
                              ('transactions','user_id'), ('invoices','user_id'),
                              ('budgets','user_id'), ('categories','owner_user_id'),
                              ('system_settings','updated_by'), ('user_bank_links','user_id')]:
            require(not conn.scalar(text(f'SELECT COUNT(*) FROM dbo.{table} WHERE {column}=:uid'), {'uid': str(uid)}),
                    'Purge target acquired dependent data: ' + table)
        require(not conn.scalar(text('SELECT COUNT(*) FROM dbo.user_deletion_files WHERE request_id=:rid'), {'rid': str(request['id'])}),
                'Purge has physical files; use the normal file workflow')
        require(conn.scalar(text('SELECT COUNT(*) FROM dbo.user_deletion_requests WHERE target_user_id=:uid'), {'uid': str(uid)}) == 1,
                'Multiple deletion requests need separate review')
        require(not conn.scalar(text('''SELECT COUNT(*) FROM dbo.wallet_demo_banks
            WHERE user_id=:uid AND balance<>opening_balance'''), {'uid': str(uid)}), 'Demo balances have changed')
        jobs = list(db.query(BackgroundJob).all())
        matches = []
        for job in jobs:
            if job.kind == 'USER_PURGE' and job.status == 'DEAD' and job.error_code == 'ImportError' and job.owner_user_id == uid:
                payload = decode(job)
                if UUID(str(payload.get('request_id'))) == request['id']:
                    matches.append(job)
        require(len(matches) == 1, 'Expected one matching dead purge job')
        job = matches[0]
        affected_jobs = {j.id for j in jobs if j.id == job.id or (
            j.payload and j.owner_user_id in {None, uid} and _job_targets_user(j, uid, email))}
    result['purge'] = {'request_id': request['id'], 'user_id': uid, 'job_id': job.id, 'email': email}
    result['allowed']['background_jobs'] = affected_jobs
    return result


def summary(p):
    return {'revision': p['revision'], 'cutoff_utc': str(p['cutoff']),
            'drop_empty_wallet_bank_links': p['revision'] == PREVIOUS,
            'expired_family_tokens': len(p['token_ids']), 'expired_otps': len(p['otp_ids']),
            'resume_failed_purge': p['purge'] is not None}


def protected_rows(state, p):
    """Hash every row outside the explicitly reviewed cleanup/purge scope."""
    purge = p['purge']; uid = purge['user_id'] if purge else None
    result = {}
    for table, rows in state.items():
        if table in {'alembic_version', 'wallet_bank_links'}:
            continue
        keep = []
        for row in rows:
            excluded = ((table == 'refresh_tokens' and row['id'] in p['token_ids']) or
                        (table == 'password_reset_otps' and row['id'] in p['otp_ids']))
            if purge:
                if table in {'users', 'wallet_demo_banks', 'refresh_tokens', 'password_reset_otps',
                             'idempotency_records', 'notifications'}:
                    excluded |= row.get('id' if table == 'users' else 'user_id') == uid
                elif table == 'audit_logs':
                    excluded |= row['user_id'] == uid or row['id'] in p['allowed'].get('audit_logs', set())
                elif table == 'email_logs':
                    excluded |= row['user_id'] == uid or row['id'] in p['allowed'].get('email_logs', set())
                elif table == 'user_deletion_requests':
                    excluded |= row['id'] == purge['request_id']
                elif table == 'background_jobs':
                    excluded |= row['id'] in p['allowed']['background_jobs']
            if not excluded:
                keep.append(row)
        result[table] = fingerprint(keep)
    return result


def check_integrity(conn):
    require(not conn.scalar(text('SELECT COUNT(*) FROM sys.foreign_keys WHERE is_disabled=1 OR is_not_trusted=1')),
            'Foreign keys are disabled or untrusted')
    inspector = inspect(conn)
    for table in inspector.get_table_names(schema='dbo'):
        for fk in inspector.get_foreign_keys(table, schema='dbo'):
            present = ' AND '.join('c.' + quote(col) + ' IS NOT NULL' for col in fk['constrained_columns'])
            match = ' AND '.join('c.' + quote(col) + '=p.' + quote(ref)
                                 for col, ref in zip(fk['constrained_columns'], fk['referred_columns']))
            require(not conn.scalar(text(f'SELECT COUNT(*) FROM dbo.{quote(table)} c WHERE {present} '
                f'AND NOT EXISTS (SELECT 1 FROM dbo.{quote(fk["referred_table"])} p WHERE {match})')),
                'Foreign-key orphan detected')


def perform(conn, p):
    before = read_state(conn); old_schema = schema_signature(conn)
    purge = p['purge']
    if purge:
        uid = purge['user_id']
        p['allowed']['audit_logs'] = {r['id'] for r in before['audit_logs'] if r['user_id'] == uid}
        p['allowed']['email_logs'] = {r['id'] for r in before['email_logs']
            if r['user_id'] == uid or r['recipient'].casefold() == purge['email'].casefold()}
    protected = protected_rows(before, p)
    if p['revision'] == PREVIOUS:
        command.upgrade(config(conn), TARGET)
    params = {'cutoff': p['cutoff']}
    conn.execute(text('DELETE FROM dbo.refresh_tokens WHERE family_id IN (' + EXPIRED_FAMILIES + ')'), params)
    conn.execute(text('''DELETE FROM dbo.password_reset_otps
        WHERE expires_at <= :cutoff AND created_at <= DATEADD(second,-60,:cutoff)'''), params)
    if purge:
        with Session(bind=conn, autoflush=False, join_transaction_mode='rollback_only') as db:
            status = purge_user_database(db, purge['request_id'], purge['job_id'])
            require(status == 'COMPLETE', 'Purge did not complete without physical I/O')
            job = db.get(BackgroundJob, purge['job_id'])
            job.status = 'DONE'; job.payload = ''; job.error_code = None
            job.attempts += 1; job.lease_token = None; job.lease_until = None
            db.flush()
    after = read_state(conn)
    if purge:
        new_audit = [r for r in after['audit_logs'] if r['id'] not in {x['id'] for x in before['audit_logs']}]
        require(len(new_audit) == 1 and new_audit[0]['action'] == 'HARD_DELETE_USER_COMPLETE'
                and new_audit[0]['entity_id'] == purge['user_id'], 'Unexpected purge audit event')
        require(len(after['audit_logs']) == len(before['audit_logs']) + 1, 'Audit history was removed')
        for name in ('email_logs', 'background_jobs', 'user_deletion_requests'):
            require(len(after[name]) == len(before[name]), 'Purge changed history count: ' + name)
        request = next(r for r in after['user_deletion_requests'] if r['id'] == purge['request_id'])
        require(request['status'] == 'COMPLETE' and request['purge_checkpoint'] == 'COMPLETE'
                and request['target_email_sealed'] is None and request['completed_at'] is not None,
                'Purge completion was not persisted')
        p['allowed']['audit_logs'].add(new_audit[0]['id'])
        require(not any(r['id'] == purge['user_id'] for r in after['users']), 'Purge user remains')
        require(not any(r['user_id'] == purge['user_id'] for r in after['wallet_demo_banks']), 'Purge banks remain')
        for row in after['audit_logs']:
            if row['id'] in p['allowed']['audit_logs'] and row['id'] != new_audit[0]['id']:
                require(row['user_id'] is None and row['metadata_json'] == '{"anonymized":true}', 'Audit not anonymized')
        for row in after['email_logs']:
            if row['id'] in p['allowed']['email_logs']:
                require(row['user_id'] is None and row['recipient'] == 'erased-user@redacted.invalid', 'Email log not anonymized')
    require(protected_rows(after, p) == protected, 'Data outside reviewed scope changed; rollback')
    require(schema_signature(conn) == old_schema, 'Retained table schema changed; rollback')
    require('wallet_bank_links' not in after, 'Legacy table remains')
    require(not any(r['id'] in p['token_ids'] for r in after['refresh_tokens']), 'Expired tokens remain')
    require(not any(r['id'] in p['otp_ids'] for r in after['password_reset_otps']), 'Expired OTPs remain')
    check_integrity(conn)
    command.check(config(conn))
    return {name: {'before': len(rows), 'after': len(after.get(name, []))}
            for name, rows in before.items() if name not in after or fingerprint(rows) != fingerprint(after[name])}


def backup(engine):
    with engine.connect().execution_options(isolation_level='AUTOCOMMIT') as conn:
        directory = conn.scalar(text("SELECT CAST(SERVERPROPERTY('InstanceDefaultBackupPath') AS nvarchar(4000))"))
        require(directory, 'SQL Server backup directory unavailable')
        name = 'CapitalFlow_pre_review_cleanup_' + datetime.now(timezone.utc).strftime('%Y%m%d_%H%M%S') + '_' + uuid4().hex[:8]
        destination = str(PureWindowsPath(directory) / (name + '.bak'))
        cursor = conn.connection.cursor()
        try:
            cursor.execute('BACKUP DATABASE [personal_finance] TO DISK = ? WITH COPY_ONLY, CHECKSUM', destination)
            while cursor.nextset():
                pass
            cursor.execute('RESTORE VERIFYONLY FROM DISK = ? WITH CHECKSUM', destination)
            while cursor.nextset():
                pass
        finally:
            cursor.close()
    folder = ROOT / '.maintenance-backups' / name
    folder.mkdir(parents=True)
    return destination, folder


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--apply', action='store_true')
    parser.add_argument('--resume-failed-purge', action='store_true')
    args = parser.parse_args()
    url = make_url(settings.database_url)
    require(url.get_backend_name() == 'mssql' and url.database == 'personal_finance'
            and 'odbc_connect' not in url.query, 'Unexpected database target')
    engine = create_engine(url, hide_parameters=True, connect_args={'timeout': 5})
    try:
        with engine.connect() as conn:
            cutoff = conn.scalar(text('SELECT SYSUTCDATETIME()'))
            preview = plan(conn, cutoff, args.resume_failed_purge)
        print('PREFLIGHT=' + json.dumps(summary(preview)), flush=True)
        if not args.apply:
            return
        destination, folder = backup(engine)
        manifest = {'plan': summary(preview), 'backup': destination, 'backup_verified': True,
                    'rehearsal_passed': False, 'applied': False}
        report = folder / 'manifest.json'
        def save():
            report.write_text(json.dumps(manifest, indent=2, default=str), encoding='utf-8')
        save()
        print('BACKUP_VERIFIED=' + destination, flush=True)
        # One outer transaction holds all table locks through rehearsal and commit.
        # The savepoint restores rows, original constraints and the schema version.
        with engine.connect() as conn:
            with conn.begin():
                lock_tables(conn)
                current = plan(conn, cutoff, args.resume_failed_purge)
                require(current == preview, 'Plan changed after preflight; rerun to review')
                before = read_state(conn); before_hashes = hashes(before)
                before_schema = schema_signature(conn)
                savepoint = conn.begin_nested()
                try:
                    rehearsed = perform(conn, current)
                    if preview['revision'] == PREVIOUS:
                        command.downgrade(config(conn), PREVIOUS)
                        require(conn.scalar(text('SELECT COUNT(*) FROM dbo.wallet_bank_links')) == 0,
                                'Downgrade did not restore the empty legacy table')
                finally:
                    savepoint.rollback()
                require(hashes(read_state(conn)) == before_hashes, 'Rehearsal rollback did not restore data')
                require(schema_signature(conn) == before_schema, 'Rehearsal rollback changed retained schema')
                manifest['rehearsal_passed'] = True; save()
                print('REHEARSAL_ROLLBACK_PASS=' + json.dumps(rehearsed), flush=True)
                current = plan(conn, cutoff, args.resume_failed_purge)
                changed = perform(conn, current)
                require(changed == rehearsed, 'Apply differs from rehearsal; rollback')
                manifest['changes'] = changed
            manifest['applied'] = True; save()
            require(conn.scalar(text('SELECT version_num FROM dbo.alembic_version')) == TARGET,
                    'Committed revision mismatch')
        print('CLEANUP_VERIFIED=' + str(report), flush=True)
    finally:
        engine.dispose()


if __name__ == '__main__':
    main()
