"""Isolated regression checks: no database connection, email or AI requests."""
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
from unittest.mock import MagicMock
from uuid import uuid4

from app.api.routes import auth, admin
from app.schemas.auth import RefreshRequest, AccessTokenResponse


def test_rotating_session_returns_the_new_refresh_token(monkeypatch):
    token = SimpleNamespace(
        revoked_at=None, expires_at=datetime.now(timezone.utc) + timedelta(days=1),
        user_id=uuid4(), family_id=uuid4(), id=uuid4(), device_name="Test",
        ip_address="127.0.0.1", user_agent="test",
    )
    db = MagicMock()
    user = SimpleNamespace(id=token.user_id, role="USER", is_active=True, token_version=0)
    db.scalar.side_effect = [token, user, token]
    monkeypatch.setattr(auth, "_create_refresh_token", lambda *args, **kwargs: ("next-refresh", uuid4()))
    monkeypatch.setattr(auth, "create_access_token", lambda *args: "next-access")
    response = auth.refresh_token(RefreshRequest(refresh_token="current-refresh"), db)
    assert AccessTokenResponse.model_validate(response).refresh_token == "next-refresh"
    assert response.access_token == "next-access"
    assert token.revoked_at is not None
    db.commit.assert_called_once()


def test_empty_smtp_password_preserves_existing_stored_secret():
    secret = SimpleNamespace(value="stored-secret")
    db = MagicMock()
    def scalar(statement):
        key = next(iter(statement.compile().params.values()))
        return secret if key == "smtp_password" else SimpleNamespace(value="old")
    db.scalar.side_effect = scalar
    admin._save_smtp_to_db(db, admin.SMTPSettingsUpdate(smtp_password=""), uuid4())
    assert secret.value == "stored-secret"


def test_new_smtp_password_replaces_existing_stored_secret():
    secret = SimpleNamespace(value="stored-secret")
    db = MagicMock()
    def scalar(statement):
        key = next(iter(statement.compile().params.values()))
        return secret if key == "smtp_password" else SimpleNamespace(value="old")
    db.scalar.side_effect = scalar
    admin._save_smtp_to_db(db, admin.SMTPSettingsUpdate(smtp_password="new-secret"), uuid4())
    from app.core.secrets_store import unseal
    assert secret.value != "new-secret"
    assert unseal(secret.value) == "new-secret"
