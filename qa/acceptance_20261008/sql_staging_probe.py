"""Read-only probe; never prints a connection string or credentials."""
import json
from sqlalchemy import create_engine, text
from sqlalchemy.engine import make_url
from app.dung_chung.config import settings
url = make_url(settings.database_url)
try:
    if url.get_backend_name() != 'mssql':
        raise RuntimeError('Configured backend is not SQL Server')
    engine = create_engine(url, hide_parameters=True)
    with engine.connect() as conn:
        row = conn.execute(text("SELECT DB_NAME() AS db, HAS_PERMS_BY_NAME(NULL,NULL,'CREATE ANY DATABASE') AS can_create, SERVERPROPERTY('ProductVersion') AS version")).mappings().one()
        print(json.dumps({'dialect':url.drivername, 'database':row['db'], 'can_create_staging':row['can_create'], 'version':row['version'], 'odbc_connect': 'odbc_connect' in url.query}))
except Exception as exc:
    print(json.dumps({'probe_error':type(exc).__name__}))
    raise SystemExit(1)
