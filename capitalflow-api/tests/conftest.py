"""Offline integration fixtures: isolated SQLite DB, no SMTP/AI/external sockets."""
import socket
from datetime import datetime, timezone
from unittest.mock import MagicMock
import pytest
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from fastapi.testclient import TestClient
from fastapi import Request
from uuid import uuid4
from app.main import app as application
from app.models.base import Base
from app.api.dependencies import get_db
from app.models.user import User
from app.core.security import hash_password, create_access_token
from app.core.limiter import limiter
import app.models


@pytest.fixture(autouse=True)
def offline(monkeypatch):
    original_connect = socket.socket.connect
    def blocked(sock, address):
        # Windows asyncio implements its internal socketpair using loopback TCP.
        import inspect
        if any(frame.function == "_fallback_socketpair" and frame.filename.endswith("socket.py") for frame in inspect.stack()):
            return original_connect(sock, address)
        raise AssertionError("External network is forbidden in automated tests")
    monkeypatch.setattr(socket.socket, "connect", blocked)
    monkeypatch.setattr(socket.socket, "connect_ex", blocked)
    from app.services.email_service import EmailService
    sender = MagicMock(return_value=True)
    monkeypatch.setattr(EmailService, "send_email_sync", sender)
    from app.api.middleware import audit_middleware
    monkeypatch.setattr(audit_middleware, "_write_audit_log", MagicMock())
    limiter.reset()
    yield sender


@pytest.fixture
def db():
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    @event.listens_for(engine, "connect")
    def configure(connection, _):
        connection.create_function("sysutcdatetime", 0, lambda: datetime.now(timezone.utc).replace(tzinfo=None).isoformat(" "))
        connection.execute("PRAGMA foreign_keys=ON")
    Base.metadata.create_all(engine)
    session = sessionmaker(bind=engine, autoflush=False)()
    yield session
    session.close()
    engine.dispose()


@pytest.fixture
def client(db, monkeypatch):
    def request_db(request: Request):
        db.info["request"] = request
        return db
    application.dependency_overrides[get_db] = request_db
    # Background budget checking opens a separate session in production.
    from app.api.routes import transactions
    class BorrowedSession:
        def __getattr__(self, name): return getattr(db, name)
        def close(self): pass
    monkeypatch.setattr(transactions, "SessionLocal", BorrowedSession)
    with TestClient(application) as c:
        c.event_hooks["request"].append(lambda r: r.headers.setdefault("Idempotency-Key", str(uuid4())))
        yield c
    application.dependency_overrides.clear()


@pytest.fixture
def test_user(db):
    user = User(email="testuser@example.com", full_name="Test User", password_hash=hash_password("password123"), role="USER", is_active=True)
    db.add(user); db.commit(); db.refresh(user)
    return user


@pytest.fixture
def test_admin(db):
    user = User(email="admin@example.com", full_name="Admin", password_hash=hash_password("admin123"), role="ADMIN", is_active=True)
    db.add(user); db.commit(); db.refresh(user)
    return user


@pytest.fixture
def user_token(test_user):
    return create_access_token(str(test_user.id), test_user.role, test_user.token_version)


@pytest.fixture
def admin_token(test_admin):
    return create_access_token(str(test_admin.id), test_admin.role, test_admin.token_version)
