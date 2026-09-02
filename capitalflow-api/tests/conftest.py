import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from fastapi.testclient import TestClient
from uuid import uuid4
from decimal import Decimal
from datetime import date

from app.main import app
from app.models.base import Base
from app.api.dependencies import get_db
from app.models.user import User, UserRole
from app.core.security import hash_password, create_access_token

# Test database URL - using a separate database for safety
TEST_DATABASE_URL = "postgresql+psycopg://capitalflow:capitalflow_dev@localhost:5433/capitalflow_test"

engine = create_engine(TEST_DATABASE_URL)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

@pytest.fixture(scope="session")
def setup_db():
    # Create all tables
    Base.metadata.create_all(bind=engine)
    yield
    # Drop all tables after tests
    Base.metadata.drop_all(bind=engine)

@pytest.fixture
def db(setup_db):
    # Truncate tables before each test to ensure isolation
    with engine.connect() as conn:
        conn.execute(text("TRUNCATE TABLE users, accounts, categories, transactions, invoices CASCADE"))
        conn.commit()

    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()

@pytest.fixture
def client(db):
    def override_get_db():
        try:
            yield db
        finally:
            pass
    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()

@pytest.fixture
def test_user(db):
    user = User(
        email="testuser@example.com",
        password_hash=hash_password("password123"),
        full_name="Test User",
        role=UserRole.USER,
        is_active=True
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user

@pytest.fixture
def test_admin(db):
    admin = User(
        email="admin@example.com",
        password_hash=hash_password("admin123"),
        full_name="Admin",
        role=UserRole.ADMIN,
        is_active=True
    )
    db.add(admin)
    db.commit()
    db.refresh(admin)
    return admin

@pytest.fixture
def user_token(test_user):
    return create_access_token(str(test_user.id), role=test_user.role)

@pytest.fixture
def admin_token(test_admin):
    return create_access_token(str(test_admin.id), role=test_admin.role)

# Need text from sqlalchemy
from sqlalchemy import text
