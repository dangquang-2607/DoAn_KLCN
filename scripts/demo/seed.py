"""Idempotently add demo accounts, never reset an existing account's password."""
import runtime
from sqlalchemy import select, text
from app.dung_chung.database.session import SessionLocal
from app.dung_chung.database.dang_ky_mo_hinh import User
from app.dung_chung.security.passwords import hash_password

with SessionLocal() as db:
    assert db.scalar(text('SELECT DB_NAME()')) == 'CapitalFlow_QA_20261008_b5fcca32'
    for address, role in [('demo-user@example.com','USER'),('demo-admin@example.com','ADMIN')]:
        if not db.scalar(select(User).where(User.email == address)):
            db.add(User(email=address, full_name='CapitalFlow Demo '+role, role=role,
                        is_active=True, password_hash=hash_password('QA-local-only-2026!')))
    db.commit()
print('Demo-only accounts ready. Existing accounts and passwords unchanged.')
