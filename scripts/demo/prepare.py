"""Prepare laptop demo using only the existing isolated SQL QA database.
Writes ignored local configuration with fresh demo keys; never copies SMTP/AI keys.
"""
import json
import secrets
import sys
from pathlib import Path
from cryptography.fernet import Fernet
from sqlalchemy import create_engine, text, select
from sqlalchemy.engine import make_url

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / 'capitalflow-api'))
from app.dung_chung.config import settings

DB = 'CapitalFlow_QA_20261008_b5fcca32'
CONFIG = ROOT / '.demo.local.json'
if CONFIG.exists():
    raise SystemExit('Local demo config exists. Reuse it; do not rotate keys automatically.')
source = make_url(settings.database_url)
assert source.get_backend_name() == 'mssql' and 'odbc_connect' not in source.query
target = source.set(database=DB)
engine = create_engine(target, hide_parameters=True)
with engine.connect() as conn:
    assert conn.scalar(text('SELECT DB_NAME()')) == DB
engine.dispose()
config = {
    'DATABASE_URL': target.render_as_string(hide_password=False),
    'APP_ENV': 'demo-local-isolated', 'DEBUG': 'false',
    'JWT_SECRET_KEY': secrets.token_urlsafe(48),
    'JOB_ENCRYPTION_KEY': Fernet.generate_key().decode(),
    'FRONTEND_URL': 'http://localhost:3028', 'ADMIN_URL': 'http://localhost:4028',
    'UPLOAD_DIR': str(ROOT / 'demo-uploads'),
    'SMTP_USER': '', 'SMTP_PASSWORD': '', 'GOOGLE_AI_API_KEY': '',
}
with CONFIG.open('x', encoding='utf-8') as handle:
    json.dump(config, handle, indent=2)
print('Created ignored .demo.local.json; SMTP/AI disabled. No production writes.')
