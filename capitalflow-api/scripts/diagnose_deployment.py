"""Read-only SQL readiness diagnostic. Never prints connection strings or exceptions."""
import json
import socket
from pathlib import Path
from tempfile import TemporaryFile


def validate_url(url):
    query = {k.lower(): str(v).lower() for k, v in url.query.items()}
    if url.drivername != "mssql+pyodbc":
        return "REQUIRES_MSSQL_PYODBC"
    if query.get("driver") != "odbc driver 18 for sql server":
        return "REQUIRES_ODBC_18"
    if not url.host or "\\" in url.host or not url.port or not url.database:
        return "REQUIRES_FQDN_TCP_PORT_DATABASE"
    if query.get("encrypt") not in {"yes", "true", "mandatory", "strict"} or query.get("trustservercertificate") not in {"no", "false"}:
        return "REQUIRES_VERIFIED_TLS"
    integrated = query.get("trusted_connection") in {"yes", "true"}
    if integrated and (url.username or url.password):
        return "AMBIGUOUS_AUTHENTICATION"
    if not integrated and not (url.username and url.password):
        return "MISSING_SQL_CREDENTIALS_OR_KERBEROS"
    return None


def diagnose():
    stage = "configuration"
    try:
        from app.core.config import settings
        from sqlalchemy.engine import make_url
        from cryptography.fernet import Fernet
        url = make_url(settings.database_url)
        error = validate_url(url)
        if error:return {"ready": False, "stage": stage, "code": error}
        Fernet(settings.job_encryption_key.encode())
        if len(settings.jwt_secret_key) < 32:
            return {"ready": False, "stage": stage, "code": "JWT_SECRET_TOO_SHORT"}
        stage = "odbc_driver"
        import pyodbc
        if "ODBC Driver 18 for SQL Server" not in pyodbc.drivers():
            return {"ready": False, "stage": stage, "code": "DRIVER_NOT_INSTALLED"}
        stage = "tcp"
        with socket.create_connection((url.host, url.port), timeout=5):pass
        stage = "sql_authentication_and_tls"
        from app.core.database import engine
        from sqlalchemy import text
        with engine.connect() as connection:
            connection.execute(text("SELECT 1"))
            stage = "schema"
            versions = set(connection.scalars(text("SELECT version FROM dbo.schema_migrations")))
            if not {"20260910_financial_integrity", "20260910_resilience"}.issubset(versions):
                return {"ready": False, "stage": stage, "code": "MIGRATIONS_MISSING"}
            for table in ("users", "accounts", "transactions", "invoices", "background_jobs", "idempotency_records"):
                # Identifiers are a fixed internal allowlist, never user input.
                connection.exec_driver_sql("SELECT TOP (0) * FROM dbo." + table)
        stage = "upload_storage"
        with TemporaryFile(dir=Path(settings.upload_dir)) as probe:
            probe.write(b"readiness");probe.flush();probe.seek(0)
            if probe.read() != b"readiness":raise OSError("Storage check failed")
        return {"ready": True, "stage": "complete", "code": "CONNECTIVITY_SCHEMA_STORAGE_OK"}
    except Exception as exc:
        return {"ready": False, "stage": stage, "code": type(exc).__name__}


if __name__ == "__main__":
    result = diagnose()
    print(json.dumps(result))
    raise SystemExit(0 if result["ready"] else 1)
