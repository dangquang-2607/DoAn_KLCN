"""Expire only the named local QA user's refresh tokens for the UI expiry test."""
from datetime import datetime, timedelta, timezone
from sqlalchemy import select, update
import serve_fixture as fixture
from app.chuc_nang.nguoi_dung.dang_nhap.luu_tru.refresh_token import RefreshToken
from app.dung_chung.database.dang_ky_mo_hinh import User

assert fixture.DB.name == 'ui-fixture.sqlite'
with fixture.SessionLocal() as db:
    user = db.scalar(select(User).where(User.email == 'qa-user@example.com'))
    result = db.execute(update(RefreshToken).where(RefreshToken.user_id == user.id, RefreshToken.revoked_at.is_(None)).values(expires_at=datetime.now(timezone.utc).replace(tzinfo=None)-timedelta(days=1)))
    db.commit()
    print({'qa_refresh_tokens_expired': result.rowcount, 'production_writes': False})
