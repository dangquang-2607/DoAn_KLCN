"""One-time local demo reset. Dry-run by default; retain admin@capitalflow.vn only.

Run with the API/worker stopped. --apply requires a verified native database
backup and upload archive, rehearses every delete with rollback, then commits.
This does not change the application's normal wallet/account deletion policy.
"""
import argparse
import hashlib
import json
import sys
from datetime import datetime, timezone
from pathlib import Path, PureWindowsPath
from types import SimpleNamespace
from uuid import uuid4
from zipfile import ZipFile, ZIP_DEFLATED

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / 'capitalflow-api'))
from sqlalchemy import MetaData, create_engine, inspect, select, text, and_, or_
from app.dung_chung.config import settings
from app.dung_chung.tac_vu_nen.hang_doi import decode

KEEP = 'admin@capitalflow.vn'
EXPECTED_KEEP_ID = 'fc0a94ea-cc17-4446-b7ce-9d852a48874a'


def normalized(value):
    return str(value).lower() if value is not None else None


def fingerprint(rows):
    encoded = sorted(json.dumps(dict(r), sort_keys=True, default=str) for r in rows)
    return hashlib.sha256('\n'.join(encoded).encode()).hexdigest()


def read_all(conn, metadata):
    return {name: [dict(r) for r in conn.execute(select(t)).mappings()]
            for name, t in metadata.tables.items()}


def plan(conn, metadata):
    assert conn.scalar(text('SELECT DB_NAME()')) == 'personal_finance'
    rows = read_all(conn, metadata)
    keeper = [r for r in rows['users'] if r['email'].lower() == KEEP]
    assert len(keeper) == 1
    keeper = keeper[0]
    assert normalized(keeper['id']) == EXPECTED_KEEP_ID
    assert keeper['role'] == 'ADMIN' and keeper['is_active'] and not keeper['is_deleted']
    assert keeper['phone_number'] is None, 'Keeper already has a phone; inspect instead of changing it'
    removed_users = [r for r in rows['users'] if r != keeper]
    removed_ids = {normalized(r['id']) for r in removed_users}
    emails = {r['email'].lower() for r in removed_users}
    needles = removed_ids | {s.replace('-', '') for s in removed_ids} | emails
    doomed = {name: set() for name in rows}
    updates = []

    def contains_removed(obj):
        value = json.dumps(obj, default=str).lower()
        return any(s in value for s in needles)

    for name, entries in rows.items():
        for i, row in enumerate(entries):
            if name == 'users':
                remove = normalized(row['id']) in removed_ids
            else:
                remove = any(normalized(row.get(col)) in removed_ids
                             for col in ('user_id', 'owner_user_id'))
            if name == 'user_deletion_requests':
                remove = normalized(row['target_user_id']) != EXPECTED_KEEP_ID
            if name in {'email_logs', 'password_reset_otps'}:
                recipient = row.get('recipient', row.get('email', '')).lower()
                remove |= recipient != KEEP
            if name == 'audit_logs':
                remove |= contains_removed(row)
            if name == 'background_jobs':
                if row['owner_user_id'] is not None:
                    remove |= normalized(row['owner_user_id']) != EXPECTED_KEEP_ID
                remove |= contains_removed({k: v for k, v in row.items() if k != 'payload'})
                try:
                    payload = decode(SimpleNamespace(payload=row['payload']))
                except Exception:
                    assert row['status'] in {'DONE', 'DEAD'} or remove, 'Unknown active job payload'
                else:
                    remove |= contains_removed(payload)
            if remove:
                doomed[name].add(i)
            elif name == 'system_settings' and normalized(row['updated_by']) in removed_ids:
                updates.append((name, i, 'updated_by'))
            elif name == 'users' and normalized(row.get('deleted_by')) in removed_ids:
                updates.append((name, i, 'deleted_by'))

    # Follow actual database FKs; never silently delete the retained admin's data.
    changed = True
    while changed:
        changed = False
        for name, table in metadata.tables.items():
            for fk in table.foreign_key_constraints:
                elements = list(fk.elements)
                parent = elements[0].column.table.name
                parent_values = {tuple(normalized(rows[parent][i][e.column.name]) for e in elements)
                                 for i in doomed[parent]}
                for i, row in enumerate(rows[name]):
                    if i in doomed[name]:
                        continue
                    value = tuple(normalized(row[e.parent.name]) for e in elements)
                    if None in value or value not in parent_values:
                        continue
                    if name == 'system_settings' and elements[0].parent.name == 'updated_by':
                        continue
                    owner = row.get('user_id', row.get('owner_user_id'))
                    assert normalized(owner) != EXPECTED_KEEP_ID or name in {'audit_logs', 'email_logs'}, 'Cross-user reference touches admin: ' + name
                    doomed[name].add(i)
                    changed = True

    expected = {name: [dict(row) for i, row in enumerate(entries) if i not in doomed[name]]
                for name, entries in rows.items()}
    for name, i, col in updates:
        original = rows[name][i]
        for row in expected[name]:
            if row == original:
                row[col] = None
                break
    assert expected['users'] == [keeper], 'Keeper must remain byte-for-byte unchanged'
    upload_root = Path(settings.upload_dir).resolve()
    assert upload_root == (ROOT / 'capitalflow-api' / 'uploads').resolve()
    retained_keys = {r['storage_key'] for r in expected['invoices'] if r['storage_key']}
    keys = {rows['invoices'][i]['storage_key'] for i in doomed['invoices']}
    keys |= {rows['user_deletion_files'][i]['storage_key'] for i in doomed['user_deletion_files']}
    files = set()
    for key in keys - retained_keys - {None, ''}:
        path = (upload_root / key).resolve()
        assert path.parent == upload_root, 'Unsafe upload key'
        if path.is_file():
            files.add(path)
    previews = upload_root / 'emails'
    if previews.exists():
        for path in previews.glob('*.html'):
            assert path.resolve().parent == previews.resolve()
            if any(e.replace('@', '_at_') in path.name.lower() for e in emails):
                files.add(path.resolve())
    return rows, doomed, updates, expected, sorted(files), sorted(emails)


def predicate(table, row):
    columns = list(table.primary_key.columns)
    assert columns, 'Cannot identify rows in ' + table.name
    return and_(*(column == row[column.name] for column in columns))


def perform(conn, metadata, result):
    rows, doomed, updates, expected, _, _ = result
    # Every table is locked for this short maintenance transaction.
    conn.execute(text('SET LOCK_TIMEOUT 15000'))
    for name in sorted(metadata.tables):
        conn.execute(text(f'SELECT COUNT(*) FROM [{name}] WITH (TABLOCKX, HOLDLOCK)'))
    assert {n: fingerprint(r) for n, r in read_all(conn, metadata).items()} == {n: fingerprint(r) for n, r in rows.items()}, 'Database changed after preflight'
    for name, i, col in updates:
        table = metadata.tables[name]
        conn.execute(table.update().where(predicate(table, rows[name][i])).values({col: None}))
    for table in reversed(metadata.sorted_tables):
        selected = [rows[table.name][i] for i in sorted(doomed[table.name])]
        # Self-referencing tokens/invoices must be deleted in one statement.
        batch_size = 1000 if any(f.column.table is table for f in table.foreign_keys) else 400
        for start in range(0, len(selected), batch_size):
            batch = selected[start:start + batch_size]
            conn.execute(table.delete().where(or_(*(predicate(table, r) for r in batch))))
    actual = read_all(conn, metadata)
    assert {n: fingerprint(r) for n, r in actual.items()} == {n: fingerprint(r) for n, r in expected.items()}, 'Unexpected retained data change'


def backup(engine, folder, files):
    with engine.connect().execution_options(isolation_level='AUTOCOMMIT') as conn:
        directory = conn.scalar(text("SELECT CAST(SERVERPROPERTY('InstanceDefaultBackupPath') AS nvarchar(4000))"))
        assert directory
        destination = str(PureWindowsPath(directory) / (folder.name + '.bak'))
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
    archive = folder / 'removed-uploads.zip'
    with ZipFile(archive, 'w', ZIP_DEFLATED) as zipped:
        for path in files:
            zipped.write(path, path.relative_to(ROOT / 'capitalflow-api' / 'uploads').as_posix())
    with ZipFile(archive) as zipped:
        assert zipped.testzip() is None
        for path in files:
            key = path.relative_to(ROOT / 'capitalflow-api' / 'uploads').as_posix()
            assert hashlib.sha256(zipped.read(key)).digest() == hashlib.sha256(path.read_bytes()).digest()
    print('BACKUP_VERIFIED=' + destination, flush=True)
    return destination


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--apply', action='store_true')
    args = parser.parse_args()
    engine = create_engine(settings.database_url, hide_parameters=True)
    metadata = MetaData()
    with engine.connect() as conn:
        assert conn.scalar(text('SELECT DB_NAME()')) == 'personal_finance'
        metadata.reflect(conn, only=[n for n in inspect(conn).get_table_names() if n != 'sysdiagrams'])
        result = plan(conn, metadata)
    rows, doomed, _, expected, files, emails = result
    report = {'retained_email': KEEP, 'deleted_emails': emails,
              'delete_counts': {n: len(v) for n, v in doomed.items() if v},
              'remaining_counts': {n: len(v) for n, v in expected.items()},
              'file_count': len(files), 'applied': False}
    print(json.dumps(report, ensure_ascii=True), flush=True)
    if not args.apply:
        return
    assert len(emails) == 15, 'Expected exactly the 15 reviewed accounts'
    folder = ROOT / '.maintenance-backups' / ('CapitalFlow_pre_user_reset_' + datetime.now(timezone.utc).strftime('%Y%m%d_%H%M%S') + '_' + uuid4().hex[:8])
    folder.mkdir(parents=True)
    report['database_backup'] = backup(engine, folder, files)
    manifest = folder / 'manifest.json'
    manifest.write_text(json.dumps(report, indent=2), encoding='utf-8')
    with engine.connect() as conn:
        transaction = conn.begin()
        try:
            perform(conn, metadata, result)
        finally:
            transaction.rollback()
        assert {n: fingerprint(r) for n, r in read_all(conn, metadata).items()} == {n: fingerprint(r) for n, r in rows.items()}
    print('REHEARSAL_ROLLBACK_PASS', flush=True)
    with engine.begin() as conn:
        perform(conn, metadata, result)
    report['applied'] = True
    report['files_deleted'] = 0
    manifest.write_text(json.dumps(report, indent=2), encoding='utf-8')
    for path in files:
        path.unlink()
        report['files_deleted'] += 1
    with engine.connect() as conn:
        assert {n: fingerprint(r) for n, r in read_all(conn, metadata).items()} == {n: fingerprint(r) for n, r in expected.items()}
    manifest.write_text(json.dumps(report, indent=2), encoding='utf-8')
    print('RESET_VERIFIED=' + str(manifest), flush=True)


if __name__ == '__main__':
    main()
