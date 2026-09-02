from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.core.config import settings

engine = create_engine(
    settings.database_url,
    pool_pre_ping=True,       # tự ping lại nếu connection bị drop
    pool_size=10,             # số connection pool thường trực
    max_overflow=20,          # số connection tối đa có thể tạo thêm
    pool_recycle=3600,        # recycle connection sau 1 giờ (tránh stale connection)
)

SessionLocal = sessionmaker(
    bind=engine,
    autocommit=False,
    autoflush=False,
)
