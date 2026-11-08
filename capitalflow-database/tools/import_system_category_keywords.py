"""Merge the reviewed thuchi.docx keywords into system categories only.

Dry-run by default. --apply saves the previous target rows before committing.
Existing keywords and metadata are preserved; only the approved Trả nợ category
may be created. Re-running does not duplicate keywords or update unchanged rows.
"""
import argparse
from datetime import datetime, timezone
import json
from pathlib import Path
import re
import sys
import unicodedata
from uuid import uuid4

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / 'capitalflow-api'))


def words(value):
    return [unicodedata.normalize('NFC', word.strip()) for word in re.split(r'[,;\n]+', value or '') if word.strip()]


def merge_keywords(existing, incoming):
    merged, seen = [], set()
    for word in words(existing) + incoming:
        word = unicodedata.normalize('NFC', word.strip())
        key = word.casefold()
        if key not in seen:
            merged.append(word)
            seen.add(key)
    value = ', '.join(merged)
    if len(value) > 1000:
        value = ','.join(merged)
    if len(value) > 1000:
        raise ValueError('Merged keywords exceed 1000 characters; no data was changed')
    return value


def run(apply=False):
    from sqlalchemy import text
    from app.dung_chung.database.session import SessionLocal

    catalog = json.loads((ROOT / 'capitalflow-database/data/system_category_keywords_20261102.json').read_text(encoding='utf-8'))
    report = []
    with SessionLocal() as db:
        # Lock the system-category scope during the merge to prevent lost edits.
        lock = ' WITH (UPDLOCK, HOLDLOCK)' if apply else ''
        rows = [dict(row) for row in db.execute(text(
            f'SELECT * FROM categories{lock} WHERE owner_user_id IS NULL'
        )).mappings()]
        existing = {(r['type'], r['name']): r for r in rows}
        plan = []
        for group in catalog:
            key = (group['type'], group['name'])
            row = existing.get(key)
            if row is None and key != ('EXPENSE', 'Trả nợ'):
                raise ValueError(f'Missing system category: {key}')
            before = row['keywords'] if row else None
            after = merge_keywords(before, group['keywords'])
            added = len({w.casefold() for w in words(after)} - {w.casefold() for w in words(before)})
            report.append({'name': group['name'], 'type': group['type'], 'added': added, 'total': len(words(after)), 'characters': len(after), 'create': row is None})
            if row is None or after != before:
                plan.append((group, row, after))

        if apply and plan:
            stamp = datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%S%fZ')
            backup = ROOT / f'output/category-keywords-import/before-{stamp}.json'
            backup.parent.mkdir(parents=True, exist_ok=True)
            backup.write_text(json.dumps({'rows': rows, 'plan': report}, ensure_ascii=False, indent=2, default=str), encoding='utf-8')
            for group, row, after in plan:
                if row:
                    result = db.execute(text('UPDATE categories SET keywords=:keywords, updated_at=SYSUTCDATETIME() WHERE id=:id AND owner_user_id IS NULL'), {'id': row['id'], 'keywords': after})
                    assert result.rowcount == 1
                else:
                    db.execute(text('''INSERT INTO categories
                        (id, owner_user_id, name, type, icon, color, keywords, sort_order, is_active)
                        VALUES (:id, NULL, :name, :type, 'credit-card', 'rose', :keywords, :sort_order, 1)'''),
                        {'id': str(uuid4()), 'name': group['name'], 'type': group['type'], 'keywords': after,
                         'sort_order': max((r['sort_order'] for r in rows if r['type'] == 'EXPENSE'), default=0) + 10})
            updated = {(r['type'], r['name']): r['keywords'] for r in db.execute(text('SELECT name,type,keywords FROM categories WHERE owner_user_id IS NULL')).mappings()}
            for group in catalog:
                actual = {w.casefold() for w in words(updated[(group['type'], group['name'])])}
                assert {w.casefold() for w in group['keywords']} <= actual
            db.commit()
        else:
            db.rollback()
    print(json.dumps({'applied': apply, 'changed_categories': len(plan), 'added_keywords': sum(r['added'] for r in report), 'categories': report}, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    sys.stdout.reconfigure(encoding='utf-8')
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--apply', action='store_true')
    run(parser.parse_args().apply)
