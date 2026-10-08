"""Read only the approved QA lifecycle account; never export credentials."""
import json
import sqlite3
from pathlib import Path

ROOT = Path(__file__).resolve().parent
TARGET = '201c01a1ce554349a5613ee25700559b'
with sqlite3.connect((ROOT / 'ui-fixture.sqlite').as_uri() + '?mode=ro', uri=True) as db:
    db.row_factory = sqlite3.Row
    row = db.execute(
        'SELECT role, is_active, is_deleted, deletion_status, must_change_password, token_version '
        'FROM users WHERE id = ?', (TARGET,)
    ).fetchone()
    result = {'qa_only': True, 'target': TARGET, 'user': dict(row) if row else None}
print(json.dumps(result, indent=2))
