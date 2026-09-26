"""Kiểm thử thuần cho chính sách URL và chẩn đoán triển khai an toàn."""

from sqlalchemy.engine import make_url
from scripts.deployment.diagnose import diagnose, validate_url


def test_sql_auth_and_kerberos_url_policy():
    suffix = '?driver=ODBC+Driver+18+for+SQL+Server&Encrypt=yes&TrustServerCertificate=no'
    assert validate_url(make_url('mssql+pyodbc://test:placeholder@sql.example.invalid:1433/db' + suffix)) is None
    assert validate_url(make_url('mssql+pyodbc://sql.example.invalid:1433/db' + suffix + '&Trusted_Connection=yes')) is None
    assert validate_url(make_url('mssql+pyodbc://test:placeholder@sql.example.invalid:1433/db' + suffix.replace('TrustServerCertificate=no', 'TrustServerCertificate=yes'))) == 'REQUIRES_VERIFIED_TLS'
    assert validate_url(make_url('sqlite:///test.db')) == 'REQUIRES_MSSQL_PYODBC'


def test_diagnostic_configuration_error_never_leaks_secret(monkeypatch):
    from app.shared.config import settings
    monkeypatch.setattr(settings, 'database_url', 'SECRET_SENTINEL_INVALID_URL')
    result = diagnose()
    assert result['ready'] is False
    assert result['stage'] == 'configuration'
    assert 'SECRET_SENTINEL' not in str(result)
